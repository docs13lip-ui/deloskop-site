// Разбор № 19 «Повторная выездная проверка за тот же год» ([Ночные запуски] 05.10.2026 09:05; текст [Право · Налоговый юрист]
// 05.10 08:40, claude/Право_КС17П_обеспечение_ПП1277_Разбор19_повторная_проверка_05.10.md, разд. 3). Сверено 05.10:
// garant.ru doc/413828648 (суммы 34 703 876 и 477 758 186 ₽, даты 29.12.2022, 27.05.2024, 20.06.2025, цитата ВС),
// base.garant.ru ст. 89 НК (п. 10 — «не превышающий трех календарных лет, предшествующих году… повторной»).
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const S = 'povtornaya-vyezdnaya-proverka-vs-2026';
const un = (s) => s.replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/&#8209;/g, '-').replace(/‑/g, '-');
const STR = un(fs.readFileSync(path.join(KOREN, 'praktika/nalogi', S, 'index.html'), 'utf8'));
const TXT = STR.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('акт и суммы — по тексту определения ВС', () => {
  assert.ok(TXT.includes('309-ЭС25-9697') && TXT.includes('А07-18520/2024'));
  assert.ok(STR.includes('2026-03-18') && STR.includes('2022-12-29') && STR.includes('2024-05-27') && STR.includes('2025-06-20'));
  assert.ok(TXT.includes('34 703 876 ₽') && TXT.includes('477 758 186 ₽'));
  assert.ok(TXT.includes('не следует, что подобная организация первичной выездной налоговой проверки сама по себе препятствует'));
});

test('где грань: кто, период трёх лет, без штрафа — но налог и пени; КС 5-П', () => {
  assert.ok(TXT.includes('Не больше трёх календарных лет до года, в котором вынесено решение о повторной проверке'));
  assert.ok(TXT.includes('Налог и пени платить придётся'));
  assert.ok(TXT.includes('уточнённую декларацию с уменьшением налога'));
  assert.ok(TXT.includes('№ 5-П'));
});

test('[Право] стоп-слова: не обещаем отмену, не считали частоту', () => {
  assert.ok(!/проверку можно отменить|назначают редко|гарантирует, что/i.test(TXT));
});

test('кнопка «Проверить контрагентов» с целью razbor19_check; FAQPage с 3 вопросами', () => {
  assert.ok(STR.includes('data-goal="razbor19_check"') && TXT.includes('Проверить контрагентов'));
  assert.strictEqual((STR.match(/"@type": ?"Question"/g) || []).length, 3);
});

test('входящие: статья 54.1 НК и «Проверка перед договором» ведут на разбор', () => {
  for (const f of ['nalogi/statya-54-1-nk-prostymi-slovami/index.html', 'nalogi/proverka-kontragenta-pered-dogovorom/index.html', 'praktika/nalogi/index.html', 'sitemap.xml']) {
    assert.ok(fs.readFileSync(path.join(KOREN, f), 'utf8').includes('/praktika/nalogi/' + S + '/'), f);
  }
});
