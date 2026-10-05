// Разбор № 14 «Реорганизация контрагента — КС 17-П» ([Ночные запуски] 05.10.2026 07:05; текст [Право] 04.10 17:40,
// claude/Право_Разбор14_КС_17-П_реорганизация_АО_ст30_п6_ст20_04.10.md). Сверено 05.10 по consultant.ru: предмет 17-П —
// требования владельцев облигаций; обеспечение — «в течение 30 дней с даты предъявления требований» (п. 2 ст. 60 ГК).
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const S = 'reorganizaciya-kontragenta-dosrochnyj-vozvrat-ks-17-p';
const un = (s) => s.replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/&#8209;/g, '-').replace(/‑/g, '-');
const STR = un(fs.readFileSync(path.join(KOREN, 'praktika/nalogi', S, 'index.html'), 'utf8'));
const TXT = STR.replace(/<[^>]+>/g, ' ');

test('[Право] обязательное: 17-П, 24.03.2026, «должник или его правопреемник», ст. 58', () => {
  assert.ok(TXT.includes('17-П'));
  assert.ok(STR.includes('2026-03-24') && TXT.includes('24.03.2026'));
  assert.ok(TXT.includes('должник или его правопреемник'));
  assert.ok(TXT.includes('п. 5 ст. 58'));
});

test('[Право] стоп-слова: не обещаем возврат, не «суд обязан», нет ФИО заявителя', () => {
  assert.ok(!/обязан вернуть|(?<!не )гарантир|вернут досрочно|суд обязан|Пономар/i.test(TXT));
});

test('сверка 05.10: выводы 17-П — про облигации; для других долгов — «покажет практика», без «касается любого кредитора»', () => {
  assert.ok(TXT.includes('Постановление вынесено по облигациям'));
  assert.ok(TXT.includes('покажет практика'));
  assert.ok(!/касается любого кредитора|Суд учтёт/.test(TXT));
});

test('v1.1: обеспечение — «уже есть» (абз. 3) и «в течение 30 дней» (абз. 5); достаточное — п. 4; исключения', () => {
  // v1.1 ([Право · Юрист 115-ФЗ] 05.10 08:40): в п. 2 ст. 60 ГК два правила — абз. 3 «уже имеющему» и абз. 5 «в течение 30 дней»
  assert.ok(TXT.includes('если у вас уже есть достаточное обеспечение или его дадут в течение 30 дней после вашего требования'));
  assert.ok(TXT.includes('безотзывная гарантия банка, действующая на 3 месяца дольше срока обязательства (пп. 2 и 4 ст. 60 ГК РФ)'));
  assert.ok(TXT.includes('исключения, установленные законом или вашим соглашением с компанией'));
});

test('кнопка «Проверить правопреемника по ИНН» с целью razbor14_check; слежение — без обещания писем', () => {
  assert.ok(STR.includes('data-goal="razbor14_check"') && TXT.includes('Проверить правопреемника по ИНН'));
  assert.ok(!/письм[оа] при|пришлём/i.test(TXT));
});

test('входящие: изменения в ЕГРЮЛ, коды статуса, проверка перед договором ведут на разбор', () => {
  for (const f of ['nalogi/izmeneniya-egryul-kontragenta/index.html', 'nalogi/kody-statusa-egryul/index.html', 'nalogi/proverka-kontragenta-pered-dogovorom/index.html']) {
    assert.ok(fs.readFileSync(path.join(KOREN, f), 'utf8').includes('/praktika/nalogi/' + S + '/'), f);
  }
});
