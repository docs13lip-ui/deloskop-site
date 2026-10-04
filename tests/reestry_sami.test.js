// «Что ещё проверить самим» (reestry-sami-v1): справочник data/reestry-sami.json + js/reestry-sami.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const RS = require('../js/reestry-sami.js');
const KOREN = path.join(__dirname, '..');
const SPRAV = JSON.parse(fs.readFileSync(path.join(KOREN, 'data/reestry-sami.json'), 'utf8'));
const ORG = { company: { inn: '7736050003' } };

test('справочник: у каждой записи — кто ведёт, когда важно, обновление, норма, официальная ссылка, цель', () => {
  assert.match(SPRAV.svereno, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(SPRAV.pravilo && /не позже \d{2}\.\d{2}\.\d{4}/.test(SPRAV.pravilo), 'правило обновления с датой');
  assert.ok(SPRAV.istochnik);
  const ids = new Set();
  for (const x of SPRAV.reestry) {
    for (const k of ['id', 'nazv', 'kto', 'kogda', 'chto', 'obnovlenie', 'norma', 'ssylka', 'cel']) assert.ok(x[k], x.id + ': нет ' + k);
    assert.ok(RS.DOMENY.test(x.ssylka), 'не официальный домен: ' + x.ssylka);
    assert.match(x.cel, /^reestry_[a-z]+$/);
    assert.ok(!ids.has(x.id)); ids.add(x.id);
  }
  assert.ok(SPRAV.reestry.length >= 5);
});

test('сверка не старше 92 дней от даты в файле до следующей сверки', () => {
  const m = /не позже (\d{2})\.(\d{2})\.(\d{4})/.exec(SPRAV.pravilo);
  const sled = Date.UTC(+m[3], +m[2] - 1, +m[1]);
  const sv = Date.parse(SPRAV.svereno + 'T00:00:00Z');
  assert.ok(sled - sv <= 92 * 864e5 && sled > sv);
});

test('тексты: без обещаний, превосходных степеней и «надёжн»; латиница в русских словах не прячется', () => {
  const t = JSON.stringify(SPRAV) + fs.readFileSync(path.join(KOREN, 'js/reestry-sami.js'), 'utf8');
  for (const s of [/надёжн/i, /надежн/i, /гарантир/i, /лучш/i, /самый/i, /\bИИ\b/, /нейросет/i]) assert.ok(!s.test(t), String(s));
  assert.ok(!/[а-яё][a-z]|[a-z][а-яё]/i.test(Object.values(SPRAV.reestry).map(x => x.chto + x.kogda + x.nazv).join(' ') + SPRAV.pravilo));
});

test('показ: только организации; ИП и пустой ответ — ничего', () => {
  assert.strictEqual(RS.dlya(ORG, SPRAV).length, SPRAV.reestry.filter(x => !x.okved).length);
  assert.deepStrictEqual(RS.dlya({ company: { inn: '500100732259' } }, SPRAV), []);
  assert.deepStrictEqual(RS.dlya({}, SPRAV), []);
  assert.deepStrictEqual(RS.dlya(ORG, null), []);
  assert.strictEqual(RS.html([], SPRAV), '');
});

test('чужой домен и запись без нормы не выводятся', () => {
  const s = { reestry: [ { id: 'a', nazv: 'A', chto: 'x', norma: 'ст. 1', ssylka: 'https://example.com/' },
    { id: 'b', nazv: 'B', chto: 'x', ssylka: 'https://rmsp.nalog.ru/' },
    { id: 'c', nazv: 'C', chto: 'x', norma: 'ст. 1', ssylka: 'http://rmsp.nalog.ru/' } ] };
  assert.deepStrictEqual(RS.dlya(ORG, s), []);
});

test('разметка: раздел «Все данные из реестров», ссылки наружу, цели Метрики, дата сверки, оговорка', () => {
  const h = RS.html(RS.dlya(ORG, SPRAV), SPRAV);
  assert.match(h, /<section class="sut__s rs" data-reestry-sami><h4>Что ещё проверить самим в открытых реестрах<\/h4>/);
  const obshchie = SPRAV.reestry.filter(x => !x.okved);
  assert.strictEqual((h.match(/target="_blank" rel="noopener"/g) || []).length, obshchie.length);
  for (const x of obshchie) assert.ok(h.includes('data-goal="' + x.cel + '"'));
  assert.match(h, /Ссылки и нормы сверены 04\.10\.2026\./);
  assert.match(h, /пока не опрашивает — результат проверки их не учитывает/);
  assert.ok(h.includes('ГК\u00a0РФ') && h.includes('ст.\u00a04.1\u00a0209-ФЗ'), 'неразрывные пробелы в нормах');
  assert.ok(!/<script|javascript:/i.test(h));
});

test('экранирование: разметка из справочника не исполняется', () => {
  const s = { svereno: '2026-10-04', reestry: [{ id: 'x"', nazv: '<b>', kogda: '<i>', chto: '<img src=x>', norma: 'ст. 1', ssylka: 'https://rmsp.nalog.ru/"><x', cel: 'reestry_x' }] };
  const h = RS.html(RS.dlya(ORG, s), s);
  assert.ok(!/<img|<b>|<i>|"><x/.test(h));
});

test('главная подключает модуль и вставляет раздел только в режиме проверки контрагента', () => {
  const s = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  assert.ok(s.includes('<script src="/js/reestry-sami.js" defer></script>'));
  assert.ok(s.includes("if(!svoj&&window.Sushchestvennoe&&window.ReestrySami){ReestrySami.zagruzit()"));
});

// reestry-sami-v2: правки [Право] 04.10 21:07 и новые реестры (Федресурс, Росаккредитация)
test('v2: Федресурс и Росаккредитация — официальные домены, цели, сверенные нормы', () => {
  const R = Object.fromEntries(SPRAV.reestry.map(x => [x.id, x]));
  assert.strictEqual(R.fedresurs.ssylka, 'https://fedresurs.ru/');
  assert.strictEqual(R.fsa.ssylka, 'https://pub.fsa.gov.ru/');
  assert.strictEqual(R.fedresurs.cel, 'reestry_fedresurs');
  assert.strictEqual(R.fsa.cel, 'reestry_fsa');
  assert.match(R.fedresurs.norma, /ст\. 7\.1 129-ФЗ/);
  assert.match(R.fedresurs.norma, /п\. 2\.1 ст\. 7 127-ФЗ/);
  assert.match(R.fsa.norma, /п\. 6 ст\. 24 184-ФЗ/);
  assert.match(R.fedresurs.chto, /Сведения открыты для всех\.$/);
  assert.match(R.fsa.chto, /Не на каждый товар они нужны\.$/);
  // в норме нет «бесплатно» — не пишем; лизинг не сверен дословно; маркетплейсы с 01.10 — только СМИ
  assert.ok(!/бесплатн/i.test(R.fedresurs.chto + R.fedresurs.kogda + R.fsa.chto + R.fsa.kogda));
  assert.ok(!/лизинг/i.test(JSON.stringify(R.fedresurs)));
  assert.ok(!/обязан|с 1 октября|01\.10/i.test(JSON.stringify(R.fsa)));
  // v3: КоАП допустим только у экспедиторов (ст. 11.14.3, сверено [Право] 02.10); у ФСА и Федресурса — нет
  assert.ok(!/КоАП|14\.25/.test(JSON.stringify([R.fedresurs, R.fsa, R.zalogi, R.msp, R.znaki])));
  assert.ok(!/14\.25/.test(JSON.stringify(SPRAV)));
});

test('v2: правки v1 — движимое имущество, МСП раз в год, норма о залоге полностью', () => {
  const R = Object.fromEntries(SPRAV.reestry.map(x => [x.id, x]));
  assert.match(R.zalogi.chto, /^Заложено ли движимое имущество компании и кому\./);
  assert.match(R.zalogi.norma, /если третье лицо не знало о залоге раньше \(п\. 4 ст\. 339\.1 ГК РФ\)/);
  assert.match(R.msp.chto, /пересобирают по отчётности раз в год — 10 июля\.$/);
  assert.match(R.znaki.chto, /если он ссылается на знак или лицензию\.$/);
  assert.strictEqual(R.znaki.norma, 'п. 1 ст. 1503 ГК РФ');
  // заголовок раздела не обещает «бесплатно» для всех реестров
  const h = RS.html(RS.dlya(ORG, SPRAV), SPRAV);
  assert.ok(!/<h4>[^<]*бесплатн/i.test(h));
  assert.ok(h.includes('ст.\u00a07.1\u00a0129-ФЗ') && h.includes('ст.\u00a024\u00a0184-ФЗ'));
});

// reestry-sami-v3 (05.10): реестры по виду деятельности — по основному ОКВЭД из ЕГРЮЛ
const sOkved = k => ({ company: { inn: '7736050003', okved: k } });
const po = k => RS.dlya(sOkved(k), SPRAV).filter(x => x.okvedKod).map(x => x.id);

test('v3: запись по ОКВЭД показывается только своей отрасли и идёт первой', () => {
  assert.deepStrictEqual(po('43.21'), ['sro_stroj']);
  assert.deepStrictEqual(po('41.20'), ['sro_stroj']);
  assert.deepStrictEqual(po('42.11'), ['sro_stroj']);
  assert.deepStrictEqual(po('71.12.2'), ['sro_proekt']);
  assert.deepStrictEqual(po('71.11'), ['sro_proekt']);
  assert.deepStrictEqual(po('52.29'), ['ekspeditory']);
  assert.deepStrictEqual(po('64.19'), ['cbr']);
  assert.deepStrictEqual(po('66.12'), ['cbr']);
  // холдинги (64.2), торговля, «52.2» без 52.29, 41.1 (девелопмент), пустой и кривой код — ничего отраслевого
  for (const k of ['64.20', '46.71.4', '52.2', '52.21', '41.10', '', 'abc', null]) assert.deepStrictEqual(po(k), [], String(k));
  const sp = RS.dlya(sOkved('43.21'), SPRAV);
  assert.strictEqual(sp[0].id, 'sro_stroj');
  assert.strictEqual(sp.length, SPRAV.reestry.filter(x => !x.okved).length + 1);
  // ИП с отраслевым ОКВЭД — по-прежнему ничего
  assert.deepStrictEqual(RS.dlya({ company: { inn: '500100732259', okved: '43.21' } }, SPRAV), []);
});

test('v3: официальные домены, нормы ГрК/КоАП/86-ФЗ, своя дата сверки, без исхода', () => {
  const R = Object.fromEntries(SPRAV.reestry.map(x => [x.id, x]));
  assert.strictEqual(R.sro_stroj.ssylka, 'https://reestr.nostroy.ru/');
  assert.strictEqual(R.sro_proekt.ssylka, 'https://reestr.nopriz.ru/');
  assert.strictEqual(R.ekspeditory.ssylka, 'https://mintrans.gov.ru/activities/297/367/433');
  assert.strictEqual(R.cbr.ssylka, 'https://www.cbr.ru/fmp_check/');
  assert.match(R.sro_stroj.norma, /ч\. 2 и 2\.1 ст\. 52/);
  assert.match(R.sro_stroj.chto, /дороже 10 млн ₽/);
  assert.match(R.sro_proekt.norma, /ч\. 2 ст\. 47, ч\. 4 ст\. 48/);
  assert.strictEqual(R.ekspeditory.norma, 'ст. 11.14.3 КоАП РФ; 140-ФЗ');
  assert.strictEqual(R.cbr.norma, 'ст. 76.1 86-ФЗ');
  // текст [Право] 02.10 17:07: «могут возникнуть вопросы», а не «не примет / откажет»
  assert.match(R.ekspeditory.chto, /могут возникнуть вопросы к вашим вычетам НДС и расходам/);
  for (const id of ['sro_stroj', 'sro_proekt', 'ekspeditory', 'cbr']) {
    const t = JSON.stringify(R[id]);
    assert.ok(!/откаж|не примет|недействит|штраф/i.test(t), id);
    assert.match(R[id].svereno, /^2026-10-05$/);
    assert.match(R[id].cel, /^reestry_[a-z]+$/);
  }
  const h = RS.html(RS.dlya(sOkved('52.29'), SPRAV), SPRAV);
  assert.ok(h.includes('<div data-reestr="ekspeditory" data-okved>'));
  assert.ok(h.includes('по основному ОКВЭД\u00a052.29'));
  assert.ok(h.includes('сверено 05.10.2026'));
  const h2 = RS.html(RS.dlya(sOkved('43.21'), SPRAV), SPRAV);
  assert.ok(h2.includes('10\u00a0млн\u00a0₽'), 'неразрывно «10 млн ₽»');
  assert.ok(h2.includes('ч.\u00a02 и 2.1 ст.\u00a052'));
});

test('v3: префикс ОКВЭД сравнивается по уровням, а не по строке', () => {
  assert.ok(RS.podPrefiks('43', '43'));
  assert.ok(RS.podPrefiks('43.21', '43'));
  assert.ok(!RS.podPrefiks('43', '4'));
  assert.ok(RS.podPrefiks('41.20', '41.2'));
  assert.ok(!RS.podPrefiks('52.2', '52.29'));
  assert.ok(RS.podPrefiks('52.29.1', '52.29'));
  assert.ok(!RS.podPrefiks('52.291', '52.29'));
  assert.ok(!RS.podPrefiks('', '43'));
});
