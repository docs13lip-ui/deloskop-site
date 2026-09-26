// Внутренние ссылки не ведут в пустоту (п. 44, 26.09.2026).
// На сервере неизвестный адрес отдаёт главную с кодом 200 (мягкая 404) — битая ссылка не видна глазом,
// но Яндекс считает такие страницы дублями главной. Тест ловит это до выкладки: каждая ссылка /… и /…#якорь
// в HTML и каждая страница в ленте «Что нового» должны существовать в репозитории.
// Запуск: node --test tests/ssylki.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const PROPUSK = new Set(['.git', '.github', 'node_modules', 'tests', 'partials', 'сайт', '_skrinshoty_ne_vykladyvat']);

function stranicy(d = KOREN, out = []) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (PROPUSK.has(f.name)) continue;
    const p = path.join(d, f.name);
    if (f.isDirectory()) stranicy(p, out);
    else if (f.name.endsWith('.html') && !/^(yandex_|google)/.test(f.name)) out.push(p);
  }
  return out;
}

// Адрес сайта → файл в репозитории (как отдаёт Caddy: файл или папка/index.html)
function fajl(url) {
  let u;
  try { u = decodeURI(url.split('#')[0].split('?')[0]); } catch { return null; }
  const p = path.join(KOREN, u);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  const ix = path.join(p, 'index.html');
  return fs.existsSync(ix) ? ix : null;
}

const KOROTKIE = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8'); // словарь коротких адресов мягкой 404
const vnutrennyaya =(u) => u.startsWith('/') && !u.startsWith('//') && !u.startsWith('/api/');

test('все внутренние ссылки и файлы (href, src) существуют', () => {
  const bitye = [];
  for (const f of stranicy()) {
    const t = fs.readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    for (const m of t.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      const u = m[1];
      if (!vnutrennyaya(u) || u.split('#')[0].split('?')[0] === '') continue;
      if (!fajl(u)) bitye.push(path.relative(KOREN, f) + ' → ' + u);
    }
  }
  assert.deepStrictEqual(bitye, [], 'битые ссылки:\n' + bitye.join('\n'));
});

test('якоря /страница/#id ведут на существующий id', () => {
  const bitye = [];
  for (const f of stranicy()) {
    const t = fs.readFileSync(f, 'utf8');
    for (const m of t.matchAll(/\shref="(\/[^"#]*)#([^"]+)"/g)) {
      const cel = fajl(m[1]);
      if (!cel) continue; // битый адрес ловит тест выше
      const tt = fs.readFileSync(cel, 'utf8');
      // id может ставить скрипт страницы (например, #inn, #shield) — ищем имя и в разметке, и в коде
      if (!tt.includes('id="' + m[2] + '"') && !tt.includes("'" + m[2] + "'") && !tt.includes('"' + m[2] + '"'))
        bitye.push(path.relative(KOREN, f) + ' → ' + m[1] + '#' + m[2]);
    }
  }
  assert.deepStrictEqual(bitye, [], 'нет такого якоря:\n' + bitye.join('\n'));
});

test('лента «Что нового»: страницы «где посмотреть» существуют', () => {
  const lenta = JSON.parse(fs.readFileSync(path.join(KOREN, 'obnovleniya.json'), 'utf8')).obnovleniya;
  const bitye = [];
  for (const e of lenta) {
    for (const s of e.stranicy || [])
      if (vnutrennyaya(s.url) && !fajl(s.url)) bitye.push(e.id + ' → ' + s.url);
    for (const c of e.chto_proverit || []) {
      if (!c.ssylka || !vnutrennyaya(c.ssylka) || fajl(c.ssylka)) continue;
      // нарочно: проверка мягкой 404 («выдуманный адрес») и коротких адресов главной ('/cabinet' → '/cabinet.html')
      if (/выдуманн|такой страницы нет/i.test(c.tekst) || KOROTKIE.includes("'" + c.ssylka.split('?')[0] + "':")) continue;
      bitye.push(e.id + ' (что проверить) → ' + c.ssylka);
    }
  }
  assert.deepStrictEqual(bitye, [], 'в ленте ссылки на несуществующие страницы:\n' + bitye.join('\n'));
});

test('sitemap.xml: каждая страница существует и не закрыта noindex', () => {
  const sm = fs.readFileSync(path.join(KOREN, 'sitemap.xml'), 'utf8');
  const plohie = [];
  for (const [, loc] of sm.matchAll(/<loc>https:\/\/deloskop\.ru([^<]*)<\/loc>/g)) {
    const f = fajl(loc || '/');
    if (!f) { plohie.push(loc + ' — нет файла'); continue; }
    if (/<meta name="robots" content="[^"]*noindex/.test(fs.readFileSync(f, 'utf8'))) plohie.push(loc + ' — noindex');
  }
  assert.deepStrictEqual(plohie, [], plohie.join('\n'));
});
