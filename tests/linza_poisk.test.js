// poisk-v2-c (13.11.2026): «Линза поиска» на главной — два кольца сходятся по мере ввода (js/linza-poisk.js).
// Правила Арт-директора 13.11: холст только в своём блоке; вне экрана 0 кадров; «уменьшить движение» — статичный кадр;
// цвета — токены ДС; DPR ≤ 1,6; запасной CSS-кадр; бюджет пакета ≤ 12 КБ gzip; ни текст, ни ИНН никуда не уходят.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const KOREN = path.join(__dirname, '..');
const chitat = (p) => fs.readFileSync(path.join(KOREN, p), 'utf8');
const L = require('../js/linza-poisk.js');
const P = require('../js/poisk.js');

test('состояния: ждёт / ввод / распознано / опечатка — из того же разбора, что строка', () => {
  const s = (q) => L.sostoyanie(q.trim() ? P.razobrat(q, []) : null, q);
  assert.deepStrictEqual(s(''), { sost: 'zhdet', F: 0 });
  assert.deepStrictEqual(s('   '), { sost: 'zhdet', F: 0 });
  assert.strictEqual(s('7707').sost, 'vvod', 'не хватает цифр — ещё печатает, не опечатка');
  assert.strictEqual(s('77070838931').sost, 'vvod', '11 цифр по дороге к ОГРН или счёту — не опечатка');
  assert.strictEqual(s('магни').sost, 'vvod');
  assert.strictEqual(s('7707083893').sost, 'raspoznano');
  assert.strictEqual(s('7707083893').F, 1, 'распознано — кольца сошлись');
  assert.strictEqual(s('7707083894').sost, 'opechatka', 'контрольная цифра ИНН не сходится');
  assert.ok(s('7707083894').F < 1, 'при опечатке кольца не сходятся до конца');
  const a = s('ма').F, b = s('магнит краснодар').F;
  assert.ok(a > 0 && b > a && b < 1, 'чем больше введено, тем ближе кольца: ' + a + ' → ' + b);
});

test('главная: блок .lp перед заголовком, скрыт от чтения, адрес пакета собран; загрузка — когда виден', () => {
  const h = chitat('index.html');
  const m = h.match(/<div class="lp" data-sost="zhdet" data-lp-src="(\/js\/b\/linza-poisk\.[0-9a-f]{10}\.js)" aria-hidden="true"><span class="lp__k"><\/span><canvas class="lp__gl"><\/canvas><\/div>/);
  assert.ok(m, 'нет блока линзы');
  assert.ok(fs.existsSync(path.join(KOREN, m[1])), 'пакет собран: ' + m[1]);
  assert.ok(h.indexOf(m[0]) < h.indexOf('<h1 class="hero-h1">'), 'линза — над заголовком');
  assert.strictEqual((h.match(/class="lp"/g) || []).length, 1);
  const zagr = h.slice(h.indexOf(m[0]), h.indexOf('<h1 class="hero-h1">'));
  assert.match(zagr, /IntersectionObserver/, 'пакет грузится, только когда блок на экране');
  assert.match(zagr, /requestIdleCallback/, 'и когда браузер свободен');
  assert.doesNotMatch(zagr, /<script[^>]+src=/, 'не тегом в разметке — не мешает первому экрану');
  const sb = JSON.parse(chitat('partials/sborka.json'));
  assert.deepStrictEqual(sb.pakety['linza-poisk'], ['js/linza-poisk.js']);
  assert.ok(sb.stranicy['index.html'].includes('linza-poisk'));
  assert.ok(!sb.pakety.glavnaya.includes('js/linza-poisk.js'), 'не в пакете главной — отдельно и позже');
});

test('стили: место под линзу с первого кадра (CLS 0), CSS-кадр запасной, телефон — 56 px у надзаголовка, печать — нет', () => {
  const h = chitat('index.html');
  assert.match(h, /\.lp\{position:relative;align-self:flex-start;height:clamp\([^)]*\);aspect-ratio:1\.6;/, 'высота задана заранее');
  assert.match(h, /\.lp--gl \.lp__k\{visibility:hidden\}/, 'CSS-кадр прячется только после первого кадра WebGL');
  assert.match(h, /\.lp\[data-sost=raspoznano\] \.lp__k::before/, 'CSS-кадр тоже сходится');
  assert.match(h, /\.lp\[data-sost=opechatka\] \.lp__k::after\{border-color:var\(--warn\)\}/);
  assert.match(h, /@media \(max-width:520px\)\{\.lp\{position:absolute;[^}]*height:54px;[^}]*width:86px/, 'на телефоне линза не сдвигает строку проверки');
  assert.match(h, /\.rezhim-otcheta \.lp\{display:none\}/, 'на экране отчёта — нет');
  assert.match(h, /@media print\{\.lp\{display:none!important\}\}/);
});

test('js/linza-poisk.js: ≤ 12 КБ gzip, токены ДС, reduce-motion, 0 кадров вне экрана, DPR ≤ 1,6, без сети и хранилища', () => {
  const js = chitat('js/linza-poisk.js');
  const sb = JSON.parse(chitat('partials/sborka.json'));
  const adres = chitat('index.html').match(/\/js\/b\/linza-poisk\.[0-9a-f]{10}\.js/)[0];
  const gz = zlib.gzipSync(fs.readFileSync(path.join(KOREN, adres)), { level: 9 }).length;
  assert.ok(gz <= 12 * 1024, 'пакет линзы ' + gz + ' Б gzip > 12 КБ');
  assert.ok(sb.pakety['linza-poisk'].length === 1);
  for (const t of ["'--accent'", "'--warn'", "'--bg'"]) assert.ok(js.includes(t), 'цвет из токена ' + t);
  assert.doesNotMatch(js.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-f]{6}\b/i, 'своих цветов нет');
  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(js, /if \(!redu && \(dvizh \|\| now - budil < 6000\)\) raf = /, 'при reduce-motion — один кадр; без ввода 6 с — покой');
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /cancelAnimationFrame/, 'ушёл с экрана — кадр отменён');
  assert.match(js, /Math\.min\(win\.devicePixelRatio \|\| 1, 1\.6\)/);
  assert.match(js, /premultipliedAlpha: true/, 'фон холста прозрачный — без ступеньки на краю');
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|dlkGoal|ym\(/, 'ни текст, ни ИНН никуда не уходят');
  assert.doesNotMatch(js, /position:\s*fixed|inset:\s*0/, 'холст не на весь экран');
});
