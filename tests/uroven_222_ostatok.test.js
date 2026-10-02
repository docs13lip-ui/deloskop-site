// [Ночные-2] uroven-222-ostatok-v1: «Кому вы платите» и карточки /company/ — уровни без «надёжн/высокий риск/опасно» ([Право] 02.10 12:30 разд. 4).
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');

test('«Кому вы платите»: пилюля поставщика — «сигналов мало / есть вопросы / серьёзные сигналы»', () => {
  const t = chitat('kontragenty-iz-vypiski/index.html');
  const m = t.match(/var LVL=\{([^}]*)\};/);
  assert.ok(m, 'LVL');
  assert.ok(m[1].includes("low:['low','сигналов мало']"));
  assert.ok(m[1].includes("medium:['medium','есть вопросы']"));
  assert.ok(m[1].includes("high:['high','серьёзные сигналы']"));
  for (const f of ['kontragenty-iz-vypiski/index.html', 'kontragenty-iz-vypiski/engine.js']) {
    assert.ok(!/над[её]жн|высокий риск|опасн/i.test(chitat(f)), f);
  }
});

test('карточки /company/: зоны Индекса — как уровни методики', () => {
  const py = chitat('tests/kartochka_render.py');
  const z = py.match(/z = "([^"]+)" if b >= 70 else "([^"]+)" if b >= 50 else "([^"]+)" if b >= 30 else "([^"]+)"/);
  assert.ok(z, 'строка зон в kartochka_render.py');
  const m = JSON.parse(chitat('indeks/metodika-v1.json'));
  assert.deepStrictEqual(z.slice(1), m.urovni.map((u) => u.nazvanie));
  assert.ok(!/"(Надёжная|Высокий риск|Опасно)"/.test(py));
});
