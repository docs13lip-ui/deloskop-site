// yandex-tehnika-v1 [Ночные запуски] 11.10: техника для Яндекса из отчёта [Продукт · Яндекс] 11.10 14:40 —
// PNG-значок 120×120, SearchAction на главной, лента RSS «Разборов дел», проба заранее сжатых файлов.
// Запуск: node --test tests/yandex_tehnika.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const IKONKA = '<link rel="icon" type="image/png" sizes="120x120" href="/favicon-120.png">';
const RSS = '<link rel="alternate" type="application/rss+xml" title="Разборы дел — Делоскоп" href="/praktika/rss.xml">';

test('favicon-120.png — PNG ровно 120×120', () => {
  const b = fs.readFileSync(path.join(KOREN, 'favicon-120.png'));
  assert.strictEqual(b.slice(1, 4).toString(), 'PNG');
  assert.strictEqual(b.readUInt32BE(16), 120);
  assert.strictEqual(b.readUInt32BE(20), 120);
  assert.ok(b.length < 20000, 'значок лёгкий');
});

test('значок 120 и лента RSS — в <head> страниц со сборки шапки и в оболочке карточек из API', () => {
  const stranicy = ['index.html', 'tarify/index.html', 'praktika/index.html', 'company/index.html', 'reyting/index.html',
    'praktika/nalogi/podryadchik-ne-vystavil-schet-fakturu/index.html'];
  const karta = fs.readdirSync(path.join(KOREN, 'company')).find((d) => /^\d{10}-/.test(d));
  stranicy.push('company/' + karta + '/index.html');
  for (const f of stranicy) {
    const head = chitat(f).split('</head>')[0];
    assert.ok(head.includes(IKONKA), f + ': нет значка 120');
    assert.ok(head.includes(RSS), f + ': нет ссылки на RSS');
  }
  const ob = JSON.parse(chitat('partials/obolochka.json'));
  assert.ok(ob.head.includes(IKONKA) && ob.head.includes(RSS), 'оболочка API: тот же <head>, что у статичных карточек');
});

test('главная: WebSite с SearchAction на проверку по ИНН; не-ИНН из адреса подставляется в поле', () => {
  const html = chitat('index.html');
  const ld = JSON.parse(html.match(/<!--ld-glavnaya--><script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  const ws = ld.find((x) => x['@type'] === 'WebSite');
  assert.deepStrictEqual(ws.potentialAction, { '@type': 'SearchAction', target: 'https://deloskop.ru/?inn={search_term_string}',
    'query-input': 'required name=search_term_string' });
  assert.match(html, /new URLSearchParams\(location\.search\)\.get\('inn'\)/);
  assert.match(html, /else if\(qi&&qi\.trim\(\)\)\{input\.value=qi\.trim\(\)\.slice\(0,120\);\}/);
  assert.match(chitat('tests/sobrat_tarify.py'), /"@type": "SearchAction"/, 'сборщик главной не теряет SearchAction');
});

test('/praktika/rss.xml: по записи на каждый разбор, новые сверху, ссылки абсолютные, даты RFC 822', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const x = chitat('praktika/rss.xml');
  assert.match(x, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<rss version="2\.0"/);
  const items = x.split('<item>').slice(1);
  assert.strictEqual(items.length, D.razbory.length);
  const links = items.map((i) => i.match(/<link>(.*?)<\/link>/)[1]);
  assert.strictEqual(new Set(links).size, links.length, 'guid/link без повторов');
  for (const r of D.razbory) assert.ok(links.includes('https://deloskop.ru/praktika/' + r.razdel + '/' + r.slug + '/'), r.slug);
  const daty = items.map((i) => i.match(/<pubDate>(.*?)<\/pubDate>/)[1]);
  for (const d of daty) assert.match(d, /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} 09:00:00 \+0300$/);
  const t = daty.map((d) => Date.parse(d));
  for (let i = 1; i < t.length; i++) assert.ok(t[i - 1] >= t[i], 'новые сверху');
  for (const i of items) {
    const c = i.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)[1];
    assert.ok(c.length > 1500, 'полный текст, не анонс');
    assert.doesNotMatch(c, /(href|src)="\/(?!\/)/, 'ссылки от корня сайта — абсолютные');
  }
  assert.doesNotMatch(x, /(^|[^А-Яа-яЁё])ИИ([^А-Яа-яЁё]|$)|нейросет/);
});

test('сборщик практики собирает RSS (--check зелёный)', () => {
  execFileSync('python3', [path.join(KOREN, 'tests', 'sobrat_praktika.py'), '--check'], { cwd: KOREN });
});

test('заранее сжатые файлы: в репозитории только проба proba-szhatiya.txt(.gz)', () => {
  const lishnie = execFileSync('git', ['ls-files', '*.gz', '*.br', '*.zst'], { cwd: KOREN, encoding: 'utf8' })
    .split('\n').filter((f) => f && !f.startsWith('tests/') && f !== 'proba-szhatiya.txt.gz');
  assert.deepStrictEqual(lishnie, [], 'устаревший .gz рядом со страницей отдал бы старую версию — только через сборщик');
  const zlib = require('zlib');
  const gz = zlib.gunzipSync(fs.readFileSync(path.join(KOREN, 'proba-szhatiya.txt.gz'))).toString();
  assert.match(gz, /отдал файл \.gz/);
  assert.match(chitat('proba-szhatiya.txt'), /отдал ИСХОДНЫЙ файл/);
});
