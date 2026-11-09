// nw-nasledie-v1 (09.11.2026, [Ночные запуски]) — обёртки «не переносить» (.nw, .nw-k из js/shapka.js) не меняют вид текста.
// Нашли замером в Chromium: правило «.card span{color:var(--muted);font-size:15px}» красило «115-ФЗ» и «430-р»
// в заголовках карточек серым и на 5 px мельче (/115-fz/, /nalogi/ и 4 хаба, обе темы).
// node --test tests/nw_nasledie.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const kor = path.join(__dirname, '..');
const chist = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

test('источник шапки: .nw и .nw-k наследуют цвет, кегль и начертание с !important', () => {
  const css = chist(fs.readFileSync(path.join(kor, 'partials/shapka.css'), 'utf8'));
  const m = css.match(/span\.nw,span\.nw-k\{([^}]*)\}/);
  assert.ok(m, 'нет правила span.nw,span.nw-k');
  for (const k of ['color', 'font-size', 'font-weight', 'letter-spacing']) assert.match(m[1], new RegExp(k + ':inherit!important'), k);
});

// Собранная /css/shapka.css сверяется с источником сборщиком: python3 tests/sobrat_shapku.py --check.

test('обёртки только «не переносят»: ни одно правило сайта не задаёт .nw цвет или кегль', () => {
  const plohie = [];
  const obhod = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'tests', 'b'].includes(f.name)) continue;
      const p = path.join(d, f.name);
      if (f.isDirectory()) { if (!p.includes(path.join(kor, 'company'))) obhod(p); continue; }
      if (!/\.(css|html)$/.test(f.name)) continue;
      const s = chist(fs.readFileSync(p, 'utf8'));
      const re = /([^{}]*\.nw(?:-k)?\b[^{}]*)\{([^}]*)\}/g; let m;
      while ((m = re.exec(s))) if (/(^|;)\s*(color|font-size)\s*:/.test(m[2]) && !/inherit!important/.test(m[2])) plohie.push(path.relative(kor, p) + ': ' + m[1].trim().slice(-60));
    }
  };
  obhod(kor);
  assert.deepStrictEqual(plohie, []);
});

// Всегда тёмные блоки в светлой теме: акцент #0B63E5 на #111113 — 3,5:1. Берём акцент тёмной темы #5B9BFF — 6,8:1.
test('тёмная карточка «Скорой» на /115-fz/ и ссылки в .formula на /indeks/ — акцент тёмной темы', () => {
  const fz = fs.readFileSync(path.join(kor, '115-fz/index.html'), 'utf8');
  assert.match(fz, /href="\/skoraya-115-fz\/" style="background:#111113;color:#fff"><small style="color:#5B9BFF">/);
  const ix = fs.readFileSync(path.join(kor, 'indeks/index.html'), 'utf8');
  assert.match(ix, /\.formula a\{color:#5B9BFF\}/);
});
