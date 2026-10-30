// proverte-sebya-v1 (30.10.2026, [Ночные запуски]; решение владельца 30.10 «уникальность»).
// Блок с полем ИНН под статьями /115-fz/ и /nalogi/ («Проверьте себя») был одинаковым на 10 статьях,
// ещё у 6 повторялись заголовок или строка с соседними статьями. Теперь у каждой статьи — своя пара
// «заголовок + строка» про её тему и только про то, что проверка по ИНН действительно показывает.
// 1) Шаблон «Посмотрите на свою компанию или контрагента глазами банка и налоговой» не вернулся.
// 2) Заголовки и строки блоков не повторяются между статьями.
// 3) Без цен, «!» и упоминаний ИИ; ЗСК — только как прогноз (саму зону знает Банк России и ваш банк);
//    суды не обещаем — картотека арбитражных дел не подключена.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const tekst = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;| /g, ' ').replace(/&#8209;/g, '-').replace(/\s+/g, ' ').trim();

const BLOKI = [];
for (const razdel of ['115-fz', 'nalogi']) {
  for (const d of fs.readdirSync(path.join(K, razdel), { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const f = path.join(K, razdel, d.name, 'index.html');
    if (!fs.existsSync(f)) continue;
    const h = fs.readFileSync(f, 'utf8');
    if (/<meta name="robots" content="[^"]*noindex/.test(h)) continue;
    const m = h.match(/<section class="check"[^>]*>\s*<h2>([\s\S]*?)<\/h2>\s*<p>([\s\S]*?)<\/p>/);
    if (m) BLOKI.push({ adres: `/${razdel}/${d.name}/`, h2: tekst(m[1]), p: tekst(m[2]) });
  }
}

test('блоков с полем ИНН под статьями найдено достаточно', () => {
  assert.ok(BLOKI.length >= 25, 'найдено: ' + BLOKI.length);
});

test('шаблон «глазами банка и налоговой. Бесплатно, за несколько секунд» не вернулся', () => {
  const plohie = BLOKI.filter((b) => /Посмотрите на свою компанию или контрагента глазами банка и налоговой/.test(b.p) || b.h2 === 'Проверьте себя');
  assert.deepStrictEqual(plohie.map((b) => b.adres), []);
});

for (const pole of ['h2', 'p']) {
  test(`${pole === 'h2' ? 'заголовки' : 'строки'} блоков не повторяются между статьями`, () => {
    const vstrecheno = new Map();
    const povtory = [];
    for (const b of BLOKI) {
      const k = b[pole].toLowerCase();
      if (vstrecheno.has(k)) povtory.push(`${b.adres} = ${vstrecheno.get(k)}: «${b[pole]}»`);
      else vstrecheno.set(k, b.adres);
    }
    assert.deepStrictEqual(povtory, []);
  });
}

test('без цен, «!», ИИ; ЗСК — только прогноз; суды не обещаем', () => {
  const plohie = [];
  for (const b of BLOKI) {
    const t = b.h2 + ' ' + b.p;
    if (/\d\s?₽|руб/.test(t)) plohie.push(b.adres + ': цена');
    if (t.includes('!')) plohie.push(b.adres + ': «!»');
    if (/\bИИ\b|нейросет|искусствен/i.test(t)) plohie.push(b.adres + ': ИИ');
    if (/ЗСК/.test(t) && !/прогноз/i.test(t)) plohie.push(b.adres + ': ЗСК без «прогноз»');
    if (/суд|арбитраж/i.test(t)) plohie.push(b.adres + ': суды не подключены');
  }
  assert.deepStrictEqual(plohie, []);
});
