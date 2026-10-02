// «Папка проверок» в кабинете (claude/Экосистема_удержание_02.10.md, разд. 3, [Ночные-3]): js/papka-proverok.js.
// node --test tests/papka_proverok.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const P = require('../js/papka-proverok.js');
const NB = '\u00a0';
const DEN = 864e5;
const NOW = Date.parse('2026-10-02T17:00:00Z'); // 20:00 МСК

const rows = [
  { inn: '7707083893', name: 'ПАО Сбербанк', created_at: '2026-10-02T06:00:00Z', risk_level: 'medium', report_id: 'r3' },
  { inn: '7707083893', name: 'ПАО Сбербанк', created_at: '2026-09-12T06:00:00Z', risk_level: 'low', report_id: 'r1' },
  { inn: '7707083893', name: 'ПАО Сбербанк', created_at: '2026-09-20T06:00:00Z', risk_level: 'low', report_id: null },
  { inn: '7736050003', name: 'ПАО «Газпром»', created_at: '2026-10-01T20:30:00Z', risk_level: 'high', report_id: 'g1' },
  { inn: '7702070139', name: 'Банк ВТБ (ПАО)', created_at: '2026-08-01T10:00:00Z', risk_level: 'low', report_id: 'v1' },
  { inn: '0000000000', name: 'Пример', created_at: '2026-10-02T06:00:00Z', risk_level: 'low' },
  { inn: '12345', name: 'Мусор', created_at: '2026-10-02T06:00:00Z', risk_level: 'low' },
  { inn: '7728168971', name: 'АО «Альфа-Банк»', created_at: 'не дата', risk_level: 'low' },
  null
];

test('одна строка на компанию, новые сверху; мусор, пример 0000000000 и битые даты — мимо', () => {
  const g = P.sobrat(rows);
  assert.deepStrictEqual(g.map((x) => x.inn), ['7707083893', '7736050003', '7702070139']);
  const sb = g[0];
  assert.strictEqual(sb.vse.length, 3);
  assert.deepStrictEqual(sb.vse.map((x) => x.id), ['r3', '', 'r1'], 'проверки компании — по датам, новые сверху');
  assert.strictEqual(sb.vse[0].lvl, 'medium');
});

test('«Итог изменился» — только когда две последние проверки с известным итогом разошлись', () => {
  const g = P.sobrat(rows);
  assert.deepStrictEqual(g[0].izm, { bylo: 'low', t: Date.parse('2026-09-20T06:00:00Z') });
  assert.strictEqual(g[1].izm, null, 'одна проверка — изменения нет');
  const odin = P.sobrat([
    { inn: '7707083893', created_at: '2026-10-02T06:00:00Z', risk_level: 'low' },
    { inn: '7707083893', created_at: '2026-09-02T06:00:00Z', risk_level: 'low' }]);
  assert.strictEqual(odin[0].izm, null, 'итог тот же — строки нет');
  const bez = P.sobrat([
    { inn: '7707083893', created_at: '2026-10-02T06:00:00Z', risk_level: '' },
    { inn: '7707083893', created_at: '2026-09-02T06:00:00Z', risk_level: 'low' }]);
  assert.strictEqual(bez[0].izm, null, 'последний итог не сохранён — не сравниваем');
});

test('даты — по Москве; старше 30 дней — «перед платежом перепроверьте»', () => {
  assert.strictEqual(P.data(Date.parse('2026-10-01T22:30:00Z')), '02.10.2026', '01.10 22:30 UTC — уже 2 октября в Москве');
  assert.strictEqual(P.kogda(Date.parse('2026-10-01T20:30:00Z'), NOW).t, 'последняя — вчера · 01.10.2026');
  assert.strictEqual(P.kogda(NOW - 3 * DEN, NOW).t, 'последняя — 3' + NB + 'дня назад · 29.09.2026');
  const s = P.kogda(Date.parse('2026-08-01T10:00:00Z'), NOW);
  assert.ok(s.staryj);
  assert.strictEqual(s.t, 'последняя — 01.08.2026');
  assert.strictEqual(s.pred, 'Сведения на' + NB + '01.08.2026 — перед платежом перепроверьте');
  assert.ok(P.spisok(P.sobrat(rows), NOW).includes('<p class="pp__star">Сведения на' + NB + '01.08.2026 — перед платежом перепроверьте</p>'));
});

test('разметка: светофор, «Все проверки — N» с досье на каждую дату, ИП — без лишнего, без «гарант»', () => {
  const g = P.sobrat(rows);
  const h = P.shapka(g) + P.spisok(g, NOW);
  assert.ok(h.includes('<b class="n">1</b>' + NB + '— есть серьёзные сигналы'));
  assert.ok(h.includes('По последней проверке каждой компании'));
  assert.ok(h.includes('Все проверки — 3'));
  assert.ok(h.includes('href="/report.html?id=r1">Досье на' + NB + '12.09.2026<'));
  assert.ok(h.includes('досье не сохранено'));
  assert.ok(h.includes('Итог изменился: было «Без серьёзных сигналов» · 20.09.2026'));
  assert.ok(h.includes('href="/?inn=7707083893">Проверить снова'));
  assert.ok(!h.includes('data-pp-q'), 'поиск — только от 6 компаний');
  assert.ok(!/гарант|надёжн|Сигналов мало/i.test(h));
  assert.strictEqual(P.shapka([]) + P.spisok([], NOW), '', 'пусто — пусто');
});

test('поиск по названию (ё = е) и по цифрам ИНН; от 6 компаний поле есть', () => {
  const g = P.sobrat(rows);
  assert.deepStrictEqual(P.najti(g, 'газпр').map((x) => x.inn), ['7736050003']);
  assert.deepStrictEqual(P.najti(g, '770207').map((x) => x.inn), ['7702070139']);
  assert.strictEqual(P.najti(g, '').length, 3);
  assert.ok(P.spisok([], NOW, { q: 'xyz' }).includes('Ничего не нашли'));
  const mnogo = P.sobrat(['7707083893', '7736050003', '7702070139', '7728168971', '7710140679', '7740000076'].map((inn, i) =>
    ({ inn, name: 'К' + i, created_at: new Date(NOW - i * DEN).toISOString(), risk_level: 'low' })));
  assert.ok(P.shapka(mnogo).includes('data-pp-q'));
});

test('CSV для Excel: BOM, «;», строка на проверку, ИНН текстом, кавычки экранированы, досье полным адресом', () => {
  const g = P.sobrat(rows.concat([{ inn: '7710140679', name: 'ООО "Точка; запятая"', created_at: '2026-09-01T06:00:00Z', risk_level: 'low', report_id: 'a b' }]));
  const c = P.csv(g, 'https://deloskop.ru/');
  assert.ok(c.startsWith('\ufeffДата проверки (МСК);Компания;ИНН;Итог проверки;Досье\r\n'));
  const str = c.trim().split('\r\n');
  assert.strictEqual(str.length, 1 + 6, 'шапка + 6 проверок');
  assert.strictEqual(str[1], '02.10.2026;ПАО Сбербанк;="7707083893";Есть вопросы;https://deloskop.ru/report.html?id=r3');
  assert.ok(c.includes(';"ООО ""Точка; запятая""";="7710140679";Без серьёзных сигналов;https://deloskop.ru/report.html?id=a%20b'));
  assert.ok(c.includes('20.09.2026;ПАО Сбербанк;="7707083893";Без серьёзных сигналов;\r\n'), 'без досье — пустая клетка');
  assert.strictEqual(P.imyaFajla(NOW), 'deloskop-proverki-2026-10-02.csv');
});

test('кабинет: «Папка проверок» подключена, прежний список — запасной; названия тарифов — как в tarify.json', () => {
  const h = chitat('cabinet.html');
  assert.ok(h.includes('<h2>Папка проверок</h2>'));
  assert.ok(h.includes('<script src="/js/papka-proverok.js"></script>'));
  assert.ok(h.includes('PapkaProverok.mount($(\'papka\'),rows)'));
  assert.ok(!h.includes('Мои проверки'));
  const T = JSON.parse(chitat('tarify/tarify.json'));
  const m = /var PLANS=\{([^}]*)\}/.exec(h)[1];
  const PLANS = {};
  m.replace(/(\w+):'([^']*)'/g, (_, k, v) => { PLANS[k] = v; });
  T.tarify.forEach((t) => assert.strictEqual(PLANS[t.id], t.nazvanie, 'тариф ' + t.id));
  assert.strictEqual(PLANS.business, 'Бизнес');
  assert.ok(!/Профи/.test(chitat('admin.html')), 'в админке тоже «Про»');
});
