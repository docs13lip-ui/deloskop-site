// net-konfliktov-v1 (п. 325 Очереди): в файлах сайта нет маркеров конфликта слияния.
// 12.10 на живом /obnovleniya/ показывала «<<<<<<< HEAD» — chistka --check и сборщики этого не ловят.
// Ищем строки, которые начинаются с маркера git: 7 знаков «<», «>» или «|» и пробел, или ровно 7 «=».
// node --test tests/net_konfliktov.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const K = path.join(__dirname, '..');
const TEKST = new Set(['.html', '.htm', '.js', '.mjs', '.cjs', '.json', '.webmanifest', '.css', '.xml', '.txt', '.svg', '.py', '.md', '.yml', '.yaml', '.vcf', '.conf', '']);
const MIMO = new Set(['.git', 'node_modules', '__pycache__']);
// Маркер собираем из частей, чтобы этот файл сам себя не находил.
const ZNAK = (z) => z.repeat(7);
const MARKER = new RegExp('^(?:' + ['<', '>', '\\|'].map((z) => ZNAK(z) + '(?: |$)').join('|') + '|' + ZNAK('=') + '$)');

function fajly(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (MIMO.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fajly(p, out);
    else if (e.isFile() && TEKST.has(path.extname(e.name).toLowerCase())) out.push(p);
  }
  return out;
}

function najti(tekst) {
  const nashli = [];
  tekst.split(/\r?\n/).forEach((s, i) => { if (MARKER.test(s)) nashli.push(i + 1); });
  return nashli;
}

test('маркер узнаётся: начало, середина и конец конфликта; обычный текст — нет', () => {
  const k = [ZNAK('<') + ' HEAD', '<p>наше</p>', ZNAK('='), '<p>их</p>', ZNAK('>') + ' vykl-2010'].join('\n');
  assert.deepStrictEqual(najti(k), [1, 3, 5]);
  assert.deepStrictEqual(najti(ZNAK('|') + ' base'), [1]);
  // Похожее, но не маркер: подчёркивание заголовка, стрелки в тексте, «=» в коде.
  assert.deepStrictEqual(najti(['Заголовок', ZNAK('=') + '===', '  ' + ZNAK('<') + ' HEAD', 'a <<< b', 'x ======= y'].join('\n')), []);
});

test('в файлах сайта нет маркеров конфликта слияния', () => {
  const plohie = [];
  for (const f of fajly(K)) {
    const n = najti(fs.readFileSync(f, 'utf8'));
    if (n.length) plohie.push(path.relative(K, f) + ': строки ' + n.slice(0, 5).join(', '));
  }
  assert.deepStrictEqual(plohie, [], 'Конфликт слияния попал в файлы — решите его и пересоберите:\n' + plohie.join('\n'));
});
