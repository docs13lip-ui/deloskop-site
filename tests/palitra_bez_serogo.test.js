// palitra-ostatki-v1 (15.11.2026): сторож палитры — прежних «системных» серых и синего (#55555A, #86868B, #3A3A3C,
// #0A84FF, #F5F5F7, #D1D1D6 …) нет ни в одном исходнике сайта: ни числом в <style>, ни запасным значением var(--x,#…) в js.
// Запасное значение срабатывает, когда страница не задала токен, — тогда на экран выходил чужой серый.
// Палитра — css/ds.css: текст #0D2247 / #3A4868 / #5B6783, бумага #F5F1E6, фирменный #12305F, латунь.
// Собранные пакеты js/b/ проверяет сборщик (они повторяют исходники), их не читаем.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const K = path.join(__dirname, '..');

const PREZHNIE = ['55555A', '86868B', '3A3A3C', '6E6E73', 'A1A1A6', '1D1D1F', 'F5F5F7', 'D2D2D7', 'E5E5EA', '8E8E93',
  '636366', '48484A', '2C2C2E', '1C1C1E', 'F2F2F7', 'C7C7CC', 'D1D1D6', 'AEAEB2', '0A84FF', '007AFF', 'E8E8ED', '424245'];
const RE = new RegExp('#(' + PREZHNIE.join('|') + ')(?![0-9a-f])', 'gi');

function fajly() {
  let f;
  try { f = execSync('git -c core.quotepath=off ls-files "*.html" "*.css" "*.js" "*.svg"', { cwd: K, encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e) { f = []; }
  return f.filter((x) => !x.startsWith('js/b/') && !x.startsWith('tests/'));
}

test('прежних системных серых и синего нет в исходниках сайта', () => {
  const f = fajly();
  assert.ok(f.length > 150, 'файлов ' + f.length);
  const najdeno = [];
  for (const x of f) {
    const s = fs.readFileSync(path.join(K, x), 'utf8');
    const m = s.match(RE);
    if (m) najdeno.push(x + ': ' + [...new Set(m)].join(' '));
  }
  assert.deepStrictEqual(najdeno, [], 'прежние цвета:\n' + najdeno.join('\n'));
});

test('выключенная лампа светофора в отчёте — тёмно-синяя палитры, яркие лампы на месте', () => {
  const s = fs.readFileSync(path.join(K, 'report.html'), 'utf8');
  assert.match(s, /\.lights i\{[^}]*background:#2A3B5F/);
  assert.match(s, /\.lights \.y\.on\{background:#F5B82E\}/);
});
