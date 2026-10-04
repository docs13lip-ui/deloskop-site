// tipografika-proverka-v1 (05.10.2026, [Ночные-3]): экран проверки — суммы в строках фактов с разрядами,
// проценты в выводах — через неразрывный пробел («10 %»), как во всём экране (Дизайн_система_v1: неразрывные пробелы).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const S = require('../js/sushchestvennoe.js');
const NB = '\u00a0';

test('razryady: целое из 5+ цифр перед «₽» — с разрядами', () => {
  assert.strictEqual(S.razryady('2000000 ₽ за 2025 год'), '2' + NB + '000' + NB + '000 ₽ за 2025 год');
  assert.strictEqual(S.razryady('недоимка 32000' + NB + '₽'), 'недоимка 32' + NB + '000' + NB + '₽');
  assert.strictEqual(S.razryady('Штрафы: 25 000 ₽'), 'Штрафы: 25 000 ₽');
  assert.strictEqual(S.razryady('1234 ₽'), '1234 ₽', 'четыре цифры не трогаем');
});

test('razryady: дроби, номера и числа без «₽» не трогаем', () => {
  assert.strictEqual(S.razryady('1,25000 ₽'), '1,25000 ₽');
  assert.strictEqual(S.razryady('№ 123456'), '№ 123456');
  assert.strictEqual(S.razryady('ИНН 7707083893, 14 компаний'), 'ИНН 7707083893, 14 компаний');
  assert.strictEqual(S.razryady(null), '');
});

test('строка факта из ответа API выводится с разрядами', () => {
  const r = { checked_at: '2026-10-05T02:30:00+03:00', company: { inn: '7707083893', kind: 'LEGAL', status: 'ACTIVE' },
    signals: [{ title: 'Уплаченные налоги и взносы', status: 'ok', detail: '2000000 ₽ за 2025 год', source: 'ФНС', as_of: '2026-09-25' }] };
  const f = S.fakty(r);
  const vse = f.spisok.concat(f.eshche);
  const nal = vse.filter(function (x) { return /налоги/.test(x.nazv); })[0];
  assert.ok(nal, 'строки налогов нет');
  assert.strictEqual(nal.znach, '2' + NB + '000' + NB + '000 ₽ за 2025 год');
});

test('в текстах выводов нет «10%» без пробела', () => {
  // Паспорт не трогаем: текст формулы входит в отпечаток SHA-256 — правка сломала бы сверку прежних Паспортов
  ['js/rentabelnost.js', 'js/bez-nds.js'].forEach(function (p) {
    const kod = fs.readFileSync(path.join(__dirname, '..', p), 'utf8').split('\n')
      .filter(function (s) { return !/^\s*(\/\/|\*|\/\*)/.test(s); }); // комментарии не выводятся
    kod.forEach(function (s, i) {
      const m = /['"][^'"]*(?<!\\u00a)\d%[ .)][^'"]*['"]/.exec(s);
      assert.ok(!m, p + ':' + (i + 1) + ' — процент без неразрывного пробела: ' + (m && m[0].slice(0, 80)));
    });
  });
});
