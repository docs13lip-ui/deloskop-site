// Запуск: node --test tests/inn.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const I = require('../js/inn.js');
const kor = path.join(__dirname, '..');

test('контрольные цифры ИНН — алгоритм ФНС', () => {
  assert.ok(I.ok('7707083893'), 'ИНН Сбербанка');
  assert.ok(I.ok('500100732259'), '12 цифр — верный');
  assert.ok(!I.ok('7707083894'), 'одна цифра неверна');
  assert.ok(!I.ok('500100732258'));
  assert.ok(!I.ok('77070838'));
  assert.ok(I.ok('7707 083 893'), 'пробелы не мешают');
});

test('текст ошибки: длина и опечатка — разные подсказки', () => {
  assert.strictEqual(I.oshibka('7707083893'), '');
  assert.strictEqual(I.oshibka('123'), I.DLINA);
  assert.strictEqual(I.oshibka('7707083894'), I.OPECHATKA);
  assert.match(I.OPECHATKA, /опечатка/);
});

test('главная и отчёт подключают js/inn.js до своих скриптов', () => {
  for (const f of ['index.html', 'report.html']) {
    const s = fs.readFileSync(path.join(kor, f), 'utf8');
    assert.ok(s.includes('<script src="/js/inn.js"></script>'), f + ': нет js/inn.js');
    assert.ok(s.includes('DlkInn.'), f + ': DlkInn не используется');
  }
});

test('report.html?inn= сразу ведёт на проверку, а не показывает пустую форму', () => {
  const s = fs.readFileSync(path.join(kor, 'report.html'), 'utf8');
  assert.match(s, /location\.replace\('\/\?inn='\+qinn\)/);
});

test('подпись к пеням: ставка — оценка, с датой действия и оговоркой о прошлых годах', () => {
  const t = JSON.parse(fs.readFileSync(path.join(kor, 'tarify/tarify.json'), 'utf8'));
  assert.match(t.raschet.klyuchevaya_stavka_istochnik, /действует с \d\d\.\d\d\.\d{4}/);
  for (const f of ['index.html', 'tarify/index.html']) {
    const s = fs.readFileSync(path.join(kor, f), 'utf8');
    assert.match(s, /оценка по нынешней ключевой ставке/, f);
    assert.match(s, /по давним сделкам пени выше/, f);
  }
});
