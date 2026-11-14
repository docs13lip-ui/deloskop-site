// razbor37-v3 (04.11): цитата и сумма дела по тексту определения. razbor37-v2 ([Ночные запуски] 03.11: правки [Право] 03.11 разд. 3); razbor37-v1 ([Ночные запуски] 02.11): Разбор № 37 «Ремонт за границей и НДС при ввозе» — текст [Право · Налоговый юрист] 02.11
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
  assert.ok(D.razbory.slice(0, 12).some((x) => x.slug === SLUG), 'новые разборы — первыми'); // razbor39-v1 (04.11), razbor40-v1 (06.11), razbor41-v1 (07.11): +1, razbor43-v1 (11.11): +1
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog), ['№ 305-ЭС26-8377 2026-10-23 В пользу таможни']);
  assert.ok(r.dela[0].delo.includes('А41-31932/2025'));
  assert.strictEqual(r.knopka.cel, 'razbor37_check');
  // 04.11: суммы — из текста определения (база 292 430 328 ₽, НДС 58 486 065,60 ₽), не из пересказов
  assert.ok(r.dela[0].na_konu.includes('58,5 млн ₽') && r.dela[0].na_konu.includes('292,4 млн ₽'));
  // pravo-0511 ([Право] 05.11 разд. 3.2): пени по делу не считали — без оговорки сумма выглядит полной
  assert.ok(r.dela[0].na_konu.includes('292,4 млн ₽ — без пеней'), 'на кону — «без пеней»');
});

test('Разбор № 37: текст по [Право] — нормы ТК ЕАЭС и НК, арифметика как пример, без цитат до сверки, без обещаний', () => {
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  // razbor37-v2: правки [Право] 03.11 разд. 3 — дословно
  for (const s of ['в Дубай на плановое техобслуживание', 'Бесплатный гарантийный ремонт суд не рассматривал.', 'уточните у таможенного представителя до вывоза', 'Перед вывозом заложите в бюджет НДС 22\u00a0% со стоимости ремонта.', 'Вернуть уже уплаченный НДС доводом «услугу оказали за рубежом» не выйдет: Верховный суд этот довод отклонил.'])
    assert.ok(t.includes(s), s);
  for (const s of ['ст. 186 ТК ЕАЭС', 'ст. 277 ТК ЕАЭС', 'п. 2 ст. 160 НК', 'ст. 148 НК', 'п. 2 ст. 346.11 НК', 'п. 2 ст. 171 НК', 'А41-31932/2025', '1,1 млн ₽', 'не данные дела'])
    assert.ok(t.includes(s), s);
  // razbor37-v3 ([Ночные запуски] 04.11, [Право] 04.11 разд. 4): одна цитата дословно из текста определения (garant 415055745), вторая — пересказом
  assert.strictEqual((t.match(/<blockquote/g) || []).length, 1, 'цитата одна');
  assert.ok(t.includes('<blockquote class="cit"><p>«носили плановый, а не аварийный характер».</p><cite>Из определения Верховного суда от 23.10.2026 № 305-ЭС26-8377</cite></blockquote>'));
  assert.ok(t.includes('Налог считают со стоимости работ, выполненных за границей.'));
  assert.ok(!/«[^»]*стоимост[^»]*переработк[^»]*»/.test(t), 'база — пересказом, без кавычек');
  assert.ok(!/(?<!не )гарантир|точно выиграете/i.test(t));
  // расчёт — только в «Пример»
  const vne = t.replace(/<div class="primer">[\s\S]*?<\/div>/, '');
  assert.ok(!/1,1 млн/.test(vne), 'расчёт вне примера');
});

test('Разбор № 37: на странице — честная строка «Сверено», FAQPage, ссылка из хаба «Налоги»', () => {
  const s = un(chitat('praktika/nalogi/' + SLUG + '/index.html'));
  assert.ok(/"@type": ?"FAQPage"/.test(s) && s.includes('data-goal="razbor37_check"'));
  assert.ok(s.includes('по полному тексту в копии правовой базы, с сайтом Верховного суда ещё сверяем'), 'Штаб 04.11: текст определения № 305-ЭС26-8377 прочитан в копии Гаранта (doc 415055745); vsrf.ru — после ПК');
  assert.ok(!/Сверено по первоисточникам <time/.test(s), 'пока акт не сверен — не пишем «сверено по первоисточникам»');
  assert.ok(un(chitat('praktika/nalogi/index.html')).includes('/praktika/nalogi/' + SLUG + '/'));
});
