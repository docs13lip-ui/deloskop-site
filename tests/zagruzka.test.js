// zagruzka-v1 «Заход по ссылке без прыжков» (21.10.2026, [Ночные запуски]): страница открыта адресом отчёта (/?inn=…).
// Замер Chromium (390 px, ответ /api/check с живого): (1) в первый кадр попадала двухстрочная строка «10 проверок в день…»,
// через 100–200 мс runCheck ставил однострочную «Проверяем по реестрам…» — пример и всё ниже прыгали на 22 px (CLS 0,0174,
// в части загрузок); (2) после load в простое дорисовывался пример «Условий сделки» (+125 px в примере, который заменит отчёт; 0,0046).
'use strict';
require('./razvernut_sborku.js');
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const K = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(K, 'index.html'), 'utf8');

function skriptPosleNote() {
  const m = /<p class="note" id="note"[^>]*>([\s\S]*?)<\/p><script>([\s\S]*?)<\/script>/.exec(html);
  assert.ok(m, 'сразу за <p id="note"> — встроенный скрипт zagruzka-v1');
  return { tekst: m[1], kod: m[2] };
}

function zapusk(rezhim) {
  const { tekst, kod } = skriptPosleNote();
  const n = { textContent: tekst.replace(/&nbsp;/g, ' '), a: {}, setAttribute(k, v) { this.a[k] = v; } };
  const document = {
    getElementById: (id) => (id === 'note' ? n : null),
    documentElement: { classList: { contains: (c) => rezhim && c === 'rezhim-otcheta' } },
  };
  vm.runInNewContext(kod, { document });
  return n;
}

test('адрес отчёта: строка под полем с первого кадра — «Проверяем по реестрам…», прежний текст — в data-def', () => {
  const n = zapusk(true);
  assert.strictEqual(n.textContent, 'Проверяем по реестрам…');
  assert.match(n.a['data-def'], /^10\sпроверок в день — бесплатно/);
});

test('обычная главная: строка под полем не меняется', () => {
  const n = zapusk(false);
  assert.match(n.textContent, /^10\sпроверок в день/);
  assert.deepStrictEqual(n.a, {});
});

test('текст первого кадра совпадает с тем, что ставит runCheck (иначе прыжок вернётся)', () => {
  // между ними может стоять только подсветка реестров zhivoj-v2 (DlkZhivoj.zhdu) — текст первого кадра тот же
  assert.match(html, /note\.textContent='Проверяем по реестрам…';(?:if\(window\.DlkZhivoj\)try\{DlkZhivoj\.zhdu\(note,v\)\}catch\(e\)\{\})?report\.classList\.add\('loading'\)/);
});

test('«Назад» возвращает прежний текст: def берётся из data-def', () => {
  assert.match(html, /var def=note\.getAttribute\('data-def'\)\|\|note\.textContent;/);
});

test('в режиме отчёта пример «Условий сделки» не дорисовывается; вернулся пример — дорисуем', () => {
  const f = /function primerUslovij\(\)\{([\s\S]*?)\n  \}/.exec(html);
  assert.ok(f, 'primerUslovij на месте');
  assert.match(f[1], /classList\.contains\('rezhim-otcheta'\)\)return;/);
  assert.ok(f[1].indexOf("rezhim-otcheta')") > f[1].indexOf("ex.hasAttribute('data-usl-gotov')"), 'проверка режима — до data-usl-gotov не ставим метку');
  assert.match(html, /function bezOtcheta\(\)\{document\.documentElement\.classList\.remove\('rezhim-otcheta'\);if\(document\.readyState==='complete'\)kogdaPrimer\(primerUslovij\);\}/);
  assert.match(html, /Portfel\.obnovit\(\)\}catch\(e\)\{\}kogdaPrimer\(primerUslovij\);\}\);\}/, 'vernutPrimer — после возврата узлов примера');
});
