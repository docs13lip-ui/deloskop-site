// razbor37-v2 ([Ночные запуски] 03.11: правки [Право] 03.11 разд. 3); razbor37-v1 ([Ночные запуски] 02.11): Разбор № 37 «Ремонт за границей и НДС при ввозе» — текст [Право · Налоговый юрист] 02.11
// (claude/Право_✎_приказ_732_тексты_УСН_Разбор_37_02.11.md, разд. 4). Определение СКЭС ВС № 305-ЭС26-8377 (А41-31932/2025).
// ◐ PDF vsrf.ru из облака не открылся: цитат в кавычках нет, сумма дела не выдумана, строка «Сверено» честно говорит «по пересказам».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-');
const SLUG = 'remont-za-rubezhom-nds-pri-vvoze-vs-2026';

test('Разбор № 37: данные — ВС № 305-ЭС26-8377, «Налоги», первым, итог «В пользу таможни», razbor37_check', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory.find((x) => x.slug === SLUG);
  assert.ok(r && r.razdel === 'nalogi');
  assert.strictEqual(D.razbory[0].slug, SLUG, 'новые разборы — первыми');
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog), ['№ 305-ЭС26-8377 2026-10-23 В пользу таможни']);
  assert.ok(r.dela[0].delo.includes('А41-31932/2025'));
  assert.strictEqual(r.knopka.cel, 'razbor37_check');
});

test('Разбор № 37: текст по [Право] — нормы ТК ЕАЭС и НК, арифметика как пример, без цитат до сверки, без обещаний', () => {
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  // razbor37-v2: правки [Право] 03.11 разд. 3 — дословно
  for (const s of ['в Дубай на плановое техобслуживание', 'Бесплатный гарантийный ремонт суд не рассматривал.', 'уточните у таможенного представителя до вывоза', 'Перед вывозом заложите в бюджет НДС 22\u00a0% со стоимости ремонта.', 'Вернуть уже уплаченный НДС доводом «услугу оказали за рубежом» не выйдет: Верховный суд этот довод отклонил.'])
    assert.ok(t.includes(s), s);
  for (const s of ['ст. 186 ТК ЕАЭС', 'ст. 277 ТК ЕАЭС', 'п. 2 ст. 160 НК', 'ст. 148 НК', 'п. 2 ст. 346.11 НК', 'п. 2 ст. 171 НК', 'А41-31932/2025', '1,1 млн ₽', 'не данные дела'])
    assert.ok(t.includes(s), s);
  assert.ok(!/blockquote/.test(t), 'цитаты — после сверки по PDF');
  assert.ok(!/(?<!не )гарантир|точно выиграете/i.test(t));
  // расчёт — только в «Пример»
  const vne = t.replace(/<div class="primer">[\s\S]*?<\/div>/, '');
  assert.ok(!/1,1 млн/.test(vne), 'расчёт вне примера');
});

test('Разбор № 37: на странице — честная строка «Сверено», FAQPage, ссылка из хаба «Налоги»', () => {
  const s = un(chitat('praktika/nalogi/' + SLUG + '/index.html'));
  assert.ok(/"@type": ?"FAQPage"/.test(s) && s.includes('data-goal="razbor37_check"'));
  assert.ok(s.includes('по пересказу решения в pravo.ru от 26.10.2026, текст определения сверим'), 'строка [Право] 03.11 разд. 3');
  assert.ok(!/Сверено по первоисточникам <time/.test(s), 'пока акт не сверен — не пишем «сверено по первоисточникам»');
  assert.ok(un(chitat('praktika/nalogi/index.html')).includes('/praktika/nalogi/' + SLUG + '/'));
});
