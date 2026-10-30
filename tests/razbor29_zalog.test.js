// razbor29-v1 ([Ночные запуски] 26.10 13:05): Разбор № 29 «Залог дороже долга» — текст [Право] 26.10 разд. 2;
// 4 цитаты, суммы, даты актов и состав залога сверены по PDF vsrf.ru stor_pdf_ec/2545792 (26.10 12:10).
// Три отступления от черновика — по тексту определения: «в рассрочку» в нём нет (долг по договорам поставки);
// «выбирать машины суд не вправе» дословно не найдено; условный пример — без «4,1 % → откажут» (п. 56 Пленума № 23).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const un = (s) => s.replace(/[ ‑]/g, (c) => (c === '‑' ? '-' : ' '));
const D = JSON.parse(chitat('praktika/dela.json'));
const SLUG = 'zalog-odna-veshch-iz-pyati-vs-2026';

test('Разбор № 29: 305-ЭС25-14813 от 03.06.2026, раздел «Договоры», цели razbor29_*', () => {
  const r = D.razbory.find((x) => x.slug === SLUG);
  assert.ok(r && r.razdel === 'dogovory');
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data), ['№ 305-ЭС25-14813 2026-06-03']);
  assert.strictEqual(r.dela[0].istochnik, 'https://vsrf.ru/lk/practice/stor_pdf_ec/2545792');
  assert.strictEqual(r.knopka.cel, 'razbor29_check');
  assert.strictEqual(r.knopka.slezh.cel, 'razbor29_slezh');
  for (const k of ['nalogi/proverka-kontragenta-pered-dogovorom/index.html', 'nalogi/skolko-platit-vpered-neznakomoj-kompanii/index.html'])
    assert.ok(D.ssylki_s_sajta[k].includes(SLUG), 'вход ' + k);
});

test('Разбор № 29: цитаты ВС дословно, цифры по PDF, без «рассрочки» и обещаний', () => {
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  for (const c of ['«нарушение обеспеченного залогом обязательства незначительно»',
    '«…если из закона или договора не следует обращение взыскания исключительно на все вещи в целом»',
    '«у суда первой инстанции отсутствовали основания для отказа в иске со ссылкой на пункт 2 статьи 348 ГК РФ»',
    '«самостоятельно выбрать, какие из вещей»']) assert.ok(t.includes(c), 'цитата ' + c);
  for (const c of ['4 889 268,10 ₽', '200 000 ₽', '211 дней', '23,5 %', '22 млн ₽', 'А40-216070/2024', 'п. 56'])
    assert.ok(t.includes(c), 'цифра ' + c);
  for (const d of ['2025-03-27', '2025-06-27', '2026-05-25']) assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  assert.ok(!/рассрочк/i.test(t), '«в рассрочку» в определении нет');
  assert.ok(!/4,1 %|в обращении откажут/.test(t), 'условный пример не спорит с п. 56 Пленума № 23');
  assert.ok(!/Volvo|Caterpillar|КС-55729|ИНН \d/.test(t), 'без марок и реквизитов сторон');
  assert.ok(!/гарантир|точно выиграете|вернём/i.test(t));
});

test('Разбор № 29: страница, хаб «Договоры» и sitemap собраны', () => {
  const s = un(chitat('praktika/dogovory/' + SLUG + '/index.html'));
  assert.ok(s.includes('data-goal="razbor29_check"') && s.includes('№ 305-ЭС25-14813'));
  assert.ok(un(chitat('praktika/dogovory/index.html')).includes('/praktika/dogovory/' + SLUG + '/'));
  assert.ok(chitat('sitemap.xml').includes('https://deloskop.ru/praktika/dogovory/' + SLUG + '/'));
});
