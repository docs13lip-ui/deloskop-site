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
