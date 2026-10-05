// Разбор № 20 «Подрядчик не выставил счёт-фактуру» ([Ночные запуски] 05.10.2026 11:05; текст [Право · Налоговый юрист]
// 05.10 09:07, claude/Право_ст48_личная_карта_ИП_отсрочка_банкрот_Разбор20_счёт-фактура_05.10.md, разд. 3). Акт —
// Определение СКЭС ВС РФ от 03.04.2026 № 305-ЭС25-14104 (А40-217702/2024): полный текст сверен 05.10 10:05 по копии
// klerk.ru/cdoc (суммы, даты трёх инстанций, 5 цитат — дословно); PDF vsrf.ru — за [Выкладкой] (Chrome).
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const S = 'podryadchik-ne-vystavil-schet-fakturu';
const un = (s) => s.replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/&#8209;/g, '-').replace(/‑/g, '-');
const STR = un(fs.readFileSync(path.join(KOREN, 'praktika/nalogi', S, 'index.html'), 'utf8'));
const TXT = STR.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('акт, даты инстанций и суммы — по тексту определения ВС', () => {
  assert.ok(TXT.includes('305-ЭС25-14104') && TXT.includes('А40-217702/2024'));
  for (const d of ['2026-04-03', '2025-03-18', '2025-06-19', '2025-11-05']) assert.ok(STR.includes('datetime="' + d + '"'), d);
  assert.ok(TXT.includes('39,8 млн ₽') && TXT.includes('1,9 млн ₽'));
  assert.ok(TXT.includes('«необходимое условие и достаточное формальное основание»'));
  assert.ok(TXT.includes('«безусловное требование»'));
  assert.ok(TXT.includes('«договорное обязательство не может считаться исполненным добросовестно»'));
  assert.ok(TXT.includes('«непосредственным образом в программу гражданско-правового обязательства»'));
  assert.ok(TXT.includes('«должна быть предоставлена возможность»'));
});

test('где грань: спор не решён, иск не о взыскании НДС, продавец без НДС — требовать нечего', () => {
  assert.ok(TXT.includes('ВС не решил спор по существу'));
  assert.ok(TXT.includes('Возмещение убытков — отдельный вопрос'));
  assert.ok(TXT.includes('счёта-фактуры с налогом нет, и требовать нечего'));
  assert.ok(TXT.includes('не позднее пяти календарных дней'));
});

test('банкрот ([Право · Налоговый] 05.10 11:10, разд. 3): «признан банкротом», пп. 15 п. 2 ст. 146 НК, ВС 305-ЭС25-6082', () => {
  assert.ok(TXT.includes('Если подрядчик признан банкротом, требовать от него счёт-фактуру с НДС, скорее всего, не выйдет'));
  assert.ok(TXT.includes('пп. 15 п. 2 ст. 146 НК РФ') && TXT.includes('№ 305-ЭС25-6082'));
  assert.ok(TXT.includes('Перед иском проверьте, не признан ли контрагент банкротом.'));
  assert.ok(!/исключает текущую деятельность|дела о банкротстве\./.test(TXT), 'тонкость 10:25 не подтвердилась');
});

test('пример: 1 200 000 ₽ × 22 / 122 = 216 393 ₽ — только в «примере», не из дела', () => {
  assert.strictEqual(Math.floor(1200000 * 22 / 122), 216393);
  const pr = STR.match(/<div class="primer">([\s\S]*?)<\/div>/)[1];
  assert.ok(pr.includes('216 393 ₽') && pr.includes('Пример не из дела'));
  assert.ok(Math.abs(22 / 122 - 0.18) < 0.001, '«≈ 18 %»');
});

test('[Право] стоп-слова: название подрядчика не пишем, исход не обещаем, ИИ не упоминаем', () => {
  const ART = STR.match(/<article>([\s\S]*?)<\/article>/)[1] + STR.match(/<p class="lid">([\s\S]*?)<\/p>/)[1];
  assert.ok(!/гарант/i.test(ART), 'корень «гарант» (из названия подрядчика) — ловят словари статей');
  assert.ok(!/суд обяжет|вы выиграете|нейросет/i.test(TXT));
  assert.ok(!TXT.includes('Сверено по первоисточникам'), 'vsrf.ru ещё не сверен');
});

test('кнопка с целью razbor20_check, слежение razbor20_slezh; FAQPage с 3 вопросами', () => {
  assert.ok(STR.includes('data-goal="razbor20_check"') && TXT.includes('Проверить подрядчика по ИНН'));
  assert.ok(STR.includes('razbor20_slezh'));
  assert.strictEqual((STR.match(/"@type": ?"Question"/g) || []).length, 3);
});

test('входящие: «НДС у поставщика на упрощёнке», статья 54.1, «Вокфорс», хаб, sitemap', () => {
  for (const f of ['nalogi/nds-postavshchika-na-usn-po-inn/index.html', 'nalogi/statya-54-1-nk-prostymi-slovami/index.html',
    'praktika/nalogi/vokfors-rekonstrukciya/index.html', 'praktika/nalogi/index.html', 'sitemap.xml']) {
    assert.ok(fs.readFileSync(path.join(KOREN, f), 'utf8').includes('/praktika/nalogi/' + S + '/'), f);
  }
});
