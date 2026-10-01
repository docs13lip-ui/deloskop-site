// Технические правки SEO (п. 32, 26.09.2026): мягкая 404, старая копия /сайт/.
// Запуск: node --test tests/seo_tehnika.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');

test('главная: перехват мягкой 404 стоит первым скриптом в <head>', () => {
  const t = chitat('index.html');
  const i = t.indexOf('Мягкая 404');
  assert.ok(i > 0 && i < t.indexOf('<title>'), 'скрипт должен идти до <title> и остальных скриптов');
  assert.ok(t.includes("'/cabinet':'/cabinet.html'") && t.includes("'/report':'/report.html'"));
  assert.ok(t.includes("location.replace"));
  // karta-v1: /company/{ИНН юрлица}… без собранной карточки — на живую проверку этого ИНН; 12 цифр (ИП) — обычная 404
  assert.ok(t.includes("/^\\/company\\/(\\d{10})(?:[-\\/]|$)/") && t.includes("location.replace('/?inn='+ci[1])"));
});

test('404.html закрыта от индекса', () => {
  assert.ok(/<meta name="robots" content="noindex">/.test(chitat('404.html')));
});

test('/сайт/ — только переадресация на главную, без копии сайта', () => {
  const fayly = fs.readdirSync(path.join(KOREN, 'сайт'));
  assert.deepStrictEqual(fayly, ['index.html']);
  const t = chitat('сайт/index.html');
  assert.ok(t.includes('http-equiv="refresh" content="0; url=/"') && t.includes('rel="canonical" href="https://deloskop.ru/"'));
  assert.ok(!chitat('sitemap.xml').includes('/сайт/'));
});

test('лента: id уникальны', () => {
  const ids = JSON.parse(chitat('obnovleniya.json')).obnovleniya.map(e => e.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  // новые — первыми: номер первой записи дня не меньше остальных (без жёсткого id — иначе каждая запись ломает тест)
  assert.ok(ids.includes('2026-09-26-7'));
  const key = (id) => id.split('-').map((x) => x.padStart(4, '0')).join('-');
  for (let i = 1; i < ids.length; i++) assert.ok(key(ids[i - 1]) > key(ids[i]), ids[i - 1] + ' должен быть позже ' + ids[i]);
});

// Файл подтверждения Яндекс Вебмастера (владелец, 26.09 13:55) — лежит в корне, без подвала и скриптов.
test('подтверждение Вебмастера на месте и не тронуто сборщиком', () => {
  const f = path.join(KOREN, 'yandex_d591aeadaadcae21.html');
  assert.ok(fs.existsSync(f), 'нет yandex_d591aeadaadcae21.html — Вебмастер потеряет подтверждение');
  const t = fs.readFileSync(f, 'utf8');
  assert.ok(t.includes('Verification: d591aeadaadcae21'), 'в файле нет строки подтверждения');
  assert.ok(!t.includes('<!--podval-->') && !t.includes('<script'), 'файл подтверждения изменён сборкой');
});

// Дата и время выкладки в ленте (владелец, 26.09: «для абсолютной точности»).
test('лента: время выкладки ЧЧ:ММ у выложенных записей, отрисовка «…, ЧЧ:ММ МСК»', () => {
  const list = JSON.parse(chitat('obnovleniya.json')).obnovleniya;
  for (const e of list) if (e.vremya !== undefined) assert.match(e.vremya, /^([01]\d|2[0-3]):[0-5]\d$/, e.id);
  // записи, уже бывшие на живом сайте, — со временем слияния в main (git, МСК)
  const byId = Object.fromEntries(list.map((e) => [e.id, e.vremya]));
  assert.strictEqual(byId['2026-09-26-5'], '10:25');
  assert.strictEqual(byId['2026-09-25-1'], '23:48');
  for (const f of ['obnovleniya.js', 'obnovleniya/index.html']) {
    const s = chitat(f);
    assert.match(s, /" МСК"/, f);
    assert.match(s, /<time datetime="/, f);
  }
});

test('robots.txt: кабинет, админка и страницы счетов закрыты; ?ref= склеивается (п. 72 д)', () => {
  const r = fs.readFileSync(path.join(__dirname, '..', 'robots.txt'), 'utf8');
  for (const d of ['Disallow: /cabinet.html', 'Disallow: /admin.html', 'Disallow: /schet/dokument/', 'Clean-param: ref /', 'Sitemap: https://deloskop.ru/sitemap.xml'])
    assert.ok(r.includes(d), 'нет строки ' + d);
  assert.ok(!/Disallow: \/\s*$/m.test(r), 'сайт целиком закрыт');
});

// nastoyashij-404-v1 (01.10.2026): с выключенным SPA Fallback в Timeweb сервер отдаёт 404.html с кодом 404
// по запрошенному адресу — 404.html сама ведёт короткие адреса и /company/{ИНН юрлица}, как главная.
const vm = require('vm');
function marshrut(fayl, put) {
  const t = chitat(fayl);
  const m = /<script>\/\* (?:Мягкая|Настоящая) 404[\s\S]*?\*\/([\s\S]*?)<\/script>/.exec(t);
  assert.ok(m, fayl + ': нет скрипта маршрутов 404');
  let kuda = null;
  const [p, q] = put.split('?');
  const sandbox = {
    location: { pathname: p, search: q ? '?' + q : '', hash: '', replace: u => { kuda = u; } },
    document: { createElement: () => ({}), head: { appendChild() {} } },
    encodeURIComponent,
  };
  vm.runInNewContext(m[1], sandbox);
  return kuda;
}
test('404.html: короткие адреса и карточки ведёт так же, как главная', () => {
  const sluchai = [
    ['/cabinet', '/cabinet.html'], ['/cabinet/', '/cabinet.html'], ['/report?id=7', '/report.html?id=7'],
    ['/admin', '/admin.html'], ['/company/7707083893/', '/?inn=7707083893'], ['/company/7707083893-sberbank/', '/?inn=7707083893'],
  ];
  for (const [put, zhdem] of sluchai) {
    assert.strictEqual(marshrut('404.html', put), zhdem, '404.html ' + put);
    assert.strictEqual(marshrut('index.html', put), zhdem, 'index.html ' + put);
  }
});
test('404.html: сама на себя не уводит, ИП (12 цифр) и чужие адреса остаются на «нет такой страницы»', () => {
  for (const put of ['/404.html', '/404.html?s=%2Fx', '/company/770708389312/', '/nalogi/net-takoj/', '/company/']) {
    assert.strictEqual(marshrut('404.html', put), null, put);
  }
  assert.ok(chitat('404.html').indexOf('Настоящая 404') < chitat('404.html').indexOf('<title>'));
});
