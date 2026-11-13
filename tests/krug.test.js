// krug-v1 (13.11.2026): «Кто рядом» — круг компании через людей. Слова — [Право] ✎ 9 и ✎ 11 от 13.11, экран — [Продукт] 13.11 п. 2.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const K = require('../js/krug.js');
const KOREN = path.join(__dirname, '..');
const NB = ' ';
const SEG = new Date('2026-11-13T12:00:00+03:00');
const tekst = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/[ \t\n]+/g, ' ');

function org(o) {
  return Object.assign({ inn: '7703323030', name: 'ООО "РОМАШКА"', gorod: null, god_s: 2010, god_po: null, okved: '70.22', okved_tekst: null,
    status: 'ACTIVE', svyaz: ['rukovoditel'], cherez: 'chelovek', obshchij_adres: false, obshchij_okved: false, dolya_pct: null }, o);
}
function otvet(orgs, dop) {
  return Object.assign({ centr: { inn: '7838024362', name: 'ПАО "ТЕСТ"' }, organizacii: orgs,
    svodka: { vsego: orgs.length, polnota: 'polno', isklyucheny_nedejstvuyushchie: null }, ogranicheniya: [],
    na_daty: { egrul: '2026-09-11', krug: '2026-11-13' }, istochnik: 'egrul_dadata' }, dop || {});
}

test('живой ответ сервера (форма 13.11): сводка, строки, подписи связи, источник с датой', () => {
  const j = otvet([
    org({ inn: '7703323030', name: 'ООО "ГАЗ"', gorod: 'Санкт-Петербург', svyaz: ['uchreditel_org'], cherez: 'organizaciya', dolya_pct: 100 }),
    org({ inn: '5003046281', name: 'АО "ТЕПЛО"' }),
    org({ inn: '2901252021', name: 'ООО "АРХ"', svyaz: ['uchreditel_org'], cherez: 'organizaciya', obshchij_okved: true })
  ], { ogranicheniya: ['акционеров в ЕГРЮЛ нет', 'долги и суды проверены не у всех'] });
  const o = K.raschet(j, SEG);
  assert.strictEqual(o.sost, 'est');
  assert.strictEqual(o.svodka, 'Рядом 3' + NB + 'организации: 3 действуют.');
  assert.strictEqual(o.stroki[0].t, 'ООО «ГАЗ»');
  assert.strictEqual(o.stroki[0].s, 'Санкт-Петербург' + NB + '· с' + NB + '2010' + NB + '· через учредителя-организацию');
  assert.ok(!/доля/.test(o.stroki[0].s), 'долю учредителя-организации не пишем: неясно, чья она');
  assert.match(o.stroki[2].s, /тот же вид деятельности/);
  const t = tekst(K.html(o));
  assert.ok(t.includes('Кто рядом'));
  assert.ok(t.includes('Источник: ЕГРЮЛ, на 11.09.2026; связи собраны 13.11.2026.'));
  assert.ok(t.includes('Акционеров в ЕГРЮЛ нет'));
  assert.ok(t.includes(K.T.ogovorka));
  assert.ok(t.includes(K.T.dolgi), 'долги и суды круга — не утверждаем, отсылаем к отчёту по организации');
  assert.match(K.html(o), /href="\/\?inn=7703323030"/);
});

test('пусто: «рядом никого» — только при полной сверке; часть базы — так и пишем; нет в базе и ошибка — «не проверили»', () => {
  let o = K.raschet(otvet([]), SEG);
  assert.strictEqual(o.sost, 'pusto');
  assert.ok(tekst(K.html(o)).includes('Рядом никого: руководитель и участники не связаны с другими организациями по ЕГРЮЛ на 11.09.2026.'));
  o = K.raschet(otvet([], { svodka: { vsego: 0, polnota: 'chastichno' }, ogranicheniya: ['только организации, которые уже есть в базе сервера'], podpis: 'по 375 организациям базы Делоскопа' }), SEG);
  assert.strictEqual(o.sost, 'pusto_chast');
  assert.ok(tekst(K.html(o)).includes('сверили не весь ЕГРЮЛ, а только по 375 организациям базы Делоскопа. Это не значит, что связей нет.'));
  o = K.raschet(otvet([], { svodka: { vsego: 0, polnota: 'chastichno' }, ogranicheniya: ['только организации, которые уже есть в базе сервера', 'организации нет в базе сервера'] }), SEG);
  assert.strictEqual(o.sost, 'net_v_baze');
  assert.ok(!/Рядом никого/.test(tekst(K.html(o))));
  for (const plohoj of [null, undefined, 'ошибка', {}, { organizacii: 'x' }]) {
    const x = K.raschet(plohoj, SEG);
    assert.strictEqual(x.sost, 'oshibka');
    assert.ok(tekst(K.html(x)).includes('Связи не проверили' + NB + '— источник не ответил. Это не значит, что их нет.'));
  }
});

test('прекращённые: только за 3 года, способ словами ЕГРЮЛ, роль на дату прекращения (✎ 9 п. 2–5)', () => {
  const j = otvet([
    org({ inn: '1111111111', name: 'ООО "СТАРАЯ"', status: 'LIQUIDATED', god_s: 2010, god_po: 2019 }),
    org({ inn: '2222222222', name: 'ООО "НЕДАВНЯЯ"', status: 'LIQUIDATED', god_s: 2015, god_po: 2024 }),
    org({ inn: '3333333333', name: 'ООО "БЕЗ ГОДА"', status: 'LIQUIDATED', god_po: null }),
    org({ inn: '4444444444', name: 'ООО "ЖИВАЯ"' }),
    org({ inn: '5555555555', name: 'ООО "БАНКРОТ"', status: 'BANKRUPT' })
  ], { svodka: { vsego: 5, polnota: 'polno', isklyucheny_nedejstvuyushchie: 1 } });
  const o = K.raschet(j, SEG);
  assert.deepStrictEqual(o.stroki.map((x) => x.inn), ['5555555555', '2222222222', '4444444444'], 'банкротство → прекращённые за 3 года → действующие');
  assert.match(o.stroki[1].s, new RegExp('ликвидирована в' + NB + '2024' + NB + 'г\\.' + NB + '· на дату прекращения руководителем был тот же человек \\(ЕГРЮЛ\\)'));
  assert.strictEqual(o.stroki[0].tag, 'банкротство');
  assert.ok(o.stroki[0].warn);
  assert.strictEqual(o.svodka, 'Рядом 3' + NB + 'организации: 1 действует, 1 ликвидируется или в банкротстве, 1 прекращена за' + NB + '3' + NB + 'года (одна исключена налоговой как недействующая).');
  const t = tekst(K.html(o));
  assert.ok(t.includes('Что сделать:'));
  assert.ok(t.includes('Если эта фирма вам должна, долг можно попробовать взыскать с её руководителя или участников через суд. Срок считают с момента, когда вы узнали о прекращении фирмы.'), 'дословно ✎ 9 п. 6');
});

test('люди и ИП не попадают никогда: только 10-значные ИНН, без ФИО; 12 цифр в выдаче нет', () => {
  const j = otvet([org({ inn: '500100732259', name: 'ИП ИВАНОВ ИВАН' }), org({ inn: '7703323030', fio: 'Иванов Иван Иванович' })]);
  const o = K.raschet(j, SEG), h = K.html(o);
  assert.strictEqual(o.n, 1);
  assert.ok(!/\d{12}/.test(h));
  assert.ok(!/Иванов/i.test(h));
  assert.strictEqual(K.organizaciya({ company: { kind: 'INDIVIDUAL', inn: '500100732259' } }), '');
  assert.strictEqual(K.organizaciya({ company: { kind: 'LEGAL', inn: '7707083893' } }), '7707083893');
});

test('первые 5 на виду, остальные — «Ещё N организаций»; не больше 25', () => {
  const a = [];
  for (let i = 0; i < 30; i++) a.push(org({ inn: String(7700000000 + i), name: 'ООО "Ф' + i + '"' }));
  const o = K.raschet(otvet(a, { svodka: { vsego: 30, polnota: 'polno' } }), SEG);
  assert.strictEqual(o.stroki.length, 5);
  assert.strictEqual(o.eshche.length, 20);
  const t = tekst(K.html(o));
  assert.ok(t.includes('Ещё 20' + NB + 'организаций'));
  assert.ok(t.includes('Показываем 25 из 30.'));
});

test('участник с долей: «общий участник, доля 50 %»; доля вне 0–100 — не пишем', () => {
  const o = K.raschet(otvet([org({ svyaz: ['uchastnik'], dolya_pct: 50 }), org({ inn: '7703323031', svyaz: ['uchastnik'], dolya_pct: 150 })]), SEG);
  assert.match(o.stroki[0].s, new RegExp('общий участник, доля 50' + NB + '%$'));
  assert.match(o.stroki[1].s, /общий участник$/);
});

test('запрещённые слова (✎ 11): ни в исходнике, ни в выдаче', () => {
  const ZAPRET = [/аффилир/i, /взаимозависим/i, /дроблен/i, /\bсхем/i, /номинал/i, /однодневк/i, /подставн/i, /массов\S* руководител/i, /брошен/i];
  const src = fs.readFileSync(path.join(KOREN, 'js', 'krug.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  for (const z of ZAPRET) assert.ok(!z.test(src), 'в исходнике: ' + z);
  const o = K.raschet(otvet([org({ status: 'LIQUIDATING' }), org({ inn: '7703323031', status: 'REORGANIZING', obshchij_adres: true })]), SEG);
  const t = tekst(K.html(o));
  for (const z of ZAPRET) assert.ok(!z.test(t), 'в выдаче: ' + z);
  assert.ok(!/!/.test(t), 'без «!»');
});

test('mount: блок перед «Все данные из реестров», сначала «собираем», потом ответ; ИП и выключатель — без запроса', async () => {
  // мини-DOM без зависимостей
  function el(tag) {
    return { tagName: tag, children: [], parentNode: null, className: '', ownerDocument: null, _html: '', listeners: {},
      set innerHTML(v) { this._html = v; this.firstChild = { _html: v, parentNode: null, addEventListener() {} }; },
      insertBefore(n, ref) { n.parentNode = this; const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, n); return n; },
      replaceChild(n, old) { const i = this.children.indexOf(old); this.children[i] = n; n.parentNode = this; old.parentNode = null; return old; },
      appendChild(n) { n.parentNode = this; this.children.push(n); return n; },
      removeChild(n) { this.children.splice(this.children.indexOf(n), 1); n.parentNode = null; } };
  }
  const doc = { head: el('head'), getElementById: () => null, createElement: (t) => el(t) };
  const kolonka = el('div'), g = el('details');
  g._html = 'sut__g'; kolonka.appendChild(g);
  const report = { ownerDocument: doc, querySelector(sel) {
    if (sel === '.krug') return kolonka.children.find((x) => /class="krug"/.test(x._html || '')) || null;
    if (sel === '.sut__g') return g;
    return null; } };
  for (const x of [kolonka, g]) x.ownerDocument = doc;
  let zaprosy = [];
  const fetch = (u) => { zaprosy.push(u); return Promise.resolve({ ok: true, json: () => otvet([org({})]) }); };
  const p = K.mount(report, { company: { kind: 'LEGAL', inn: '7838024362' } }, { api: 'https://api.deloskop.ru', fetch, segodnya: SEG });
  assert.match(kolonka.children[0]._html, /data-krug="zhdem"/);
  const o = await p;
  assert.strictEqual(o.sost, 'est');
  assert.deepStrictEqual(zaprosy, ['https://api.deloskop.ru/api/krug?inn=7838024362']);
  assert.strictEqual(kolonka.children.length, 2, 'один блок, «собираем» заменён ответом');
  assert.match(kolonka.children[0]._html, /data-krug="est"/);
  assert.strictEqual(kolonka.children[1], g, 'перед «Все данные из реестров»');
  zaprosy = [];
  assert.strictEqual(await K.mount(report, { company: { kind: 'INDIVIDUAL', inn: '500100732259' } }, { fetch }), null);
  assert.strictEqual(await K.mount(report, { company: { kind: 'LEGAL', inn: '7838024362' } }, { fetch, vkl: false }), null);
  assert.deepStrictEqual(zaprosy, []);
  assert.strictEqual(kolonka.children.length, 1, 'ИП после организации — старый блок убран');
  // сервер молчит → «не проверили»
  const o2 = await K.mount(report, { company: { kind: 'LEGAL', inn: '7838024362' } }, { fetch: () => Promise.reject(new Error('сеть')) });
  assert.strictEqual(o2.sost, 'oshibka');
});

test('где стоит: экран проверки (не «своя компания»), после раскладки листа; пакет «otchet»; на карточках, Паспорте и /report.html — нет', () => {
  const ind = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  assert.match(ind, /if\(!svoj&&window\.DlkKrug\)\{try\{DlkKrug\.mount\(report,r,\{api:CAPI\}\)\.catch\(function\(\)\{\}\)\}catch\(e\)\{\}\}/);
  assert.ok(ind.indexOf('Otchet.razlozhit(report') < ind.indexOf('DlkKrug.mount(report'));
  const karta = JSON.parse(fs.readFileSync(path.join(KOREN, 'partials', 'sborka.json'), 'utf8'));
  assert.ok(karta.pakety.otchet.includes('js/krug.js'));
  for (const f of ['report.html', 'pasport/kontragent/index.html']) assert.ok(!fs.readFileSync(path.join(KOREN, f), 'utf8').includes('DlkKrug'), f);
  const co = path.join(KOREN, 'company');
  if (fs.existsSync(co)) {
    const odna = fs.readdirSync(co).find((x) => fs.existsSync(path.join(co, x, 'index.html')));
    if (odna) assert.ok(!fs.readFileSync(path.join(co, odna, 'index.html'), 'utf8').includes('DlkKrug'));
  }
});
