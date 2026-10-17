// vizual-v1 (17.10.2026): «Глубина и свет», «Живой Индекс», сборка при прокрутке.
// Сторож рамок: свои css/js без сторонних адресов, движение выключается при prefers-reduced-motion,
// без JS всё видно, пороги кольца = пороги методики, стиль подключён на всех страницах сборщиком.
// Поведение в браузере (390/1280, reduce → 0 анимаций, текст страниц до/после равен) — Chromium при сборке комплекта.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

const K = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(K, 'css/glubina.css'), 'utf8');
const js = fs.readFileSync(path.join(K, 'js/zhivoj-indeks.js'), 'utf8');
const gl = fs.readFileSync(path.join(K, 'index.html'), 'utf8');
const M = JSON.parse(fs.readFileSync(path.join(K, 'indeks/metodika-v1.json'), 'utf8'));
const LINK = '<link rel="stylesheet" href="/css/glubina.css">';

function blokReduce(s) {
  const i = s.indexOf('@media (prefers-reduced-motion:reduce)');
  assert.ok(i >= 0, 'нет блока prefers-reduced-motion');
  let g = 0, j = s.indexOf('{', i);
  for (let k = j; k < s.length; k++) { if (s[k] === '{') g++; else if (s[k] === '}' && --g === 0) return s.slice(j, k + 1); }
  return '';
}

test('без сторонних адресов и библиотек', () => {
  assert.doesNotMatch(css, /@import|url\(\s*["']?https?:/i);
  assert.doesNotMatch(js, /https?:\/\/|import\s*\(|require\(/);
});

test('вес: главная + не больше 25 КБ gzip, скрипт короткий', () => {
  const gz = zlib.gzipSync(css, { level: 9 }).length + zlib.gzipSync(js, { level: 9 }).length;
  assert.ok(gz <= 25 * 1024, 'gzip ' + gz);
  // без комментариев и отступов — грубая оценка минификации (точный замер terser — в КАК_ВЫЛОЖИТЬ, ≤ 3 КБ)
  const kod = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+/g, ' ');
  assert.ok(Buffer.byteLength(kod) <= 5200, 'скрипт ' + Buffer.byteLength(kod));
});

test('prefers-reduced-motion: фон, подъём, кольцо и сборка не двигаются', () => {
  const r = blokReduce(css);
  assert.match(r, /body::before\{animation:none/);
  assert.match(r, /\.zhi__kolco\{transition:none;transform:none\}/);
  assert.match(r, /\.zhi\.is-idet\{transition:none\}/);
  assert.match(r, /\.sobir[^{]*\{animation:none;transition:none;opacity:1;transform:none\}/);
  assert.match(r, /:hover[^{]*\{transform:none\}/);
  // и скрипт при reduce не ставит классы сборки и не слушает наклон
  assert.match(js, /prefers-reduced-motion: no-preference/);
  assert.match(js, /if \(tiho \|\| !\(css \|\| io\)\) return;/);
  assert.match(js, /if \(!tiho\) \{\s*var DO/);
});

test('без JS и в старых браузерах всё видно: прятать .sobir можно только под .zhi-io или в @supports view()', () => {
  const bezSupports = css.replace(/@supports \(animation-timeline:view\(\)\)\{[\s\S]*?\n\}/, '');
  bezSupports.split('}').forEach((r) => {
    if (/\.sobir/.test(r) && /opacity:0/.test(r)) assert.match(r, /\.zhi-io \.sobir:not\(\.is-vidno\)/, r);
  });
  assert.match(js, /classList\.add\('zhi-io'\)/);
  assert.match(css, /@supports \(animation-timeline:view\(\)\)\{\n \.sobir\{animation:vstat both linear;animation-timeline:view\(\)/);
});

test('пороги кольца = пороги методики v1', () => {
  const ot = M.urovni.map((u) => u.ot).sort((a, b) => b - a); // 70, 50, 30, 1
  const m = /function zona\(n\) \{ return n >= (\d+) \? 'ok' : n >= (\d+) \? 'warn' : n >= (\d+) \? 'high' : 'bad'; \}/.exec(js);
  assert.ok(m, 'zona() не найдена');
  assert.deepStrictEqual([+m[1], +m[2], +m[3]], ot.slice(0, 3));
  // зоны на дуге 270°: граница «до N» = N / 99 × 75 % (с точностью 0,3 п.)
  const g = /\.zhi__fon\{[^}]*conic-gradient\(from 225deg,var\(--bad[^)]*\) 0 ([\d.]+)%,var\(--high[^)]*\) 0 ([\d.]+)%,var\(--warn[^)]*\) 0 ([\d.]+)%,var\(--ok[^)]*\) 0 75%/.exec(css);
  assert.ok(g, 'зоны на дуге не найдены');
  const doo = M.urovni.map((u) => u.do).sort((a, b) => a - b).slice(0, 3); // 29, 49, 69
  doo.forEach((d, i) => assert.ok(Math.abs(+g[i + 1] - d / 99 * 75) <= 0.3, d + ' → ' + g[i + 1]));
  assert.match(css, /calc\(var\(--p\)\*\.7576%\)/); // 99 → 75 %
  assert.match(css, /rotate\(calc\(45deg \+ var\(--p\)\*2\.7273deg\)\)/); // 99 → 270°
});

test('пример на главной: дуга до базы методики (72, зона «без серьёзных сигналов»), числа в центре нет — компания вымышленная', () => {
  const m = /<div class="ex-ix" data-zhi="(\d+)" data-zhi-aria="([^"]+)">/.exec(gl);
  assert.ok(m, 'нет data-zhi у примера');
  const n = +m[1];
  assert.strictEqual(n, M.shkala.baza);
  const u = M.urovni.find((x) => n >= x.ot && n <= x.do);
  assert.strictEqual(u.ton, 'green');
  assert.strictEqual(m[2], 'Шкала Индекса Делоскопа: зона «' + u.nazvanie.toLowerCase() + '»');
  assert.doesNotMatch(m[2], /\d/, 'в подписи примера нет числа');
  assert.ok(gl.includes('<div class="ex-vd ex-vd--ok"'), 'пример — в зелёной зоне');
  assert.ok(gl.includes(u.nazvanie), 'плашка уровня осталась в примере');
  // в центр кольца примера — пустой текстовый узел, докрутка пишет в пустышку {}; знак зоны рисует CSS
  assert.match(js, /kolco\(n, zona\(n\), d\.createTextNode\(''\), \{\}\)/);
  assert.match(css, /\.ex-ix \.zhi__chislo::before\{content:"";/);
  assert.ok(gl.includes('<script src="/js/zhivoj-indeks.js" defer></script>'));
  assert.strictEqual((gl.match(/ data-sobir>/g) || []).length, 3);
});

test('отчёт: зона кольца — из класса уровня (ok|warn|bad), неизвестный класс — по порогам, а не «зелёный»', () => {
  assert.match(js, /ot-ix__lv--\(ok\|warn\|bad\)\\b/);
  assert.match(js, /m \? m\[1\] : zona\(n\)/);
  // число переезжает тем же узлом — текст отчёта не меняется
  assert.match(js, /kolco\(n, m \? m\[1\] : zona\(n\), big, t\)/);
});

test('сборщик: glubina.css — последним стилем на всех страницах с шапкой и в оболочке карточек API', () => {
  let fajly;
  try { fajly = execSync('git -c core.quotepath=off ls-files "*.html"', { cwd: K, encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e) { fajly = ['index.html']; }
  let n = 0;
  for (const f of fajly) {
    const s = fs.readFileSync(path.join(K, f), 'utf8');
    if (!s.includes('<!--shapka-->')) continue;
    const head = s.slice(0, s.indexOf('</head>'));
    assert.ok(head.includes(LINK), f);
    const vse = head.match(/<link rel="stylesheet" href="[^"]+">/g);
    assert.strictEqual(vse[vse.length - 1], LINK, f + ': glubina.css не последний');
    n++;
  }
  assert.ok(n > 100, 'страниц ' + n);
  const ob = JSON.parse(fs.readFileSync(path.join(K, 'partials/obolochka.json'), 'utf8'));
  assert.ok(ob.head.includes(LINK));
});

test('стекло шапки и примера — с запасным путём', () => {
  assert.match(css, /@supports \(\(backdrop-filter:blur\(1px\)\) or \(-webkit-backdrop-filter:blur\(1px\)\)\)\{\n \.shapka\.is-scrolled\{/);
  assert.match(css, /@supports not \(\(backdrop-filter:blur\(1px\)\) or \(-webkit-backdrop-filter:blur\(1px\)\)\)\{\.report\.ex\{background:#fff\}\}/);
  assert.match(css, /@media \(hover:hover\)\{\n \.card:hover/);
  assert.match(css, /@media print\{body::before,body::after\{display:none\}/);
});
