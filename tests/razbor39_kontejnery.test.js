// razbor39-v1 ([Ночные запуски] 04.11): Разбор № 39 «Склад контейнеров на сельхозземле» — текст [Право] 04.11 разд. 7
// (claude/Право_✎_732_сверено_Разбор_38_37_лимит_Разбор_39_04.11.md). Определение СКЭС ВС от 29.10.2026 № 305-ЭС26-10700 (А41-65384/2025),
// текст — в копии правовой базы (garant 415096051), vsrf.ru — с ПК. Раздел «Договоры» (не новый хаб «Контрагенты» из одной статьи).
// pravo-0511 (05.11): ч. 1 ст. 8.8 КоАП сверена (consultant.ru, ред. 04.08.2026), строка — дословно [Право] 05.11 разд. 2.2, только в «Пример».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-');
const SLUG = 'kontejnery-na-selhozzemle-vs-2026';

test('Разбор № 39: данные — ВС № 305-ЭС26-10700 от 29.10.2026, «Договоры», первым, копия правовой базы, razbor39_check', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory.find((x) => x.slug === SLUG);
  assert.ok(r && r.razdel === 'dogovory');
  assert.strictEqual(D.razbory[0].slug, SLUG, 'новые разборы — первыми');
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog + ' ' + d.sverka_vid), ['№ 305-ЭС26-10700 2026-10-29 В пользу администрации kopiya']);
  assert.ok(r.dela[0].delo.includes('А41-65384/2025'));
  assert.strictEqual(r.knopka.cel, 'razbor39_check');
  assert.ok(Object.values(D.ssylki_s_sajta).filter((v) => Array.isArray(v) && v.includes(SLUG)).length >= 2, '≥ 2 входящие');
});

test('Разбор № 39: текст по [Право] — нормы ЗК и ГК, одна цитата, арифметика только в примере, без несверенной санкции КоАП', () => {
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  for (const s of ['больше 1 500 портовых контейнеров', 'ст. 42, 78 ЗК', 'п. 1 ст. 1065 ГК', 'согласование проекта категорию не меняет', 'публичной кадастровой карте (НСПД)', 'не данные дела', 'А41-65384/2025'])
    assert.ok(t.includes(s), s);
  assert.strictEqual((t.match(/<blockquote/g) || []).length, 1, 'цитата одна');
  assert.ok(t.includes('«Такая деятельность презюмируется как экологически опасная».'));
  const primer = (t.match(/<div class="primer">[\s\S]*?<\/div>/) || [''])[0];
  assert.ok(primer.includes('Пока площадка работает, тот, кто её использует, рискует и штрафом за использование земли не по целевому назначению. Для организации это от 1,5 до 2 % кадастровой стоимости участка, но не меньше 100 000 ₽ (ч. 1 ст. 8.8 КоАП РФ).'), 'строка ст. 8.8 — дословно [Право] 05.11');
  assert.ok(!/кадастровой стоимости|100 000 ₽/.test(t.replace(primer, '')), 'санкция ст. 8.8 — только в примере');
  assert.ok(!/◐|сверить на consultant/.test(t), 'пометок о несверенном нет');
  assert.ok(!/224-ПГ/.test(t), 'постановление Губернатора МО — ◐, номер не пишем');
  const vne = t.replace(/<div class="primer">[\s\S]*?<\/div>/, '');
  assert.ok(!/300 000|3,65 млн/.test(vne), 'расчёт вне примера');
});

test('Разбор № 39: страница — честная строка «Сверено», FAQPage, форма ИНН, хаб «Договоры»', () => {
  const s = un(chitat('praktika/dogovory/' + SLUG + '/index.html'));
  assert.ok(/"@type": ?"FAQPage"/.test(s) && s.includes('data-goal="razbor39_check"'));
  assert.ok(s.includes('по полному тексту в копии правовой базы, с сайтом Верховного суда ещё сверяем'));
  assert.ok(s.includes('<form class="dl__f" action="/"'));
  assert.ok(un(chitat('praktika/dogovory/index.html')).includes('/praktika/dogovory/' + SLUG + '/'));
});
