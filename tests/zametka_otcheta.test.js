// otchet-p7-v1 [Ночные запуски] 18.11: заметка к компании в отчёте по ИНН (план 18.11, разд. 5 п. 18) — та же,
// что в «Ваших контрагентах» (dlk_zametki, js/portfel.js), только в этом браузере.
// node --test tests/zametka_otcheta.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Z = require('../js/zametka-otcheta.js');
const Pf = require('../js/portfel.js');
const bezNb = (t) => String(t).replace(/\u00a0/g, ' ');

test('нет заметки — тихая кнопка «+ Заметка к компании»', () => {
  const h = bezNb(Z.html('7700000001', '', false));
  assert.match(h, /zo--pusto/);
  assert.match(h, /\+ Заметка к компании/);
  assert.ok(!/<textarea/.test(h));
});

test('есть заметка — текст экранирован, подпись «только в этом браузере», «Изменить»', () => {
  const h = bezNb(Z.html('7700000001', 'Счёт <b>до</b> 31.12', false));
  assert.match(h, /Ваша заметка/);
  assert.match(h, /Счёт &lt;b&gt;до&lt;\/b&gt; 31\.12/);
  assert.match(h, /Видна только в этом браузере/);
  assert.match(h, /data-zo-red>Изменить</);
});

test('редактор: подпись поля, 200 знаков, «Удалить» — только когда заметка есть', () => {
  const h = bezNb(Z.html('7700000001', 'x', true));
  assert.match(h, /<label class="zo__h" for="zo-t-7700000001">Заметка к компании — видна только в этом браузере\. Не пишите сюда паспортные данные и пароли\.<\/label>/);
  assert.match(h, /maxlength="200"/);
  assert.match(h, /data-zo-del/);
  assert.ok(!/data-zo-del/.test(Z.html('7700000001', '', true)));
});

test('хранилище — то же, что у списка на главной: запись через Portfel видна заметке отчёта', () => {
  const m = {}; const ls = { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } };
  Pf.zametkaZapisat(ls, '7700000001', '  договор   до 31.12 ');
  assert.strictEqual(Pf.zametkiChitat(ls)['7700000001'].z, 'договор до 31.12');
  assert.strictEqual(Pf.K_ZAMETKI, 'dlk_zametki');
  Pf.zametkaZapisat(ls, '7700000001', '');
  assert.ok(!('dlk_zametki' in m));
});

test('в сеть текст не уходит: в модуле нет fetch/XHR/sendBeacon, цель — только длина', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'js/zametka-otcheta.js'), 'utf8');
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(s));
  assert.match(s, /dlkGoal\(t, p\)/);
  assert.match(s, /\{ dlina: z\.length \}/);
});
