// poisk-v2-d (13.11.2026): строка и окно поиска спрашивают сервер /api/poisk — компании «город · годы · вид деятельности · ИНН»,
// банк по БИК («лицензию не проверяли»), компании по коду ОКВЭД, «исправили раскладку»; сервер молчит — прежний /api/suggest.
// Образцы ответов — с живого api.deloskop.ru/api/poisk 13.11.2026 10:15 МСК (сокращены).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../js/poisk.js');
const nb = (x) => x.replace(/ · /g, '\u00a0· ');

const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');
const RAZ = JSON.parse(chitat('data/poisk-razdely.json')).razdely;
const razbor = (q) => P.razobrat(q, RAZ);

const romashka = (inn, gorod, god, okved, extra) => Object.assign({ inn, name: 'ООО "РОМАШКА"', gorod, god_s: god, god_po: null, okved, status: 'ACTIVE', filial: false }, extra || {});
const ROMASHKI = {
  ponyal: { tip: 'nazvanie', znachenie: 'ромашка' },
  kompanii: [
    romashka('3900000001', 'Ягодное', 1993, null, { name: 'ИЧП "РОМАШКА"', god_po: 2012, status: 'LIQUIDATED' }),
    romashka('9727107049', 'Москва', 2025, '47.11'),
    romashka('9701037090', 'Москва', 2016, '47.11'),
    romashka('7718057567', 'Москва', 2015, '68.20', { filial: true }),
    romashka('8706007980', 'Певек', 2026, '47.11'),
    romashka('6668000641', 'Нижний Тагил', 1998, '68.20.2', { status: 'BANKRUPT' }),
    romashka('6208010538', 'Виленка', 2010, '22.23'),
    romashka('2631012682', 'Невинномысск', 1996, '68.20.2', { name: 'АО "РОМАШКА"' })
  ],
  bank: null, esche: {}, ogranicheniya: []
};

test('что спросить у сервера: БИК — банк, код ОКВЭД — компании, название от 3 знаков; ИНН и вопрос — нет', () => {
  assert.strictEqual(P.chtoSprosit(razbor('044525225'), '044525225'), '044525225');
  const s = '40702810400000000001 044525225';
  assert.strictEqual(P.chtoSprosit(razbor(s), s), '044525225', 'счёт + БИК — банк по БИК');
  assert.strictEqual(P.chtoSprosit(razbor('47.11'), '47.11'), '47.11');
  assert.strictEqual(P.chtoSprosit(razbor('ромашка магадан'), 'ромашка магадан'), 'ромашка магадан');
  assert.strictEqual(P.chtoSprosit(razbor('7707083893'), '7707083893'), '', 'ИНН — сразу проверка, сервер поиска не нужен');
  assert.strictEqual(P.chtoSprosit(razbor('как снять наличные?'), 'как снять наличные?'), '');
  assert.strictEqual(P.chtoSprosit(razbor('ро'), 'ро'), '');
  assert.strictEqual(P.chtoSprosit(null, 'x'), '');
});

test('строка компании: город · годы · ОКВЭД кодом (пока нет текста) · ИНН; закрытые — в конце, метки тёплые', () => {
  const r = P.otvet(razbor('ромашка'), ROMASHKI, null, 'ромашка');
  const k = r.filter((x) => x.inn);
  assert.strictEqual(k.length, 7, 'не больше семи');
  assert.strictEqual(k[0].s, nb('Москва · с 2025 · ОКВЭД 47.11 · ИНН 9727107049'));
  assert.ok(k.every((x) => x.g === 'Компании'));
  assert.ok(!k.some((x) => x.inn === '3900000001'), 'закрытая уходит в конец и за семь не попадает');
  const fil = k.findIndex((x) => x.tag === 'филиал'), bnk = k.findIndex((x) => x.tag === 'банкротство');
  assert.ok(fil > bnk || fil === k.length - 1 || fil > 3, 'филиал — после действующих головных');
  assert.strictEqual(k[bnk].warn, true); assert.strictEqual(k[fil].warn, false);
  const h = P.html(razbor('ромашка'), r, 0);
  assert.match(h, /<em class="ps-tag ps-tag--warn">банкротство<\/em>/);
  assert.match(h, /<em class="ps-tag">филиал<\/em>/);
  // с текстом вида деятельности — словами, до 38 знаков
  const t = P.stroki([romashka('9727107049', 'Москва', 2025, '47.11', { okved_tekst: 'Торговля розничная преимущественно пищевыми продуктами' })]);
  assert.strictEqual(t[0].s, nb('Москва · с 2025 · Торговля розничная преимущественно пи… · ИНН 9727107049'));
  // мусор в коде ОКВЭД не печатаем
  assert.doesNotMatch(P.stroki([romashka('9727107049', 'Москва', 2025, '<b>')])[0].s, /ОКВЭД/);
});

test('семь тёзок и одно слово — строка «допишите город»; с городом в запросе — нет', () => {
  const r = P.otvet(razbor('ромашка'), ROMASHKI, null, 'ромашка');
  const d = r.find((x) => x.dopisat);
  assert.ok(d, 'есть подсказка дописать город');
  assert.strictEqual(d.q, 'ромашка ');
  assert.strictEqual(d.t, 'Много компаний с таким названием');
  assert.ok(!P.otvet(razbor('ромашка москва'), ROMASHKI, null, 'ромашка москва').some((x) => x.dopisat));
  // разные названия — подсказки нет
  const raznye = { ponyal: { tip: 'nazvanie' }, kompanii: ROMASHKI.kompanii.map((x, i) => Object.assign({}, x, { name: 'ООО "Фирма ' + i + '"' })) };
  assert.ok(!P.otvet(razbor('фирма'), raznye, null, 'фирма').some((x) => x.dopisat));
  // порядок: компании → «допишите город» → разделы; Enter — первая компания
  const vse = P.sobrat(razbor('ромашка'), r);
  assert.strictEqual(vse[P.pervoe(vse)].inn, '9727107049');
});

test('банк по БИК: название, БИК, к/с, дата справочника; лицензию не проверяли — так и пишем', () => {
  const j = { ponyal: { tip: 'bik', znachenie: '044525225' }, kompanii: [],
    bank: { bik: '044525225', nazvanie: 'ПАО Сбербанк', korschet: '30101810400000000225', licenziya_deystvuet: null, licenziya: 'ne_provereno', data_spravochnika: '2026-11-12' } };
  const R = razbor('044525225'), r = P.otvet(R, j, null, '044525225');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].g, 'Банк по БИК'); assert.strictEqual(r[0].t, 'ПАО Сбербанк');
  assert.strictEqual(r[0].s, nb('БИК 044525225 · к/с 30101810400000000225 · справочник Банка России на 12.11.2026'));
  assert.strictEqual(r[0].tag, 'лицензию не проверяли');
  assert.ok(!P.deystvie(r[0]), 'строка банка — сведения, не действие');
  const vse = P.sobrat(R, r);
  assert.strictEqual(vse[P.pervoe(vse)].href, '/proverit-schet/', 'Enter — по-прежнему «Проверить счёт»');
  assert.strictEqual(P.bankStroka(Object.assign({}, j.bank, { licenziya_deystvuet: true })).tag, '');
  const net = P.bankStroka(Object.assign({}, j.bank, { licenziya_deystvuet: false }));
  assert.strictEqual(net.tag, 'проверьте лицензию'); assert.ok(net.warn);
  assert.strictEqual(P.bankStroka({ bik: '12', nazvanie: 'x' }), null);
});

test('ОКВЭД — своя группа; адрес — своя группа; раскладку исправил сервер — говорим', () => {
  const j = { ponyal: { tip: 'okved', znachenie: '47.11' }, kompanii: [romashka('4706040556', 'Шлиссельбург', 2019, '47.11', { name: 'ООО "ФИА"' })] };
  const r = P.otvet(razbor('47.11'), j, null, '47.11');
  assert.strictEqual(r[0].g, 'Компании с этим видом деятельности');
  const vse = P.sobrat(razbor('47.11'), r);
  assert.strictEqual(vse[0].href, '/reyting/', 'первое действие у кода — прежнее');
  const a = P.otvet(razbor('москва тверская 7'), { ponyal: { tip: 'adres' }, kompanii: j.kompanii }, null, 'москва тверская 7');
  assert.strictEqual(a[0].g, 'Компании по адресу');
  const s = P.otvet(razbor('сбербанк'), { ponyal: { tip: 'nazvanie', ispravleno: 'сбербанк' }, kompanii: [] }, null, 'c,th,fyr');
  assert.strictEqual(s[0].t, 'Ищем «сбербанк»'); assert.strictEqual(s[0].tag, 'исправлено');
  const R = razbor('vfuybn');
  assert.strictEqual(R.vid, 'raskladka');
  assert.ok(!P.otvet(R, { ponyal: { ispravleno: 'магнит' }, kompanii: [] }, null, 'vfuybn').length, 'раскладку исправили сами — второй строки нет');
});

test('запрос: сначала /api/poisk; ошибка или обрыв — /api/suggest; у БИК запасного нет', async () => {
  const zvali = [];
  const ok = (j) => Promise.resolve({ ok: true, json: () => Promise.resolve(j) });
  const f1 = (u) => { zvali.push(u); return ok(ROMASHKI); };
  let j = await P.zapros('https://api.x', 'ромашка магадан', f1);
  assert.strictEqual(j.ponyal.tip, 'nazvanie');
  assert.deepStrictEqual(zvali, ['https://api.x/api/poisk?q=%D1%80%D0%BE%D0%BC%D0%B0%D1%88%D0%BA%D0%B0%20%D0%BC%D0%B0%D0%B3%D0%B0%D0%B4%D0%B0%D0%BD']);
  zvali.length = 0;
  const f2 = (u) => { zvali.push(u); return /poisk/.test(u) ? Promise.resolve({ ok: false, status: 404 }) : ok({ items: [{ inn: '7707083893', name: 'ПАО СБЕРБАНК', address: 'г Москва' }] }); };
  j = await P.zapros('', 'сбер', f2);
  assert.strictEqual(zvali[1], '/api/suggest?q=%D1%81%D0%B1%D0%B5%D1%80');
  assert.strictEqual(P.otvet(razbor('сбер'), j, null, 'сбер')[0].s, nb('Москва · ИНН 7707083893'));
  zvali.length = 0;
  j = await P.zapros('', '044525225', (u) => { zvali.push(u); return Promise.reject(new Error('обрыв')); });
  assert.deepStrictEqual(j, { kompanii: [] }); assert.strictEqual(zvali.length, 1);
});

test('главная и окно: оба спрашивают /api/poisk через DlkPoisk.zapros; текст запроса не в Метрику; /api/suggest — только запасной', () => {
  const g = chitat('index.html'), o = chitat('js/poisk-okno.js');
  for (const [imya, kod] of [['главная', g], ['окно', o]]) {
    assert.match(kod, /chtoSprosit\(PR, ?q\)/, imya);
    assert.match(kod, /\.zapros\((CAPI|API), ?qs, ?fetch\.bind\(window\)\)/, imya);
    assert.match(kod, /\.otvet\(PR, ?j,/, imya);
    assert.doesNotMatch(kod, /fetch\([^)]*\/api\/suggest/, imya + ': прямого /api/suggest больше нет');
    assert.match(kod, /ps-tag--warn\{color:var\(--warn/, imya + ': тёплая метка');
    assert.match(kod, /vid: ?'dopisat'|'dopisat'/, imya + ': цель — вид, без текста');
  }
  assert.doesNotMatch(chitat('js/poisk.js'), /искусствен|нейросет|лучш|гарантир|не подключено/i);
});

test('длинная метка («лицензию не проверяли») — под текстом, не поверх строки', () => {
  const b = P.bankStroka({ bik: '044525225', nazvanie: 'ПАО Сбербанк', korschet: '30101810400000000225', data_spravochnika: '2026-11-12' });
  assert.match(P.html(null, [b], -1), /class="ps-tag ps-tag--niz">лицензию не проверяли</);
  assert.match(P.html(null, [{ g: 'Компании', t: 'x', s: 'y', inn: '1', tag: 'ликвидирована', warn: true }], -1), /class="ps-tag ps-tag--warn">ликвидирована</);
  for (const kod of [chitat('index.html'), chitat('js/poisk-okno.js')]) assert.match(kod, /ps-tag--niz\{position:static/);
});

test('без DlkImya (окно на других страницах) — прямые кавычки становятся «ёлочками», регистр тот же', () => {
  assert.strictEqual(P.stroki([romashka('9727107049', 'Москва', 2025, '47.11')])[0].t, 'ООО «РОМАШКА»');
  assert.strictEqual(P.stroki([romashka('9727107049', 'Москва', 2025, '47.11', { name: 'ПАО СБЕРБАНК' })])[0].t, 'ПАО СБЕРБАНК');
});

test('вложенные кавычки без DlkImya не переворачиваем', () => {
  const n = 'МБДОУ "ДЕТСКИЙ САД "РОМАШКА" П. ЯГОДНОЕ"';
  assert.strictEqual(P.stroki([{ inn: '4908006646', name: n }])[0].t, n);
});
