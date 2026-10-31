'use strict';
// vv-tochno-v1 ([Ночные запуски] 31.10.2026): на /vse-vozmozhnosti/ нет обещаний, которые ТЗ схемы А снимает
// (claude/Продукт_ТЗ_главная_схема_А_30.10.md, разд. 3 и 4): «можно работать или нет» (Ж1 [Право]),
// «сверены юристом» ([Право] 30.10), вход «через ВКонтакте или Яндекс» (в кабинете сейчас вход по коду на почту).
// Проверяет и источник (partials/vitrina.json), и собранную страницу.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const V = JSON.parse(fs.readFileSync(path.join(K, 'partials/vitrina.json'), 'utf8'));
const S = fs.readFileSync(path.join(K, 'vse-vozmozhnosti/index.html'), 'utf8');
const tekst = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-').replace(/\s+/g, ' ');
const NELZYA = [[/можно работать или нет/i, 'Ж1 [Право]'], [/обезопас/i, '38-ФЗ'], [/сверены юристом/i, '[Право] 30.10'],
  [/Работать можно/, 'Ж1'], [/через ВКонтакте или Яндекс/i, 'в кабинете вход по коду на почту'], [/открытая бета/i, 'бета закрыта 12.10']];

test('vitrina.json: снятые обещания не возвращаются', () => {
  const t = JSON.stringify(V);
  for (const [re, pochemu] of NELZYA) assert.ok(!re.test(t), pochemu + ': ' + (t.match(re) || [''])[0]);
});

test('/vse-vozmozhnosti/: снятые обещания не возвращаются', () => {
  const t = tekst(S.slice(S.indexOf('<main'), S.indexOf('</main>')));
  for (const [re, pochemu] of NELZYA) assert.ok(!re.test(t), pochemu + ': ' + (t.match(re) || [''])[0]);
});

test('/vse-vozmozhnosti/: формулировки ТЗ на месте (разд. 3)', () => {
  const t = tekst(S);
  for (const f of ['Итог одной строкой: что найдено, насколько полна проверка и что сделать',
    'Ориентир предоплаты — или почему сумму не считаем, и какие документы запросить',
    'У каждого шага — основание: норма закона с датой редакции',
    'Вход по коду на почту — без пароля',
    'Досье сделки: проверка, Паспорт, договор — в одном месте']) assert.ok(t.includes(f), 'нет: ' + f);
});

test('кабинет: вход по коду на почту — правда (строка витрины опирается на неё)', () => {
  const c = fs.readFileSync(path.join(K, 'cabinet.html'), 'utf8').replace(/&nbsp;| /g, ' ');
  assert.match(c, /пришлём на почту код/);
});
