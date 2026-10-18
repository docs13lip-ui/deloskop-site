// vizual-v2 (18.10.2026): переворот примера отчёта, «сеть связей», микродвижения формы.
// Сторож рамок ТЗ (claude/Визуал_v2_ТЗ_18.10.md): без сторонних адресов, вес, reduce-motion, без JS — как было,
// оборот собирается из тех же строк (текст не копируется), ИНН проверяет js/inn.js, тексты #note и отправку не трогаем.
// Поведение (390/1280: высота страницы при перевороте, кадр сети ≤ 1 мс, 24 точки на телефоне, reduce → 0 анимаций) —
// Chromium при сборке комплекта (КАК_ВЫЛОЖИТЬ_vizual-v2.md).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
require('./razvernut_sborku.js'); // vizual-v3.0a: главная подключает пакеты — сторож видит исходники в порядке исполнения
const path = require('path');
const zlib = require('zlib');

const K = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(K, 'css/vizual2.css'), 'utf8');
const js = fs.readFileSync(path.join(K, 'js/vizual2.js'), 'utf8');
const gl = fs.readFileSync(path.join(K, 'index.html'), 'utf8');
const pa = fs.readFileSync(path.join(K, 'pasport/index.html'), 'utf8');

function blok(s, nach) {
  const i = s.indexOf(nach);
  assert.ok(i >= 0, 'нет блока ' + nach);
  let g = 0, j = s.indexOf('{', i);
  for (let k = j; k < s.length; k++) { if (s[k] === '{') g++; else if (s[k] === '}' && --g === 0) return s.slice(j, k + 1); }
  return '';
}
const tekst = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

test('без сторонних адресов и библиотек', () => {
  assert.doesNotMatch(css, /@import|url\(/i);
  assert.doesNotMatch(js, /https?:\/\/|import\s*\(|require\(|fetch\(|XMLHttpRequest|localStorage/);
});

test('вес: css + js ≤ 15 КБ gzip, скрипт короткий', () => {
  const gz = zlib.gzipSync(css, { level: 9 }).length + zlib.gzipSync(js, { level: 9 }).length;
  assert.ok(gz <= 15 * 1024, 'gzip ' + gz);
  const kod = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+/g, ' ');
  // грубая оценка (строчные комментарии в конце строк остаются); точный замер esbuild --minify — в КАК_ВЫЛОЖИТЬ, ≤ 10 КБ
  assert.ok(Buffer.byteLength(kod) <= 15 * 1024, 'скрипт ' + Buffer.byteLength(kod));
});

test('подключение: главная и /pasport/; vizual2.css — до glubina.css (тот последним), inn.js на /pasport/ — до vizual2.js', () => {
  for (const [imya, s] of [['index.html', gl], ['pasport/index.html', pa]]) {
    const head = s.slice(0, s.indexOf('</head>'));
    assert.ok(head.includes('<script src="/js/vizual2.js" defer></script>'), imya);
    const st = head.match(/<link rel="stylesheet" href="[^"]+">/g);
    assert.strictEqual(st[st.length - 1], '<link rel="stylesheet" href="/css/glubina.css">', imya);
    assert.strictEqual(st[st.length - 2], '<link rel="stylesheet" href="/css/vizual2.css">', imya);
  }
  assert.ok(pa.indexOf('<script src="/js/inn.js" defer></script>') < pa.indexOf('<script src="/js/vizual2.js" defer></script>'));
  assert.ok(gl.includes('<script src="/js/inn.js"></script>'));
});

test('prefers-reduced-motion: без вращения и переходов; сеть — один кадр; движение кнопки — только мышь', () => {
  assert.match(js, /prefers-reduced-motion: no-preference/);
  const r = blok(css, '@media (prefers-reduced-motion:reduce)');
  assert.match(r, /\.ex-flip__in[^{]*\{transition:none\}/);
  assert.match(r, /\.ex-flip__in\.is-oborot\{transform:none\}/);
  assert.match(r, /\.ex-zad\{transform:none;visibility:hidden\}/);
  // сеть: при reduce — risovat() один раз и выход до rAF
  assert.match(js, /risovat\(\); \/\/ один кадр сразу — и единственный при reduce\n    if \(tiho\) \{/);
  assert.match(js, /if \(tiho \|\| !mysh\) return;/);
  assert.match(js, /\(hover:hover\) and \(pointer:fine\)/);
  // экономия трафика — сеть не включаем
  assert.match(js, /saveData/);
  assert.match(js, /prefers-reduced-data: reduce/);
});

test('без JS: таблетки скрыты атрибутом hidden, лицо — прежняя разметка', () => {
  const m = /<div class="ex-vid" role="tablist" aria-label="[^"]+" hidden>(.*?)<\/div>/.exec(gl);
  assert.ok(m, 'нет скрытого tablist');
  const kn = m[1].match(/<button [^>]*>[^<]+<\/button>/g);
  assert.deepStrictEqual(kn.map(tekst), ['Все факты', 'Глазами банка', 'Глазами налоговой']);
  assert.match(kn[0], /aria-selected="true"/);
  kn.slice(1).forEach((b) => { assert.match(b, /aria-selected="false" tabindex="-1"/); assert.match(b, /data-zag="Что увидит (банк|инспекция)"/); });
  assert.match(css, /\.ex-vid\[hidden\]\{display:none\}/);
  assert.match(js, /tabs\.hidden = false;/);
  // разметка лица не обёрнута в HTML — обёртку ставит скрипт
  assert.doesNotMatch(gl, /class="ex-(flip|lico|zad)/);
});

test('оборот: строки фактов те же узлы (переезжают, не копируются); у каждой строки примера — угол зрения', () => {
  const ex = gl.slice(gl.indexOf('<div class="report ex"'), gl.indexOf('<p class="ex-pod">'));
  const rows = ex.match(/<div class="row ex-r"[^>]*>/g);
  assert.strictEqual(rows.length, 3);
  rows.forEach((r) => assert.match(r, / data-vid="(bank|nalog|bank nalog)"/, r));
  assert.ok(ex.includes('data-oborot'));
  assert.doesNotMatch(js, /cloneNode|innerHTML|outerHTML|insertAdjacentHTML/);
  assert.match(js, /spis\.appendChild\(r\)/);
  // скрытая сторона — inert и aria-hidden, фокус остаётся на таблетке
  assert.match(js, /setAttribute\('inert', ''\)/);
  assert.match(js, /setAttribute\('aria-hidden', 'true'\)/);
  // клавиатура ←/→, Home/End; высота — по большей стороне
  assert.match(js, /ArrowRight/); assert.match(js, /ArrowLeft/);
  assert.match(js, /vn\.style\.minHeight = Math\.ceil\(h\) \+ 'px'/);
  assert.match(css, /\.ex-flip\{perspective:1200px/);
  assert.match(css, /transition:transform 600ms var\(--ease/);
  assert.match(css, /backface-visibility:hidden/);
});

test('настоящий отчёт: те же таблетки над «Существенными фактами», угол — по ключу факта, без новых строк', () => {
  assert.match(js, /\.report:not\(\.ex\) \.rows\.sut:not\(\.sut--svoj\)/);
  assert.match(js, /:scope > \.sut__r\[data-fakt\]/);
  assert.match(js, /!f\.closest\('\.ot-main'\)/); // после раскладки листа js/otchet.js
  assert.match(js, /MutationObserver/);
  assert.match(js, /if \(vid\.length < 2\) return;/); // ни одного угла — таблеток нет
  // подписи таблеток отчёта — из разметки примера (своих слов в скрипте нет)
  assert.match(js, /var ZAG = \[\], ZAG_ARIA = '';/);
  assert.match(js, /vse\('\.report\.ex \.ex-vid'/);
  assert.doesNotMatch(js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*$/gm, ''), /Глазами|Что увидит|Все факты/);
  // ключи фактов — из js/sushchestvennoe.js (PORYADOK и damia_*), чужих нет
  const su = fs.readFileSync(path.join(K, 'js/sushchestvennoe.js'), 'utf8');
  const por = JSON.parse(/var PORYADOK = (\[[^\]]+\])/.exec(su)[1].replace(/'/g, '"'));
  const dam = JSON.parse(/var DAMIA_PORYADOK = (\[[^\]]+\])/.exec(su)[1].replace(/'/g, '"')).map((k) => 'damia_' + k);
  for (const v of ['bank', 'nalog']) {
    const re = new RegExp(v + ': /\\^\\(([a-z_|]+)\\)\\$/').exec(js);
    assert.ok(re, v);
    re[1].split('|').forEach((k) => assert.ok(por.includes(k) || dam.includes(k), v + ': ' + k));
  }
  assert.match(js, /beforeprint/);
});

test('сеть: canvas aria-hidden, 24 точки на узком экране, 40–60 на широком, не больше 2 нитей на точку, нити ближе 140 px', () => {
  assert.match(js, /cv\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(js, /w < 560 \? 24 : Math\.max\(40, Math\.min\(60,/);
  assert.match(js, /if \(st\[p\[1\]\] > 1 \|\| st\[p\[2\]\] > 1\) continue;/);
  assert.match(js, /r2 < 19600/); // 140²
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /visibilitychange/);
  assert.match(js, /devicePixelRatio/);
  assert.match(js, /\* 12; \/\/ ±6 px/);
  assert.match(js, /for \(var i = 0; i < 12; i\+\+\)/); // 12 точек к полю
  assert.match(js, /\/ 400\)/); // 400 мс
  assert.ok(gl.includes('<section class="hero" data-set data-set-pole="inn">'));
  assert.ok(pa.includes('<section id="landing" data-set data-set-pole="innTop">'));
  assert.match(css, /\.set\{[^}]*z-index:-1;pointer-events:none/);
});

test('форма: полоска 10/12 долей, контрольная цифра — DlkInn.ok из js/inn.js (своей проверки нет), на буквы полоски нет', () => {
  assert.match(js, /W\.DlkInn \? W\.DlkInn\.ok\(c\) : null/);
  assert.doesNotMatch(js, /\[2, 4, 10, 3, 5, 9, 4, 6, 8\]|% 11/);
  assert.match(js, /var L = c\.length > 10 \? 12 : 10;/);
  assert.match(js, /\/\[\^\\d\\s-\]\/\.test\(v\)/);
  assert.match(css, /\.is-inn-ok \.inn-pol i\{background:var\(--ok/);
  assert.match(css, /\.is-inn-ne \.inn-pol i\{background:var\(--warn/);
  assert.match(css, /box-shadow:0 0 0 4px var\(--accent-soft/);
  // логику отправки и тексты #note не трогаем
  const kod = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*$/gm, '');
  assert.doesNotMatch(kod, /addEventListener\('submit'|\.submit\(|getElementById\('note'\)|#note|textContent = .*note/);
  // магнит: не дальше 24 px, сдвиг до 4 px
  assert.match(js, /> 24\)/);
  assert.match(js, /\* 4\)\.toFixed\(2\)/);
});

test('публичные тексты: без «!», цен и упоминаний ИИ', () => {
  const vid = /<div class="ex-vid"[\s\S]*?<\/div>/.exec(gl)[0];
  const ln = JSON.parse(fs.readFileSync(path.join(K, 'obnovleniya.json'), 'utf8')).obnovleniya.find((x) => x.id === '2026-10-18-201');
  assert.ok(ln, 'нет записи ленты');
  const t = [tekst(vid), ln.zagolovok].concat(ln.chto_novogo).join(' ');
  assert.doesNotMatch(t, /!|₽|\bруб|\bИИ\b|нейросет|искусственн/i);
});
