// detali-v1b (19.10.2026, [Ночные запуски]): шкала размеров шрифта и радиусов (аудит деталей 18.10, пп. 1–2).
// Размер шрифта в px — только из шкалы 12 / 13 / 15 / 17 / 20 / 24 / 32 / 48 (больше 48 — крупные заголовки и числа,
// clamp() — плавные заголовки; pt — печать). Радиус в px — 10 / 16 / 28 / 999 (+ 50 % — круги; меньше 10 — штрихи графиков).
// Замер в браузере — tests/zamer_detali.js (на 12 страницах аудита: размеров шкалы на странице ≤ 8, радиусов ≤ 6 видов).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const K = path.join(__dirname, '..');
const SHKALA = new Set([12, 13, 15, 17, 20, 24, 32, 48]);
const RADIUSY = new Set([10, 16, 28, 999]);
// печать, не экран: адреса ссылок в распечатке Паспорта и колонтитул PDF журнала
const PECHAT = new Set(['pasport/kontragent/index.html: 10.5px', 'tests/sobrat_zhurnal.py: 9px']);

function fajly() {
  return execSync('git -c core.quotepath=off ls-files', { cwd: K, encoding: 'utf8' }).split('\n')
    .filter((f) => /\.(css|html|js|py)$/.test(f) && !/^(css|js)\/b\//.test(f) && !/^tests\/(test_|.*\.test\.js$|zamer)/.test(f) && f !== 'css/vitrina.css');  // витрину ведёт vitrina-v2 (19.10)
}
function razmery(t) {
  const out = [];
  for (const m of t.matchAll(/font-size\s*:\s*([^;}"'\n]+)/g)) {
    if (/clamp\(/.test(m[1])) continue;
    for (const n of m[1].matchAll(/(?<![\d.])(\d+(?:\.\d+)?)px/g)) out.push(+n[1]);
  }
  for (const m of t.matchAll(/(?<![-\w])font\s*:\s*([^;}"'\n]+)/g)) {
    const n = m[1].match(/(?<![\d.])(\d+(?:\.\d+)?)px(?=\s*\/|\s+[A-Za-z"'v-])/);
    if (n && !/clamp\(/.test(m[1])) out.push(+n[1]);
  }
  return out;
}

test('размер шрифта в px — только из шкалы (крупнее 48 — заголовки и числа)', () => {
  const plohie = [];
  for (const f of fajly()) {
    const t = fs.readFileSync(path.join(K, f), 'utf8');
    for (const n of razmery(t)) if (n <= 48 && !SHKALA.has(n) && !PECHAT.has(f + ': ' + n + 'px')) plohie.push(f + ': ' + n + 'px');
  }
  assert.deepStrictEqual(plohie.slice(0, 20), [], 'вне шкалы: ' + plohie.length);
});

test('радиус в px — 10 / 16 / 28 / 999 (меньше 10 — штрихи)', () => {
  const plohie = [];
  for (const f of fajly()) {
    const t = fs.readFileSync(path.join(K, f), 'utf8');
    for (const m of t.matchAll(/border(?:-(?:top|bottom)-(?:left|right))?-radius\s*:\s*([^;}"'\n]+)/g))
      for (const n of m[1].matchAll(/(?<![\d.])(\d+(?:\.\d+)?)px/g)) if (+n[1] >= 10 && !RADIUSY.has(+n[1])) plohie.push(f + ': ' + n[1] + 'px');
  }
  assert.deepStrictEqual(plohie.slice(0, 20), [], 'вне шкалы: ' + plohie.length);
});

test('токены шкалы — в общем пакете (css/detali.css)', () => {
  const css = fs.readFileSync(path.join(K, 'css/detali.css'), 'utf8');
  for (const t of ['--t-12:12px', '--t-17:17px', '--t-48:48px', '--r-small:10px', '--r-inner:16px', '--r-card:28px', '--r-pill:999px']) assert.ok(css.includes(t), t);
});
