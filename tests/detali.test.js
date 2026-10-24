// detali-v1 (18.10.2026, [Ночные запуски]): сторож деталей по аудиту Штаба (claude/Аудит_деталей_18.10_Штаб.md).
// Замер в браузере — tests/zamer_detali.js (не сторож); здесь — то, что держит результат в исходниках.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');

test('detali.css — в общем пакете «ds» (все страницы), последним', () => {
  const ds = JSON.parse(chitat('partials/sborka.json')).pakety.ds;
  assert.strictEqual(ds[ds.length - 1], 'css/detali.css');
  const css = chitat('css/detali.css');
  assert.match(css, /text-wrap:pretty/);
  assert.match(css, /\(max-width:640px\),\(pointer:coarse\)/, 'поля 44 px — на телефоне и сенсорном экране');
  assert.match(css, /\.podval li a\{display:inline-block;padding:11px 0\}/);
});

test('вкладки отчёта — 44 px, место до скрипта — под ту же высоту', () => {
  const css = chitat('css/vizual2.css');
  assert.match(css, /\.ex-vid button\{[^}]*min-height:44px/);
  assert.match(css, /\.ex-vid\[hidden\]\+\.ex-f\{margin-top:78px\}/);
});

test('строка подписей ≤ 75 знаков (38em ≈ 58ch Onest; em, а не ch: ширина «0» меняется, пока грузится шрифт — detali-v1c): /tarify/ (источник — sobrat_tarify), /skoraya-115-fz/, /reyting/', () => {
  assert.match(chitat('tests/sobrat_tarify.py'), /\.pod\{[^}]*max-width:38em/);
  assert.match(chitat('tarify/index.html'), /\.pod\{[^}]*max-width:38em/, 'сборщик тарифов не запущен');
  assert.match(chitat('skoraya-115-fz/index.html'), /\.disc\{[^}]*max-width:38em/);
  assert.match(chitat('css/reyting.css'), /\.ry-ub\{max-width:38em/);
});

test('/indeks/: подписи шкалы не меньше 12 px, после h1 — h2', () => {
  const h = chitat('indeks/index.html');
  assert.doesNotMatch(h, /font-size:11px/);
  assert.match(h, /<h2 id="bally-fns">/);
});

test('типограф: «во», «мы», «вы», «их» не висят — в статьях и в тексте из скриптов одинаково', () => {
  const s = 'Мы не ждём: вы во всём правы, их ответ и он придут.';
  const py = execFileSync('python3', ['-c', 'import sys;sys.path.insert(0,sys.argv[1]);import tipograf_statej as t;print(t.tekst(sys.stdin.read()),end="")', __dirname], { input: s, encoding: 'utf8' });
  assert.strictEqual(py, 'Мы&nbsp;не&nbsp;ждём: вы&nbsp;во&nbsp;всём правы, их&nbsp;ответ и&nbsp;он&nbsp;придут.');
  const okno = { addEventListener() {} };
  const sreda = { window: okno, document: { readyState: 'loading', addEventListener() {} }, location: { pathname: '/' }, localStorage: { getItem() {}, setItem() {} } };
  new Function('window', 'document', 'location', 'localStorage', chitat('obnovleniya.js'))(sreda.window, sreda.document, sreda.location, sreda.localStorage);
  assert.strictEqual(okno.DlkTipo.tekst(s), py.replace(/&nbsp;/g, ' '));
  assert.match(chitat('js/usloviya.js'), /window\.DlkTipo\.uzly\(box\)/, '«Условия сделки» — через ту же типографику');
});

test('detali-v1c: остаток касания и строки — крошки, источники, лента, FAQ, cookie, фильтры практики; абзацы ≤ 38em', () => {
  const css = chitat('css/detali.css');
  for (const r of ['.crumbs a,.co-krosh a{display:inline-block;padding:12px 0;margin:-12px 0}', '.u .p a,.tw td>a{display:inline-block;padding:12px 0;margin:-12px 0}', '.src li>a', 'summary{min-height:44px',
    '.pr .razd a', 'button[data-preset]', '.shapka .shapka__btn', '@media (min-width:641px) and (pointer:fine)', '.podval li a{display:inline-block;padding:1px 0;margin:-1px 0}'])
    assert.ok(css.includes(r), r);
  assert.match(css, /:where\(article,\.set-host,\.co-ogov\) :where\(p:not\(\[class\]\),ul:not\(\[class\]\)>li,ol:not\(\[class\]\)>li\)\{max-width:38em\}/);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /\d+ch\b/, 'ширина строки — в em: ch зависит от шрифта и сдвигает колонку при загрузке Onest');
  assert.match(chitat('partials/shapka.css'), /\.ck-bar \.ck-bar__b button\{flex:1 1 164px;min-height:44px/, 'кнопки cookie на телефоне — 44 px (источник — partials/shapka.css)');
});
