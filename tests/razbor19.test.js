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
  assert.ok(TXT.includes('Вышестоящий орган — не больше трёх календарных лет до года решения о повторной проверке'));
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

// pravo-0711 ([Ночные запуски] 07.11.2026; текст [Право · Налоговый юрист] 07.11, claude/Право_✎_п473_повторная_ВК_Разбор_41_картель_доход_07.11.md, разд. 1).
// Сверено 07.11 (consultant): п. 10 ст. 89 НК (ред. 04.08.2026); письмо ФНС от 25.07.2013 № АС-4-2/13622, разд. 3 — «может быть проверен период, превышающий три календарных года».
test('п. 473: врезка «Какой год закрывается» — 2023 год закрывается с 2027-го, кроме уточнёнки с уменьшением', () => {
  const m = STR.match(/<div class="srok" id="kakoj-god">([\s\S]*?)<\/div>/);
  assert.ok(m, 'врезка есть');
  const v = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  assert.ok(v.includes('Какой год закрывается'));
  assert.ok(v.includes('В 2026 году вышестоящая инспекция ещё может назначить повторную проверку за 2023 год'));
  assert.ok(v.includes('С 1 января 2027 года — уже нет') && v.includes('2024–2026 годы'));
  assert.ok(v.includes('уточнённая декларация с уменьшением налога') && v.includes('даже если он старше трёх лет'));
  assert.ok(v.includes('№ АС-4-2/13622'));
  // оговорка обязательна: без неё «2023 год закрыт» шире нормы
  assert.ok(STR.indexOf('id="kakoj-god"') < STR.indexOf('class="gran"'), 'врезка — до «Где грань»');
});

test('п. 473: период — по уточнёнке проверяет та же инспекция, а не вышестоящая; FAQ и FAQPage — тот же ответ', () => {
  assert.ok(TXT.includes('По уточнёнке с уменьшением налога повторную проверку проводит инспекция, которая проверяла в первый раз'));
  assert.ok(!TXT.includes('в котором вынесено решение о повторной проверке'), 'прежней узкой формулы нет');
  const ld = STR.match(/"name": ?"За какой период возможна повторная проверка\?"[\s\S]*?"text": ?"([^"]*)"/);
  assert.ok(ld && ld[1].includes('Вышестоящий орган') && ld[1].includes('даже если он старше трёх лет'), 'FAQPage');
  assert.ok(STR.includes('cons_doc_LAW_150127'), 'письмо ФНС в «Где в законе»');
  assert.ok(/Сверено по первоисточникам: нормы\s—\s<time datetime="2026-11-07">/.test(STR), 'дата сверки норм');
});
