// chestnyj-nol-v2 (13.11.2026): то, что осталось из ТЗ [Продукт] 13.11 09:40 после chestnyj-nol-v1 —
// «Напомнить завтра» под «Проверили не всё» (п. 2; [Право] 13.11 12:40 п. 1.1), «Индекс не выводим» (п. 7),
// «Четыре вопроса» и «Сравнение» не красят «Проверили не всё» зелёным, правило — открыто на /indeks/.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const K = path.join(__dirname, '..');
const P = require('../js/perepoverit.js');
const NB = ' ';

function otvet() {
  return { company: { inn: '7700000009', kind: 'LEGAL', name_short: 'ООО «ОБРАЗЕЦ»', status: 'ACTIVE', reg_date: '2015-03-10' },
    checked_at: '2026-11-13T09:30:00+03:00' };
}

test('«Напомнить завтра»: событие на следующий день после проверки, ответ источника не обещаем', () => {
  const s = P.srokZavtra(otvet());
  assert.strictEqual(s.napomnit, '20261114');
  assert.strictEqual(s.konec, '20261115');
  const ics = P.ics(s, Date.UTC(2026, 10, 13, 7, 0, 0)).replace(/\r\n /g, '');
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261114'));
  assert.ok(ics.includes('UID:zavtra-7700000009-20261115@deloskop.ru'));
  assert.ok(ics.includes('SUMMARY:Проверить ООО «ОБРАЗЕЦ» ещё раз: суды и приставы'));
  assert.ok(!/ответят|гарант|обязательно/i.test(ics), 'ответ источника не обещаем');
  assert.strictEqual(P.srokZavtra({}), null);
  // «Перепроверить до» (30 дней) не изменилось
  assert.strictEqual(P.srok(otvet()).napomnit, '20261212');
  assert.ok(P.ics(P.srok(otvet()), 0).includes('UID:perepoverit-7700000009-'));
});

test('кнопка стоит только под «Проверили не всё», не в компактной карточке, по клику — цель napomnit_zavtra', () => {
  const src = fs.readFileSync(path.join(K, 'js', 'usloviya.js'), 'utf8');
  assert.match(src, /zavtra = neVse && !o\.compact && PP && PP\.srokZavtra \? PP\.srokZavtra\(r\) : null/);
  assert.match(src, /data-u="zavtra">Напомнить завтра<\/button>/);
  assert.match(src, /cel\('napomnit_zavtra'\)/);
  assert.match(src, /@media print\{\.usl \.usl-zavtra\{display:none!important\}\}/);
});

test('«Четыре вопроса» и «Сравнение»: «Проверили не всё» — нейтральный тон', () => {
  assert.match(fs.readFileSync(path.join(K, 'js', 'chetyre-voprosa.js'), 'utf8'), /\/\^\(Предварительно\|Проверили не всё\)\/\.test\(v\.headline/);
  global.self = global;
  const S = require('../js/sravnenie.js');
  if (S && typeof S.yVyvod === 'function') assert.strictEqual(S.yVyvod({}, { headline: 'Проверили не всё: суды сегодня не' + NB + 'ответили', tone: 'go' }).ton, 'neutral');
  else assert.match(fs.readFileSync(path.join(K, 'js', 'sravnenie.js'), 'utf8'), /\/\^Проверили не всё\/\.test\(u\.headline/);
});

test('/indeks/: правило «суды или приставы не ответили — числа нет» открыто в методике', () => {
  const h = fs.readFileSync(path.join(K, 'indeks', 'index.html'), 'utf8');
  assert.ok(/Суды или приставы в&nbsp;этот раз не&nbsp;ответили&nbsp;— числа и&nbsp;уровня тоже нет, при(&nbsp;| )любой полноте\./.test(h));
});
