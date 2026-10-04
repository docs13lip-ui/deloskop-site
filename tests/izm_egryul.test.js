// «Что изменилось»: уставный капитал уменьшился, КПП сменился, реорганизация — js/dinamika.js, izm-egryul-v1 ([Ночные-3] 04.10).
// Тексты подстрочников — [Право] 04.10 14:50 (izmeneniya-egryul, разд. 3 и 4) и [Продукт] 04.10 14:55 (ТЗ, пп. 2 и 5).
// v1.1: в новых строках комплекта нет ни «сырых» невидимых символов, ни escape-последовательностей с «u» — патч переживает перепечатку текстом.
// node --test tests/izm_egryul.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../js/dinamika.js');
const NB = String.fromCharCode(0xa0), UZK = String.fromCharCode(0x202f);

// Форма живого ответа /api/check 04.10 (7736050003): company.kpp, строки досье «Уставный капитал» (management)
// и «Организационно-правовая форма» (profile)
function otvet(o) {
  o = o || {};
  return {
    company: { inn: '7701000001', kind: 'LEGAL', status: o.status || 'ACTIVE', kpp: o.kpp === undefined ? '770101001' : o.kpp,
      name_full: o.name_full === undefined ? 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "АЛЬФА"' : o.name_full,
      director_since: '2020-01-10', director_name: 'Иванов Иван Иванович', invalid: false, address_invalid: false },
    risk_level: 'low', checked_at: o.t || '2026-10-04T12:00:00Z',
    signals: [{ id: 'status', title: 'Статус', status: 'ok' }],
    dossier: { charts: {}, sections: [
      { id: 'profile', rows: [['Организационно-правовая форма', o.opf === undefined ? 'Общество с ограниченной ответственностью' : o.opf]] },
      { id: 'management', rows: [['Генеральный директор', 'Иванов Иван Иванович'], ['Уставный капитал', o.ku === undefined ? '1 000 000 ₽' : o.ku]] },
    ] },
  };
}
const RANO = '2026-09-01T10:00:00Z';
const izm = (a, b) => D.sravnit(D.snimok(a), D.snimok(b));

test('снимок: капитал из строки досье, признак ООО, КПП; без ФИО', () => {
  const s = D.snimok(otvet());
  assert.strictEqual(s.ku, 1000000);
  assert.strictEqual(s.ooo, 1);
  assert.strictEqual(s.kpp, '770101001');
  assert.ok(!/Иванов/.test(JSON.stringify(s)));
  assert.strictEqual(D.snimok(otvet({ ku: '118 367 564 500 ₽' })).ku, 118367564500, 'обычные пробелы');
  assert.strictEqual(D.snimok(otvet({ ku: '118' + NB + '367' + UZK + '564' + NB + '500' + NB + '₽' })).ku, 118367564500, 'NBSP и узкий пробел');
  assert.strictEqual(D.snimok(otvet({ ku: '10' + NB + '000,50' + NB + '₽' })).ku, 10000.5);
  assert.strictEqual(D.snimok(otvet({ ku: '0 ₽' })).ku, 0);
  for (const k of ['', 'нет данных', '10 тыс. ₽', '-5 ₽', null]) assert.ok(!('ku' in D.snimok(otvet({ ku: k }))), 'мусор: ' + k);
  const ao = D.snimok(otvet({ opf: 'Публичное акционерное общество', name_full: 'ПАО "ГАЗПРОМ"' }));
  assert.ok(!('ooo' in ao) && ao.ku === 1000000, 'АО: капитал есть, признака ООО нет');
  assert.strictEqual(D.snimok(otvet({ opf: '' })).ooo, 1, 'ООО по полному наименованию');
  for (const k of [null, '', '7701', '77010100A', 'abcdefghi']) assert.ok(!('kpp' in D.snimok(otvet({ kpp: k }))), 'КПП: ' + k);
  assert.strictEqual(D.snimok(otvet({ kpp: '7701AB001' })).kpp, '7701AB001', 'буквы в 5–6 позиции допустимы');
  const ip = D.snimok(Object.assign(otvet(), { company: { inn: '500100732259', kind: 'INDIVIDUAL', status: 'ACTIVE', kpp: '770101001' } }));
  assert.ok(!('ku' in ip) && !('kpp' in ip), 'у ИП не храним');
});

test('капитал уменьшился у ООО: строка с суммами целиком и срок кредитора 30 дней (п. 5 ст. 20 14-ФЗ)', () => {
  const v = izm(otvet({ t: RANO }), otvet({ ku: '10 000 ₽' })).filter((x) => /капитал/.test(x.t));
  assert.strictEqual(v.length, 1);
  assert.strictEqual(v[0].ton, 'info');
  assert.strictEqual(v[0].t, 'Уставный капитал уменьшился: 1' + NB + '000' + NB + '000' + NB + '₽ → 10' + NB + '000' + NB + '₽ (ЕГРЮЛ)');
  assert.match(v[0].pod, new RegExp('^Если ваше требование к' + NB + 'компании возникло до' + NB + 'первой публикации уведомления'));
  assert.match(v[0].pod, new RegExp('30' + NB + 'дней'));
  assert.match(v[0].pod, new RegExp('\\(п\\.' + NB + '5 ст\\.' + NB + '20 14-ФЗ\\)'));
  assert.match(v[0].pod, /обычные права по.договору остаются/);
  assert.match(v[0].pod, new RegExp('не' + NB + 'позднее 6' + NB + 'месяцев'));
});

test('капитал: АО — строка без подстрочника; рост, тот же, старый снимок без капитала, с нуля — молчим', () => {
  const ao = { opf: 'Акционерное общество', name_full: 'АКЦИОНЕРНОЕ ОБЩЕСТВО "БЕТА"' };
  const v = izm(otvet(Object.assign({ t: RANO }, ao)), otvet(Object.assign({ ku: '500 000 ₽' }, ao))).filter((x) => /капитал/.test(x.t));
  assert.strictEqual(v.length, 1);
  assert.ok(!('pod' in v[0]), 'у АО норму 14-ФЗ не пишем');
  const net = (a, b) => izm(otvet(Object.assign({ t: RANO }, a)), otvet(b)).filter((x) => /капитал/.test(x.t));
  assert.deepStrictEqual(net({ ku: '10 000 ₽' }, { ku: '1 000 000 ₽' }), [], 'рост');
  assert.deepStrictEqual(net({}, {}), [], 'тот же');
  assert.deepStrictEqual(net({ ku: '' }, { ku: '10 000 ₽' }), [], 'старый снимок без капитала');
  assert.deepStrictEqual(net({ ku: '0 ₽' }, { ku: '0 ₽' }), []);
});

test('КПП: другая инспекция — так и пишем; та же инспекция — просто «сменился»; подстрочник — про платёжку', () => {
  const v = izm(otvet({ t: RANO }), otvet({ kpp: '781401001' })).filter((x) => /КПП/.test(x.t));
  assert.strictEqual(v.length, 1);
  assert.strictEqual(v[0].ton, 'info');
  assert.strictEqual(v[0].t, 'КПП сменился: 770101001 → 781401001 — компания встала на' + NB + 'учёт в' + NB + 'другой налоговой инспекции (ЕГРЮЛ)');
  assert.match(v[0].pod, /^Старый КПП в.вашей платёжке — частая причина уточнения платежа\./);
  const t = izm(otvet({ t: RANO }), otvet({ kpp: '770150001' })).filter((x) => /КПП/.test(x.t));
  assert.strictEqual(t[0].t, 'КПП сменился: 770101001 → 770150001 (ЕГРЮЛ)');
  assert.deepStrictEqual(izm(otvet({ t: RANO, kpp: null }), otvet()).filter((x) => /КПП/.test(x.t)), [], 'старый снимок без КПП');
});

test('реорганизация: строка статуса с подстрочником «правопреемник, 30 дней» без обещания досрочного возврата', () => {
  const v = izm(otvet({ t: RANO }), otvet({ status: 'REORGANIZING' })).filter((x) => /Статус в ЕГРЮЛ/.test(x.t));
  assert.strictEqual(v.length, 1);
  assert.strictEqual(v[0].t, 'Статус в ЕГРЮЛ: действующая → реорганизация');
  assert.match(v[0].pod, /правопреемнику/);
  assert.match(v[0].pod, new RegExp('проверьте сроки: 30' + NB + 'дней'));
  assert.match(v[0].pod, new RegExp('\\(п\\.' + NB + '2 ст\\.' + NB + '60 ГК' + NB + 'РФ\\)'));
  assert.ok(!/вправе|досрочн/.test(v[0].pod), '[Право] разд. 4: без «вправе потребовать досрочно»');
  const lik = izm(otvet({ t: RANO }), otvet({ status: 'LIQUIDATED' })).filter((x) => /Статус в ЕГРЮЛ/.test(x.t));
  assert.ok(!('pod' in lik[0]), 'у других статусов подстрочника реорганизации нет');
});

test('html: подстрочники экранируются и выводятся, без NaN; суммы не рвутся', () => {
  const ls = { st: {}, getItem(k) { return k in this.st ? this.st[k] : null; }, setItem(k, v) { this.st[k] = String(v); } };
  D.zapomnit(otvet({ t: RANO }), ls);
  const rez = D.zapomnit(otvet({ ku: '10 000 ₽', kpp: '781401001' }), ls);
  const h = D.htmlIzmeneniya(rez);
  assert.match(h, /<li class="izm--info">Уставный капитал уменьшился: 1.000.000.₽ → 10.000.₽ \(ЕГРЮЛ\)<small class="izm__pod">Если ваше требование/);
  assert.match(h, /<li class="izm--info">КПП сменился: 770101001 → 781401001/);
  assert.ok(!/NaN|undefined|Infinity/.test(h));
  assert.strictEqual(D.rubliTochno(118367564500), '118' + NB + '367' + NB + '564' + NB + '500' + NB + '₽');
  assert.strictEqual(D.rubliTochno(10000.5), '10' + NB + '000,50' + NB + '₽');
});

test('словарь (38-ФЗ, 222-ФЗ): в новых текстах нет «опасн», «надёжн», «гарант», «банк считает»', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'dinamika.js'), 'utf8');
  const stroki = src.split('\n').filter((l) => /POD_KAP|POD_KPP|POD_REORG|Уставный капитал уменьшился|КПП сменился|правопреемник|Вестнике/.test(l)).join('\n');
  assert.ok(stroki.length > 200);
  assert.ok(!/опасн|надёжн|надежн|гарант|банк считает|однодневк/i.test(stroki));
});

test('v1.1 доставка: в новых строках нет невидимых символов и escape-последовательностей с «u»', () => {
  const nevid = new RegExp('[' + [0xa0, 0x202f, 0x2009, 0xad, 0x200b, 0x2060, 0xfeff].map((k) => String.fromCharCode(k)).join('') + ']');
  const ESC = String.fromCharCode(92) + 'u';
  const sam = fs.readFileSync(__filename, 'utf8');
  assert.ok(!nevid.test(sam) && sam.indexOf(ESC) < 0, 'этот тест');
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'dinamika.js'), 'utf8').split('\n');
  const nov = src.filter((l) => /ustKapital|strokaDosje|rubliTochno|POD_KAP|POD_KPP|POD_REORG|s\.ku|s\.kpp|ooo\(/.test(l));
  assert.ok(nov.length >= 10);
  for (const l of nov) assert.ok(!nevid.test(l) && l.indexOf(ESC) < 0, l.slice(0, 80));
});
