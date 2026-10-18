// vizual-v3.0b: сторож тёмной темы — строка в <head>, слой css/tema.css, переключатель в подвале, контраст токенов.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
require('./razvernut_sborku.js'); // yadro-v1: общие пакеты «ds» и «yadro» на всех страницах — сторож видит исходники
const path = require('path');
const { execSync } = require('child_process');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const SBORKA = JSON.parse(chitat('partials/sborka.json')).pakety;

function stranicy() {
  let f;
  try { f = execSync('git -c core.quotepath=off ls-files "*.html"', { cwd: K, encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e) { f = ['index.html']; }
  return f.map((x) => [x, chitat(x)]).filter(([, s]) => s.includes('<!--shapka-->'));
}
const STROKA = /<script>!function\(d,t\)\{try\{t=localStorage\.tema\}[^<]*<\/script>/;

test('строка темы: в <head> каждой страницы с шапкой и в оболочке карточек API, ≤ 300 байт, одна', () => {
  let n = 0;
  for (const [f, s] of stranicy()) {
    const head = s.slice(0, s.indexOf('</head>'));
    const m = head.match(new RegExp(STROKA.source, 'g'));
    assert.ok(m && m.length === 1, f + ': строка темы ' + (m ? m.length : 0));
    assert.ok(Buffer.byteLength(m[0]) - '<script></script>'.length <= 300, f + ': длиннее 300 байт');
    n++;
  }
  assert.ok(n > 100, 'страниц ' + n);
  assert.match(JSON.parse(chitat('partials/obolochka.json')).head, STROKA);
});

test('строка темы: выбор из localStorage, иначе система; ставит data-theme до отрисовки', () => {
  const kod = chitat('index.html').match(STROKA)[0].replace(/^<script>|<\/script>$/g, '');
  const progon = (ls, sistemaTemnaya) => {
    const el = { dataset: {} }, meta = { content: '#F5F5F2' };
    const ctx = { localStorage: ls, matchMedia: () => ({ matches: sistemaTemnaya }), document: { documentElement: el, querySelector: () => meta } };
    new Function('localStorage', 'matchMedia', 'document', kod)(ctx.localStorage, ctx.matchMedia, ctx.document);
    return [el.dataset.theme, meta.content];
  };
  assert.deepStrictEqual(progon({}, false), ['light', '#F5F5F2']);
  assert.deepStrictEqual(progon({}, true), ['dark', '#111113']);
  assert.deepStrictEqual(progon({ tema: 'light' }, true), ['light', '#F5F5F2']);
  assert.deepStrictEqual(progon({ tema: 'dark' }, false), ['dark', '#111113']);
  assert.deepStrictEqual(progon({ tema: 'мусор' }, true), ['dark', '#111113']);
  const brosaet = {}; Object.defineProperty(brosaet, 'tema', { get() { throw new Error('запрещено'); } });
  assert.deepStrictEqual(progon(brosaet, false), ['light', '#F5F5F2'], 'localStorage недоступен — как в системе');
});

test('слой css/tema.css: на каждой странице с шапкой (тегом или в пакете) и в оболочке', () => {
  const vPakete = (s) => [...s.matchAll(/\/css\/b\/([a-z0-9-]+)\.[0-9a-f]{10}\.css/g)].some((m) => (SBORKA[m[1]] || []).includes('css/tema.css'));
  for (const [f, s] of stranicy()) assert.ok(s.includes('<link rel="stylesheet" href="/css/tema.css">') || vPakete(s), f);
  assert.ok(JSON.parse(chitat('partials/obolochka.json')).head.includes('/css/tema.css'));
});

test('переключатель в подвале: три положения, без скрипта скрыт; логика — js/shapka.js', () => {
  const ob = JSON.parse(chitat('partials/obolochka.json'));
  const m = ob.podval.match(/<div class="tema" data-tema hidden>.*?<\/div>/);
  assert.ok(m, 'нет переключателя');
  assert.deepStrictEqual([...m[0].matchAll(/data-tema-v="(\w+)"/g)].map((x) => x[1]), ['auto', 'light', 'dark']);
  assert.match(m[0], /aria-pressed="true">Как в системе/);
  const js = chitat('js/shapka.js');
  assert.match(js, /localStorage\.removeItem\("tema"\)/);
  assert.match(js, /prefers-color-scheme: dark/);
  assert.match(js, /addEventListener\("storage"/, 'смена в другой вкладке');
  // сеть связей рисует цветом --ink: при смене темы перечитывает его и рисует кадр заново
  assert.match(chitat('js/vizual2.js'), /MutationObserver\(function \(\) \{ rgb = cvet\(\); risovat\(\); \}\)\.observe\(d\.documentElement, \{ attributes: true, attributeFilter: \['data-theme'\] \}\)/);
});

// контраст токенов тёмной темы (WCAG): текст ≥ 4,5 : 1 на поверхностях и своих плашках
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const k = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
test('контраст токенов тёмной темы', () => {
  const css = chitat('css/tema.css');
  const blok = css.slice(css.indexOf(':root[data-theme=dark]'), css.indexOf('}', css.indexOf(':root[data-theme=dark]')));
  const t = Object.fromEntries([...blok.matchAll(/(--[\w-]+):(#[0-9A-F]{6})/gi)].map((m) => [m[1], m[2]]));
  for (const fon of ['--bg', '--surface', '--surface-2']) {
    assert.ok(k(t['--ink'], t[fon]) >= 7, '--ink на ' + fon);
    for (const c of ['--ink-2', '--muted', '--accent', '--ok', '--warn', '--high', '--bad']) assert.ok(k(t[c], t[fon]) >= 4.5, c + ' на ' + fon + ': ' + k(t[c], t[fon]).toFixed(2));
  }
  for (const r of ['ok', 'warn', 'high', 'bad']) assert.ok(k(t['--' + r], t['--' + r + '-bg']) >= 4.5, r + ' на своей плашке');
  assert.ok(k(t['--on-accent'], t['--accent']) >= 4.5, 'текст кнопки');
  assert.ok(k(t['--accent'], t['--accent-soft']) >= 4.5, 'ссылка на голубой плашке');
});

test('авто-слой: цвета числом получают тёмную пару, токены и печать не трогаем', () => {
  const py = (css) => execSync('python3 -c "import sys;sys.path.insert(0,\'tests\');import tema_temnaya as T;print(T.pravila(sys.stdin.read()),end=\'\')"', { cwd: K, input: css, encoding: 'utf8' });
  assert.strictEqual(py('.a{background:#fff;color:#1D1D1F;padding:4px}'), '[data-theme=dark] .a{background:#1C1C1F;color:#F5F5F2}');
  assert.strictEqual(py('.b{background:#EAF1FD;color:#0B63E5}'), '[data-theme=dark] .b{background:#16243D;color:#5B9BFF}');
  assert.strictEqual(py('.c{background:var(--accent,#0B63E5);color:#fff}'), '[data-theme=dark] .c{color:#0B0B0C}', 'белый на фирменном → --on-accent');
  assert.strictEqual(py('.d{background:var(--surface,#fff);color:var(--ink,#1D1D1F)}'), '', 'токен с запасным — решает токен');
  assert.strictEqual(py('@media print{.e{background:#fff}}:root{--bg:#F5F5F2}'), '', 'печать и токены ДС — не трогаем');
  assert.strictEqual(py('.f{border:1px solid rgba(29,29,31,.08)}'), '[data-theme=dark] .f{border:1px solid rgba(255,255,255,0.132)}');
  assert.strictEqual(py(':root{--t:#16723F;--f:#E8F5EE}'), ':root[data-theme=dark]{--t:#4CC38A;--f:#0F2A1C}');
});

test('слой страницы: <style data-tema> — только в <head>, только под [data-theme=dark]', () => {
  let n = 0;
  for (const [f, s] of stranicy()) {
    const m = s.match(/<style data-tema>(.*?)<\/style>/s);
    if (!m) continue;
    n++;
    assert.ok(s.indexOf(m[0]) < s.indexOf('</head>'), f);
    for (const sel of m[1].replace(/\{[^{}]*\}/g, '\n').split(/\n|,/).map((x) => x.replace(/^@[^{]*\{/, '').trim()).filter(Boolean)) {
      assert.ok(/\[data-theme=dark\]/.test(sel), f + ': ' + sel);
    }
  }
  assert.ok(n >= 10, 'страниц со своим тёмным слоем ' + n);
});
