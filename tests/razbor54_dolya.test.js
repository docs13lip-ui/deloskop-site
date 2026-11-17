// razbor54-dolya-v1 ([Ночные запуски] 17.11 20:05): Разбор [Право] № 54 (на сайте — № 50, цель razbor50_check) —
// ВС № 305-ЭС26-6383 от 23.10.2026 (А40-58310/2024): долю вышедшему участнику ООО считают по рыночной стоимости всех активов.
// Текст [Право] 17.11 (claude/Право_пачки_0712_0812_✎_ст18.2_Разбор_54_17.11.md, разд. 3); суммы, даты инстанций и цитата
// сверены Ночными 17.11 по полному тексту на garant.ru (doc 415073297) → sverka_vid kopiya; п. 6.1 ст. 23 Закона об ООО — consultant
// (ред. 04.08.2026). Рубрика — «Договоры» рядом с № 45 (дивиденды): раздел «Корпоративные споры» с двумя статьями — тонкий хаб.
// Названий знаков и сторон нет ([Право]: написание в пересказах расходится).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-');
const S = 'dolya-vyhod-iz-ooo-rynochnaya-stoimost-vs-2026';
const S45 = 'dividendy-chistye-aktivy-nizhe-ustavnogo-vs-2026';

test('Разбор о доле при выходе из ООО: данные — акт, итог, копия, кнопка, перелинковка, входящие', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory[0];
  assert.strictEqual(r.slug, S, 'новый — первым');
  assert.strictEqual(r.razdel, 'dogovory');
  assert.strictEqual(r.knopka.cel, 'razbor50_check');
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog + ' ' + d.itog_nov + ' ' + d.sverka_vid),
    ['№ 305-ЭС26-6383 2026-10-23 На новое рассмотрение true kopiya']);
  assert.ok(r.dela[0].delo.includes('А40-58310/2024'));
  assert.ok(r.title.length <= 70 && r.description.length <= 160, 'title/description');
  assert.ok(Object.values(D.ssylki_s_sajta).filter((v) => Array.isArray(v) && v.includes(S)).length >= 2, '≥ 2 входящие');
  assert.ok(r.pohozhie.includes(S45) && D.razbory.find((x) => x.slug === S45).pohozhie.includes(S), 'перелинковка с № 45');
  assert.ok(!/КОНВЕНТ|АРТРА|Альтаир/i.test(JSON.stringify(r)), 'без названий сторон и знаков');
  const F = JSON.parse(chitat('praktika/faq.json')).razbory[S];
  assert.strictEqual(F.length, 3);
});

test('Разбор о доле: суммы, даты и цитата — по определению; итог не предрешаем', () => {
  const t = un(chitat('tests/praktika/' + S + '.html'));
  for (const s of ['46 %', '10 044 705 ₽', '27 348 235 ₽', '3 697 178,17 ₽', '15 954 000 ₽', '5 909 295 ₽', '740 000 ₽', '31 декабря 2022 года',
    'п. 6 ст. 1232 ГК', 'п. 6.1 ст. 23 Закона об ООО', 'если устав не задаёт иной', 'патентного поверенного',
    '«Действительная стоимость доли не может быть ниже реальной рыночной стоимости…»', 'вернул дело на новое рассмотрение'])
    assert.ok(t.includes(s), s);
  assert.strictEqual(15954000 - 10044705, 5909295, 'апелляция: доля минус выплаченное');
  assert.strictEqual(Math.round((2734823500 + 369717817) / 1e8), 31, '≈ 31 млн ₽ на кону');
  for (const d of ['2023-12-09', '2025-02-05', '2025-11-28', '2026-04-02', '2026-10-23'])
    assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  assert.ok(!/КОНВЕНТ|АРТРА|Альтаир/i.test(t), 'без названий');
  assert.ok(!/вернём деньги|(?<!не )гарантируем|₽ в месяц|тариф|нейросет|получите (всю|полную)/i.test(t), 'исход не обещаем, цен нет');
  assert.strictEqual((t.match(/<blockquote/g) || []).length, 1, 'цитата одна');
  assert.ok(t.includes('/praktika/dogovory/' + S45 + '/'));
});

test('Разбор о доле: страница собрана — h1, FAQPage 3, «Сверено» по копии, в хабе «Договоры» и ленте', () => {
  const h = un(chitat('praktika/dogovory/' + S + '/index.html'));
  assert.strictEqual((h.match(/<h1[ >]/g) || []).length, 1);
  assert.strictEqual((h.match(/"@type": ?"Question"/g) || []).length, 3, 'FAQ');
  assert.ok(h.includes('определение суда — по полному тексту в копии правовой базы, с сайтом Верховного суда ещё сверяем'), '«Сверено»');
  assert.ok(un(chitat('praktika/dogovory/index.html')).includes('/praktika/dogovory/' + S + '/'), 'в хабе');
  const L = JSON.parse(chitat('obnovleniya.json')).obnovleniya;
  assert.ok(L.some((z) => z.id === '2026-11-17-4211' && z.chto_proverit.some((c) => c.ssylka === '/praktika/dogovory/' + S + '/')), 'лента -4211');
});
