// razbor43-v1 ([Ночные запуски] 11.11): Разбор № 43 «Заказчик взял по гарантии больше, чем неустойка: разницу вернут» —
// текст [Право] 11.11 разд. 3 (claude/Право_блоки_11.11.md). Определение СКЭС ВС от 23.10.2026 № 305-ЭС26-8011
// (А40-68468/2025; резолютивная 14.10) — суммы, даты инстанций и 2 цитаты сверены Ночными 11.11 по копии garant.ru (doc 415055747);
// с сайтом ВС ещё сверяем (vsrf из облака закрыт) → sverka_vid kopiya. Пара к № 34: там банк прав, здесь — вернуть с заказчика.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-');
const SLUG = 'garantiya-sverh-neustojki-vernut';
const S34 = 'garantiya-vyplachena-otkaz-zakazchika-nezakonen';

test('Разбор № 43: данные — ВС № 305-ЭС26-8011 от 23.10.2026, «Договоры», первым, копия, razbor43_check, пара с № 34', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory.find((x) => x.slug === SLUG);
  assert.ok(r && r.razdel === 'dogovory');
  assert.ok(D.razbory.slice(0, 4).some((x) => x.slug === SLUG), 'новые разборы — первыми'); // razbor42-v1 (11.11): № 42 встал первым
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog + ' ' + d.sverka_vid), ['№ 305-ЭС26-8011 2026-10-23 В пользу поставщика kopiya']);
  assert.ok(r.dela[0].delo.includes('А40-68468/2025'));
  assert.strictEqual(r.knopka.cel, 'razbor43_check');
  const r34 = D.razbory.find((x) => x.slug === S34);
  assert.ok(r.pohozhie.includes(S34) && r34.pohozhie.includes(SLUG), 'перелинковка ↔ № 34');
  assert.ok(Object.values(D.ssylki_s_sajta).filter((v) => Array.isArray(v) && v.includes(SLUG)).length >= 2, '≥ 2 входящие');
});

test('Разбор № 43: суммы, даты и цитаты — по акту; банк не виноват; исход не обещаем', () => {
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  for (const s of ['14 723 764,10 ₽', '10 272 393,39 ₽', '8 845 169,86 ₽', '432 481,73 ₽', '1 427 223,53 ₽', 'ст. 1102 ГК', 'ст. 395 ГК', 'ст. 196 ГК',
    'не произвольной, а обоснованной', '«неправомерное освобождение бенефициара от ответственности перед гарантом или принципалом»', 'Разницу возвращает заказчик, а не банк'])
    assert.ok(t.includes(s), s);
  for (const d of ['2024-07-05', '2025-10-23', '2026-02-19', '2026-06-05', '2026-10-23']) assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  assert.ok(t.includes('/praktika/dogovory/' + S34 + '/'), 'ссылка на № 34 в тексте');
  assert.ok(!/вернём деньги|(?<!не )гарантируем|₽ в месяц|тариф/i.test(t), 'исход не обещаем, цен нет');
  assert.strictEqual((t.match(/<blockquote/g) || []).length, 1, 'цитата одна');
});

test('Разбор № 43: страница собрана — h1, FAQPage 3, «Сверено» по копии, хаб «Договоры»', () => {
  const h = un(chitat('praktika/dogovory/' + SLUG + '/index.html'));
  assert.ok(h.includes('Заказчик взял по гарантии больше, чем неустойка: разницу вернут'));
  assert.strictEqual((h.match(/<h1[ >]/g) || []).length, 1);
  assert.strictEqual((h.match(/"@type": ?"Question"/g) || []).length, 3);
  assert.ok(h.includes('data-goal="razbor43_check"') && h.includes('Проверить заказчика по ИНН'));
  assert.ok(h.includes('по полному тексту в копии правовой базы, с сайтом Верховного суда ещё сверяем'));
  assert.ok(un(chitat('praktika/dogovory/index.html')).includes('/praktika/dogovory/' + SLUG + '/'));
});
