// pult-v2 (16.10.2026): экран «Сейчас» в админке — цифра → смысл → что сделать, простым языком.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../js/admin-pult.js');
const chitat = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function r(url, kod, ms) { return { url, kod, ms }; }

test('(1) страницы: все открылись быстро — зелёная, «делать ничего не нужно»', () => {
  const p = P.ocenkaStranic([r('/a', 200, 300), r('/b', 200, 800)], true);
  assert.strictEqual(p.cvet, 'ok');
  assert.strictEqual(p.cifra, '2 из 2');
  assert.match(p.smysl, /открываются/);
  assert.match(p.delat, /ничего не нужно/);
  assert.strictEqual(p.problemy.length, 0);
});

test('(2) страницы: одна не открылась — жёлтая, три и больше — красная; медленные — жёлтая', () => {
  let p = P.ocenkaStranic([r('/a', 200, 300), r('/b', 404, 100), r('/c', 200, 200)], true);
  assert.strictEqual(p.cvet, 'warn'); assert.strictEqual(p.cifra, '2 из 3'); assert.match(p.smysl, /не открылась/);
  p = P.ocenkaStranic([r('/a', 0, 15000), r('/b', 500, 100), r('/c', 503, 100), r('/d', 200, 100)], true);
  assert.strictEqual(p.cvet, 'bad'); assert.strictEqual(p.problemy.length, 3);
  p = P.ocenkaStranic([r('/a', 200, 3500), r('/b', 200, 100)], true);
  assert.strictEqual(p.cvet, 'warn'); assert.match(p.smysl, /дольше 3 с/);
});

test('(3) сервер Делоскопа не отвечает — красная, даже если страницы открываются', () => {
  const p = P.ocenkaStranic([r('/a', 200, 300)], false);
  assert.strictEqual(p.cvet, 'bad');
  assert.match(p.smysl, /Сервер Делоскопа не отвечает/);
  assert.match(p.delat, /Штаб/);
});

test('(4) проверки: пусто за неделю — серая с действием; обычный день — зелёная', () => {
  let p = P.ocenkaProverok({ checks_today: 0, checks_7d: 0 });
  assert.strictEqual(p.cvet, 'seryj'); assert.match(p.delat, /Дзен|ВК/);
  p = P.ocenkaProverok({ checks_today: 12, checks_7d: 84 });
  assert.ok(['ok', 'warn'].includes(p.cvet)); assert.match(p.smysl, /в среднем 12/);
});

test('(5) что просят и люди — цифры и фразы без жаргона; Метрика — ссылка на кабинет', () => {
  const g = P.ocenkaGolosa({ feedback_new: 3 });
  assert.strictEqual(g.cifra, '3'); assert.match(g.podpis, /новых отзыва/); assert.match(g.delat, /Отзывы и обращения/);
  const g0 = P.ocenkaGolosa({ feedback_new: 0 });
  assert.strictEqual(g0.cvet, 'seryj'); assert.match(g0.smysl, /после второй проверки/);
  const l = P.ocenkaLyudej({ active_1d: 1, users: 21 });
  assert.match(l.podpis, /^человек заходил/); assert.match(l.smysl, /21 человек/);
  assert.match(P.METRIKA_URL, /^https:\/\/metrika\.yandex\.ru\//);
});

test('(6) ни одна фраза плиток не содержит технического жаргона', () => {
  const vse = [
    P.ocenkaStranic([r('/a', 200, 300)], true), P.ocenkaStranic([r('/a', 500, 300), r('/b', 0, 1), r('/c', 404, 1)], true),
    P.ocenkaStranic([r('/a', 200, 4000)], true), P.ocenkaStranic([r('/a', 200, 300)], false), P.ocenkaStranic([], null),
    P.ocenkaProverok({ checks_today: 0, checks_7d: 0 }), P.ocenkaProverok({ checks_today: 40, checks_7d: 70 }), P.ocenkaProverok({ checks_today: 1, checks_7d: 140 }),
    P.ocenkaGolosa({ feedback_new: 2 }), P.ocenkaGolosa({}), P.ocenkaLyudej({ active_1d: 5, users: 30 })
  ];
  for (const p of vse) {
    assert.ok(P.bezZhargona(p), JSON.stringify(p));
    assert.ok(!/!/.test([p.smysl, p.delat].join(' ')), 'без восклицаний: ' + p.smysl);
    assert.ok(p.smysl && p.smysl.length > 10, 'у каждой плитки есть «что это значит»');
  }
});

test('(7) склонения и «обновлено N назад»', () => {
  assert.strictEqual(P.sklon(1, 'страница', 'страницы', 'страниц'), 'страница');
  assert.strictEqual(P.sklon(3, 'страница', 'страницы', 'страниц'), 'страницы');
  assert.strictEqual(P.sklon(11, 'страница', 'страницы', 'страниц'), 'страниц');
  assert.strictEqual(P.sek(12000), '12 секунд');
  assert.strictEqual(P.sek(61000), '1 минуту');
  assert.strictEqual(P.frazaObnovleniya({ zagolovok: 'Тест', data: '16 октября 2026', vremya: '23:17' }), 'Последнее обновление сайта: «Тест» — 16 октября 2026, 23:17.');
});

test('(8) админка: раздел «Сейчас» выше счетов, подключён admin-pult.js, старт после summary, якорь к отзывам', () => {
  const a = chitat('admin.html');
  assert.ok(a.indexOf('id="pultSek"') > 0 && a.indexOf('id="pultSek"') < a.indexOf('id="schSek"'));
  for (const id of ['plStr', 'plProv', 'plGolos', 'plLyudi', 'plKogda', 'plPovtor', 'plObn']) assert.ok(a.includes('id="' + id + '"'), id);
  assert.ok(a.includes('<script src="/js/admin-pult.js"></script>'));
  assert.ok(a.includes('DlkPult.start(API,s)'));
  assert.ok(a.includes('id="fbSek"'));
  assert.ok(/\.pult\{display:grid/.test(a) && /@media \(max-width:640px\)\{\.pult\{grid-template-columns:1fr\}/.test(a), '390 px — в столбик');
  const js = chitat('js/admin-pult.js');
  assert.ok(js.includes('"/sitemap.xml"') && js.includes('"/sitemap-companies.xml"') && js.includes('/api/health'));
  assert.ok(js.includes('method: "HEAD"') && js.includes('cache: "no-store"'), 'без кэша и без скачивания страниц');
  assert.strictEqual(P.PERIOD_MS, 300000); assert.strictEqual(P.KARTOCHEK, 20);
});

// pult-v2-api-v1 (17.10.2026): плитка «Страницы» по обходу сервера (Сторож раз в 5 минут, даже когда админка закрыта).
test('(сервер 1) свежий обход сервера — плитка из него, «без перебоев N дней»; без жаргона', () => {
  const t = Date.parse('2026-10-17T05:00:00Z');
  const j = { est: true, obhod: '2026-10-17T04:58:00Z', pervyj_obhod: '2026-10-10T04:00:00Z', poslednij_sboj: '2026-10-14T03:00:00Z',
    vsego: 92, otkrylis: 92, sred_ms: 640, server_zhiv: true, problemy: [] };
  const p = P.ocenkaServera(j, t);
  assert.strictEqual(p.cvet, 'ok');
  assert.strictEqual(p.cifra, '92 из 92');
  assert.match(p.smysl, /в среднем за 0,6 с/);
  assert.strictEqual(p.bezPereboev, 'Без перебоев — 3 дня.');
  assert.ok(P.bezZhargona(p));
});

test('(сервер 2) перебоев не было; сбой сегодня; проблемы и «сервер не отвечает» — как у браузера', () => {
  const t = Date.parse('2026-10-17T05:00:00Z');
  const baza = { est: true, obhod: '2026-10-17T04:58:00Z', pervyj_obhod: '2026-10-15T04:00:00Z', vsego: 10, sred_ms: 300, server_zhiv: true, problemy: [] };
  assert.match(P.ocenkaServera(baza, t).bezPereboev, /не было ни разу за 2 дня/);
  const p = P.ocenkaServera(Object.assign({}, baza, { poslednij_sboj: '2026-10-17T04:58:00Z',
    problemy: [{ url: 'https://deloskop.ru/tarify/', kod: 0, ms: 15000 }] }), t);
  assert.strictEqual(p.cvet, 'warn'); assert.strictEqual(p.cifra, '9 из 10');
  assert.strictEqual(p.bezPereboev, ''); // сейчас не открылась — «без перебоев» не пишем
  assert.match(P.ocenkaServera(Object.assign({}, baza, { poslednij_sboj: '2026-10-17T04:00:00Z' }), t).bezPereboev, /сегодня в 07:00 МСК/);
  assert.strictEqual(P.ocenkaServera(Object.assign({}, baza, { server_zhiv: false }), t).cvet, 'bad');
});

test('(сервер 3) обход старше 15 минут, пустой или ручки нет — null (обходит браузер)', () => {
  const t = Date.parse('2026-10-17T05:00:00Z');
  assert.strictEqual(P.ocenkaServera({ est: true, obhod: '2026-10-17T04:40:00Z', vsego: 5, problemy: [] }, t), null);
  assert.strictEqual(P.ocenkaServera({ est: false }, t), null);
  assert.strictEqual(P.ocenkaServera(null, t), null);
  assert.strictEqual(P.ocenkaServera({ est: true, obhod: '2026-10-17T04:59:00Z', vsego: 0 }, t), null);
});

test('(сервер 4) «Проверить сейчас» — всегда браузером; подпись про сервер есть в коде', () => {
  const js = chitat('js/admin-pult.js');
  assert.match(js, /obhod\(API, true\)/);
  assert.match(js, /Проверяет сервер Делоскопа сам, каждые 5 минут/);
  assert.match(js, /\/api\/admin\/pult\/stranicy/);
});
