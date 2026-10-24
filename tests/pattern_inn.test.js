// pattern-inn-v1 (23.10.2026, [Ночные запуски]): поле ИНН на /tarify/ с 26.09 не принимало ни один ИНН —
// сборщик tests/sobrat_tarify.py писал pattern="\d{10}|\d{12}" внутри f-строки, и Python съедал фигурные
// скобки: на живом было pattern="\d10|\d12" (браузер ждал «7707083893» как «цифра + 10»). Кнопка «Проверить»
// на странице тарифов молча отказывала. Сторож: каждый pattern в HTML сайта — рабочее регулярное выражение
// (как его собирает браузер: ^(?:…)$ с флагом v), а поле ИНН принимает настоящие ИНН и отвергает мусор.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const PROPUSK = new Set(['node_modules', '.git', 'tests', 'js', 'css', 'img', 'fonts', 'partials', 'сайт']);

function html(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!PROPUSK.has(e.name) && !e.name.startsWith('.')) html(path.join(dir, e.name), out); }
    else if (e.name.endsWith('.html')) out.push(path.join(dir, e.name));
  }
  return out;
}

const raz = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const polya = [];
for (const f of html(KOREN)) {
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/<input\b[^>]*>/g)) {
    const p = m[0].match(/\bpattern="([^"]*)"/);
    if (!p) continue;
    const imya = (m[0].match(/\bname="([^"]*)"/) || [])[1] || '';
    const ph = (m[0].match(/\bplaceholder="([^"]*)"/) || [])[1] || '';
    polya.push({ fajl: path.relative(KOREN, f), pattern: raz(p[1]), inn: imya === 'inn' || /ИНН/.test(ph) });
  }
}

test('pattern: на сайте есть поля с проверкой ввода (сторож видит страницы)', () => {
  assert.ok(polya.length >= 20, 'найдено полей с pattern: ' + polya.length);
  assert.ok(polya.some(p => p.fajl === path.join('tarify', 'index.html')), '/tarify/ без поля ИНН');
});

test('pattern: каждое выражение собирается браузером (^(?:…)$, флаг v)', () => {
  for (const p of polya) assert.doesNotThrow(() => new RegExp('^(?:' + p.pattern + ')$', 'v'), p.fajl + ': ' + p.pattern);
});

test('pattern: поле ИНН принимает 10 и 12 цифр, отвергает 9, 11 и буквы', () => {
  const inn = polya.filter(p => p.inn);
  assert.ok(inn.length >= 20, 'полей ИНН: ' + inn.length);
  for (const p of inn) {
    const re = new RegExp('^(?:' + p.pattern + ')$', 'v');
    assert.ok(re.test('7707083893'), p.fajl + ': не принимает ИНН организации — pattern="' + p.pattern + '"');
    if (/12/.test(p.pattern)) assert.ok(re.test('500100732259'), p.fajl + ': не принимает 12 цифр — ' + p.pattern);
    for (const plohoj of ['770708389', '77070838931', '77070838 3', 'ИНН7707083'])
      assert.ok(!re.test(plohoj), p.fajl + ': принимает «' + plohoj + '» — ' + p.pattern);
  }
});

test('pattern: ни одно поле не потеряло фигурные скобки (след f-строки Python)', () => {
  for (const p of polya) assert.ok(!/\\d\d/.test(p.pattern), p.fajl + ': ' + p.pattern + ' — похоже на \\d{N} без скобок');
});
