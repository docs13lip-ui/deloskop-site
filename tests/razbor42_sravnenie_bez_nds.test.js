// razbor42-v1 ([Ночные запуски] 11.11): Разбор № 42 «Вы на упрощёнке, а заказчик сравнил цены без НДС» —
// текст [Право] 10.11 разд. 3 (claude/Право_блоки_10.11.md) + шаг 3 и «135-ФЗ: ч. 2, 18, 19 ст. 18.1» ([Право] 11.11 п. 2).
// Определение СКЭС ВС № 308-ЭС26-2840 (А32-65269/2024): резолютивная 29.07.2026, полный текст 31.07.2026; УФАС 25.09.2024;
// инстанции 17.03.2025 / 26.09.2025 / 11.02.2026 — сверено Ночными 11.11 по копии sudact.ru → sverka_vid kopiya.
// ⚠ vsrf.ru stor_pdf_ec/2548986 — это определение о передаче дела в коллегию (18.06.2026), не итоговый акт.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;|\u00a0/g, ' ').replace(/&#8209;|\u2011/g, '-');
const SLUG = 'sravnenie-cen-bez-nds-usn-zakupka';
const S23 = 'nds-postavshchika-usn-cena-dogovora';
const S43 = 'garantiya-sverh-neustojki-vernut';

test('Разбор № 42: данные — ВС № 308-ЭС26-2840 от 31.07.2026, «Налоги», первым, копия, razbor42_check, перелинковка', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory.find((x) => x.slug === SLUG);
  assert.ok(r && r.razdel === 'nalogi');
  assert.ok(D.razbory.slice(0, 6).some((x) => x.slug === SLUG), 'новые разборы — первыми'); // razbor44-46 (13.11): № 46 и № 44 встали первыми
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog + ' ' + d.sverka_vid), ['№ 308-ЭС26-2840 2026-07-31 В пользу УФАС kopiya']);
  assert.ok(r.dela[0].delo.includes('А32-65269/2024'));
  assert.strictEqual(r.knopka.cel, 'razbor42_check');
  assert.ok(r.zakon.some((z) => z[0].includes('ч. 2, 18, 19 ст. 18.1')), '135-ФЗ: ч. 2, 18, 19 ст. 18.1');
  for (const s of [S23, S43]) {
    const x = D.razbory.find((y) => y.slug === s);
    assert.ok(r.pohozhie.includes(s) && x.pohozhie.includes(SLUG), 'перелинковка ↔ ' + s);
  }
  assert.ok(D.ssylki_s_sajta['nalogi/nds-postavshchika-na-usn-po-inn/index.html'].includes(SLUG), 'вход со статьи о НДС поставщика на УСН');
});

test('Разбор № 42: расчёт, даты и цитаты — по акту; шаг 3 [Право]; 44-ФЗ не обещаем; исход не обещаем', () => {
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  for (const s of ['1 105 500 ₽', '819 672 ₽', '18,03 %', '100 000 ₽', '«Заказчик должен установить одно значение такой цены для всех участников закупки»',
    '«не соотносится непосредственным образом»', 'этот разбор их не касается', 'жаловаться может только тот, кто её подал',
    'договор с победителем до решения заключить нельзя', 'Отдельного дела о ставках 5 и 7 % мы не нашли'])
    assert.ok(t.includes(s), s);
  assert.strictEqual(Math.round(1000000 / 1.22), 819672, '1 000 000 / 1,22');
  assert.strictEqual((1 - 819672 / 1000000) * 100 > 18.03 && (1 - 819672 / 1000000) * 100 < 18.04, true, '18,03 %');
  for (const d of ['2024-09-25', '2025-03-17', '2025-09-26', '2026-02-11', '2026-07-31']) assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  for (const s of [S23, S43]) assert.ok(t.includes('/' + s + '/'), 'ссылка в тексте на ' + s);
  assert.ok(!/вернём деньги|(?<!не )гарантируем|₽ в месяц|тариф|Типограф/i.test(t), 'исход не обещаем, цен и названия участника нет');
  assert.strictEqual((t.match(/<blockquote/g) || []).length, 1, 'цитата одна');
});

test('Разбор № 42: страница собрана — h1, FAQPage 3, «Сверено» по копии, хаб «Налоги»', () => {
  const h = un(chitat('praktika/nalogi/' + SLUG + '/index.html'));
  assert.ok(h.includes('Вы на упрощёнке, а заказчик сравнил цены без НДС'));
  assert.strictEqual((h.match(/<h1[ >]/g) || []).length, 1);
  assert.strictEqual((h.match(/"@type": ?"Question"/g) || []).length, 3);
  assert.ok(h.includes('data-goal="razbor42_check"') && h.includes('Проверить заказчика по ИНН'));
  assert.ok(h.includes('по полному тексту в копии правовой базы, с сайтом Верховного суда ещё сверяем'));
  assert.ok(un(chitat('praktika/nalogi/index.html')).includes('/praktika/nalogi/' + SLUG + '/'));
});
