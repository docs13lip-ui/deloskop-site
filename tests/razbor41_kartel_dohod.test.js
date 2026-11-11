// razbor41-v1 ([Ночные запуски] 07.11): Разбор № 41 «Устный сговор на торгах — весь доход в бюджет» — текст [Право] 07.11 разд. 6
// (claude/Право_✎_п473_повторная_ВК_Разбор_41_картель_доход_07.11.md). Текст определения 309-ЭС25-15678 сверен Ночными 07.11
// по копии sudact (04cVGWlZMCUF): полный текст 22.05.2026 (резолютивная — 20.05), 314 722 515 ₽ солидарно, ч. 1 ст. 52 АПК.
// Отличия от пересказов: «ущерб доказывать не нужно» и «суды требовали предписание ФАС» в акте нет — не пишем.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-');
const SLUG = 'ustnyy-kartel-dohod-v-byudzhet-vs-2026';

test('Разбор № 41: данные — ВС № 309-ЭС25-15678 от 22.05.2026, «Договоры», первым, копия, razbor41_check, пара с № 40', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory.find((x) => x.slug === SLUG);
  assert.ok(r && r.razdel === 'dogovory');
  assert.ok(D.razbory.slice(0, 2).some((x) => x.slug === SLUG), 'новые разборы — первыми'); // razbor43-v1 (11.11): № 43 встал первым
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog + ' ' + d.sverka_vid), ['№ 309-ЭС25-15678 2026-05-22 В пользу прокуратуры kopiya']);
  assert.ok(r.dela[0].delo.includes('А47-10662/2024'));
  assert.ok(!/«(Заря|СКС|ВМ Капитал|ОренСтройМонтаж|СтройГрупп)»/.test(JSON.stringify(r) + chitat('tests/praktika/' + SLUG + '.html')), 'названия компаний не даём');
  assert.strictEqual(r.knopka.cel, 'razbor41_check');
  const r40 = D.razbory.find((x) => x.slug === 'svyazannye-kompanii-na-torgah-kartel-vs-2026');
  assert.ok(r.pohozhie.includes(r40.slug) && r40.pohozhie.includes(SLUG), 'перелинковка ↔ № 40');
  assert.ok(Object.values(D.ssylki_s_sajta).filter((v) => Array.isArray(v) && v.includes(SLUG)).length >= 2, '≥ 2 входящие');
});

test('Разбор № 41: текст — по акту, без утверждений из пересказов; расчёт — только в примере', () => {
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  for (const s of ['девять муниципальных закупок', '314 722 515 ₽', 'солидарно', 'ст. 169 ГК', 'ч. 3 ст. 51', 'Обзор судебной практики № 3 (2026)', 'не данные дела', 'мы этого не утверждаем', 'А47-10662/2024'])
    assert.ok(t.includes(s), s);
  assert.ok(!/доказывать не нужно|должна была выдать предписание|в пересказах/i.test(t), 'в акте этого нет');
  assert.ok(!/надёжн|надежн/i.test(t), 'словарь 222-ФЗ');
  assert.strictEqual((t.match(/<blockquote/g) || []).length, 1, 'цитата одна');
  const vne = t.replace(/<div class="primer">[\s\S]*?<\/table>\s*<\/div>/, '');
  assert.ok(!/40 млн|42 млн|4,2 до 21/.test(vne), 'расчёт вне примера');
});

test('Разбор № 41: страница — строка «Сверено» по копии, FAQPage, форма ИНН, хаб «Договоры»', () => {
  const s = un(chitat('praktika/dogovory/' + SLUG + '/index.html'));
  assert.ok(/"@type": ?"FAQPage"/.test(s) && s.includes('data-goal="razbor41_check"'));
  assert.ok(s.includes('по полному тексту в копии правовой базы, с сайтом Верховного суда ещё сверяем'));
  assert.ok(s.includes('<form class="dl__f" action="/"'));
  assert.ok(un(chitat('praktika/dogovory/index.html')).includes('/praktika/dogovory/' + SLUG + '/'));
});
