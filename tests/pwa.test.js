// pwa-v1 (12.10.2026): сайт ставится на телефон как приложение. Ворота:
// манифест и иконки, service worker не трогает API и чужие адреса, офлайн-экран самодостаточный,
// на всех собранных страницах — манифест и /js/pwa.js, подсказка «Установить» — не чаще раза в 14 дней.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');

function pngRazmer(f) {
  const b = fs.readFileSync(path.join(KOREN, f));
  assert.strictEqual(b.toString('ascii', 1, 4), 'PNG', f + ' — PNG');
  return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20);
}

test('манифест: имя, цвета дизайн-системы, standalone, иконки 192/512 и maskable, ярлыки', () => {
  const m = JSON.parse(chitat('manifest.webmanifest'));
  assert.strictEqual(m.name, 'Делоскоп');
  assert.ok(m.short_name && m.short_name.length <= 12);
  assert.strictEqual(m.display, 'standalone');
  assert.strictEqual(m.scope, '/');
  assert.ok(m.start_url.startsWith('/'));
  assert.strictEqual(m.background_color, '#F5F5F2');
  assert.strictEqual(m.theme_color, '#F5F5F2');
  const nuzhno = { 'any 192x192': 0, 'any 512x512': 0, 'maskable 192x192': 0, 'maskable 512x512': 0 };
  for (const i of m.icons) {
    const src = i.src.replace(/^\//, '');
    assert.ok(fs.existsSync(path.join(KOREN, src)), i.src + ' есть');
    assert.strictEqual(pngRazmer(src), i.sizes, i.src + ' — размер как в манифесте');
    nuzhno[i.purpose + ' ' + i.sizes] = 1;
  }
  for (const k in nuzhno) assert.ok(nuzhno[k], 'иконка ' + k);
  const imena = m.shortcuts.map((s) => s.name);
  assert.deepStrictEqual(imena, ['Проверить ИНН', 'Слежение']);
  assert.strictEqual(pngRazmer('apple-touch-icon.png'), '180x180');
});

test('service worker: API и чужие адреса не перехватывает, данные не кэширует', () => {
  const sw = chitat('sw.js');
  assert.match(sw, /if \(url\.origin !== self\.location\.origin\) return;/, 'чужие адреса (api.deloskop.ru) — мимо');
  assert.match(sw, /if \(z\.method !== 'GET'\) return;/);
  assert.match(sw, /if \(url\.search\) return;/, 'запросы с параметрами — без кэша');
  assert.match(sw, /url\.origin \+ url\.pathname/, 'страницы — в кэше без ?inn=…');
  assert.match(sw, /NE_KESHIROVAT = \/\^\\\/\(admin/);
  assert.doesNotMatch(sw, /api\.deloskop\.ru['"]/, 'адрес API в списках кэша не встречается');
  assert.match(sw, /'\/offline\.html'/);
  // всё, что кладём заранее, существует
  const zaranee = /var ZARANEE = \[([\s\S]*?)\];/.exec(sw)[1].match(/'\/[^']+'|OFFLINE/g);
  for (const z of zaranee) {
    const f = z === 'OFFLINE' ? 'offline.html' : z.slice(2, -1);
    assert.ok(fs.existsSync(path.join(KOREN, f)), f + ' есть');
  }
});

test('офлайн-экран: самодостаточный, не индексируется, не в sitemap', () => {
  const h = chitat('offline.html');
  assert.match(h, /<h1>Нет сети&nbsp;— последние проверки ниже<\/h1>/);
  assert.match(h, /name="robots" content="noindex/);
  assert.doesNotMatch(h, /<script[^>]+src=/, 'без внешних скриптов — открывается из кэша');
  assert.doesNotMatch(h, /<link[^>]+rel="stylesheet"/, 'без внешних стилей');
  assert.doesNotMatch(h, /fetch\(|XMLHttpRequest/, 'на сервер ничего не отправляет');
  assert.doesNotMatch(chitat('sitemap.xml'), /offline\.html/);
});

test('сборщик: на всех страницах манифест и /js/pwa.js — по одному разу', () => {
  const vse = execSync('git ls-files "*.html"', { cwd: KOREN, encoding: 'utf8' }).split('\n').filter(Boolean)
    .filter((f) => !/^(admin|offline)\.html$|^partials\/|^tests\/|^сайт\/|^"|^(yandex_[0-9a-f]+|google[0-9a-f]+)\.html$/.test(f));
  assert.ok(vse.length > 50);
  for (const f of vse) {
    const t = chitat(f);
    if (!t.includes('<!--shapka-->')) continue;
    assert.strictEqual(t.split('<link rel="manifest" href="/manifest.webmanifest">').length, 2, f + ': манифест');
    assert.strictEqual(t.split('<script src="/js/pwa.js" defer></script>').length, 2, f + ': pwa.js');
    assert.ok((t.match(/name="theme-color"/g) || []).length <= 1, f + ': theme-color не дублируется');
    assert.ok((t.match(/rel="apple-touch-icon"/g) || []).length <= 1, f + ': apple-touch-icon не дублируется');
  }
  const ob = JSON.parse(chitat('partials/obolochka.json'));
  assert.ok(ob.head.includes('/js/pwa.js'), 'карточки из API — тоже с pwa.js');
  assert.ok(!/theme-color|apple-touch-icon/.test(ob.head), 'у карточек свои — в оболочку не дублируем');
});

test('подсказка «Установить»: тихо — не на первой странице, пауза 14 дней, не в приложении и не в админке', () => {
  const j = chitat('js/pwa.js');
  assert.match(j, /var PAUZA = 14 \* 864e5;/);
  assert.match(j, /if \(str < 2\) return false;/);
  assert.match(j, /display-mode: standalone/);
  assert.match(j, /DeloskopApp/, 'в приложении Android/iPhone подсказки нет');
  assert.match(j, /\^\\\/admin/);
  assert.match(j, /e\.preventDefault\(\); \/\/ своя тихая подсказка/);
  assert.match(j, /На экран „Домой“/);
  assert.doesNotMatch(j, /localStorage\.setItem\([^)]*inn/i, 'ИНН подсказка не хранит');
});
