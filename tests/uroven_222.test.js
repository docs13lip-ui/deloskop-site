// [Ночные-3] uroven-222-v2: уровни Индекса и пилюли проверки — без «Высокий риск/Опасно/Надёжная» ([Право] 02.10 12:30 разд. 4).
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const NOVYE = ['Без серьёзных сигналов', 'Есть вопросы', 'Есть серьёзные сигналы', 'Много признаков риска'];

test('уровни одинаковы: методика, страница /indeks/, лист отчёта, ворота', () => {
  const m = JSON.parse(chitat('indeks/metodika-v1.json'));
  assert.deepStrictEqual(m.urovni.map((u) => u.nazvanie), NOVYE);
  assert.deepStrictEqual(m.urovni.map((u) => u.id), ['nadezhnaya', 'voprosy', 'vysokij', 'opasno'], 'id не трогаем');
  const s = chitat('indeks/index.html').match(/<script type="application\/json" id="metodika">([\s\S]*?)<\/script>/);
  assert.deepStrictEqual(JSON.parse(s[1]).urovni, m.urovni);
  const V = require(path.join(K, 'js/indeks-vorota.js'));
  assert.deepStrictEqual([80, 60, 40, 10].map((b) => V.vid({ indeks: b, polnota: 90 }).zona), NOVYE);
});

test('«Высокий риск» — только про ЗСК и Банк России, не уровень Индекса', () => {
  for (const f of ['indeks/index.html', 'indeks/metodika-v1.json', 'js/indeks-vorota.js', 'js/otchet.js', 'js/nedavnie.js', 'cabinet.html', 'index.html', 'report.html', 'delopis/index.html', 'proverit-schet/index.html']) {
    const t = chitat(f);
    let i = -1;
    while ((i = t.indexOf('Высокий риск', i + 1)) >= 0) assert.match(t.slice(Math.max(0, i - 300), i + 300), /ЗСК|Банк[а-я]* России/, f);
    assert.ok(!/['">]Опасно['"<]/.test(t), f + ': «Опасно»');
  }
});

test('пилюля проверки — по risk_level, а не risk_title API', () => {
  for (const f of ['index.html', 'report.html', 'delopis/index.html', 'proverit-schet/index.html']) {
    const t = chitat(f);
    assert.ok(!/risk_title\s*\|\|/.test(t), f);
    assert.ok(t.includes("{low:'Без серьёзных сигналов',medium:'Есть вопросы',high:'Есть серьёзные сигналы'}"), f);
  }
});

test('«Сигналов мало» нигде не осталось; в кабинете короткое «Серьёзные сигналы» — можно ([Арт-директор] 02.10 20:55)', () => {
  for (const f of ['index.html', 'report.html', 'delopis/index.html', 'proverit-schet/index.html', 'cabinet.html', 'js/nedavnie.js', 'js/portfel.js', 'js/otchet.js']) {
    assert.ok(!chitat(f).includes('Сигналов мало'), f);
  }
  assert.ok(chitat('js/nedavnie.js').includes("high: 'Есть серьёзные сигналы'"));
});

test('/indeks/: title по [Право] и [Маркетингу], без «надёжн»', () => {
  const t = chitat('indeks/index.html');
  assert.ok(t.includes('<title>Индекс Делоскопа: признаки риска компании — методика v1.0</title>'));
  assert.ok(!/над[её]жн/i.test(t));
});
