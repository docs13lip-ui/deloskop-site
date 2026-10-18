// vizual-v3.1c (18.10.2026, [Ночные запуски]): запасной шрифт по меркам Onest — пока Onest грузится (font-display:swap),
// текст набран Arial / Roboto, растянутыми до ширины Onest (size-adjust), поэтому строки не переносятся заново при подмене (CLS).
// Множители посчитаны по средней ширине текста главной (fontTools: Onest 400/500/600 против Liberation Sans ≈ Arial и Roboto 5.1):
// Arial 400 → 102,63 %, 500 → 103,87 %, 600 (Arial Bold) → 98,40 %; Roboto 400 → 101,97 %, 500 → 102,41 %, 600 (Medium) → 103,61 %.
// Замер Chromium 18.10 (шрифты заблокированы против загруженных, 7 страниц × 1280/390): сумма |Δ высоты| 1 175 → ~300 px,
// блоков другой высоты 34 → 2; CLS главной 1280 при загрузке 0,13–0,15 → 0,001.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const fonts = fs.readFileSync(path.join(K, 'css/fonts.css'), 'utf8');
const ZAP = { 'Onest Zapas': { 400: 102.63, 500: 103.87, 600: 98.4 }, 'Onest Zapas R': { 400: 101.97, 500: 102.41, 600: 103.61 } };

function faily(d, out = []) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name), r = path.relative(K, p);
    if (f.isDirectory()) { if (!/^(\.git|node_modules|tests|js\/b|css\/b|fonts)$/.test(r)) faily(p, out); }
    else if (/\.(css|html)$/.test(f.name) && r !== 'offline.html') out.push(r);
  }
  return out;
}

test('запасные начертания: только local(), size-adjust и вертикаль по Onest (0,97 / 0,305)', () => {
  for (const [fam, w] of Object.entries(ZAP)) for (const [ves, sa] of Object.entries(w)) {
    const re = new RegExp('@font-face\\{font-family:"' + fam + '";font-style:normal;font-weight:' + ves + ';src:([^;]+);size-adjust:([\\d.]+)%;ascent-override:([\\d.]+)%;descent-override:([\\d.]+)%;line-gap-override:0%\\}');
    const m = re.exec(fonts);
    assert.ok(m, fam + ' ' + ves + ': нет начертания');
    assert.ok(/^(local\("[^"]+"\),?)+$/.test(m[1]), fam + ': только local() — запасной шрифт не скачиваем');
    assert.strictEqual(+m[2], sa);
    assert.ok(Math.abs(+m[3] - 97 / sa * 100) < 0.01 && Math.abs(+m[4] - 30.5 / sa * 100) < 0.01, fam + ' ' + ves + ': вертикаль');
  }
  assert.doesNotMatch(fonts, /font-family:"Onest Zapas[^"]*";[^}]*url\(/);
});

test('везде, где стоит Onest, следом — запасные «Onest Zapas», «Onest Zapas R»', () => {
  const plohie = [];
  for (const f of faily(K)) {
    const t = fs.readFileSync(path.join(K, f), 'utf8').replace(/@font-face\{[^}]*\}/g, '');
    for (const m of t.matchAll(/(?:font-family:|--font:|font:[^;{}]*?\/[\d.]+\s+)\s*'?Onest'?,([^;}]*)/g)) {
      if (!/^\s*['"]Onest Zapas['"],\s*['"]Onest Zapas R['"]/.test(m[1])) plohie.push(f + ': ' + m[0].slice(0, 60));
    }
  }
  assert.deepStrictEqual(plohie, []);
});
