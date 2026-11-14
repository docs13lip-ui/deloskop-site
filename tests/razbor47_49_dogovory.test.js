// razbor47-49 + № 45 ([Ночные запуски] 14.11 00:06: № 45 — ВС 305-ЭС26-8406, текст [Право] 13.11 claude/Право_блоки_13.11.md,
// сверено по garant.ru doc 415140705; в «Договоры» — пара к № 47 о дивидендах).
// razbor47-49 ([Ночные запуски] 13.11 23:06): Разборы № 47, 48, 49 — рубрика «Договоры» (тексты [Право] 13.11:
// claude/Право_Разбор_47_ст12_152_ст46_НК_13.11.md разд. 4, …_Разбор_48_13.11.md разд. 4, …_Разбор_49_13.11.md разд. 6).
// Суммы, даты инстанций и цитаты сверены Ночными 13.11 по полным текстам на garant.ru (doc 415073301, 415156051, 415140717)
// → sverka_vid kopiya. № 47: дивиденды — довод покупателя, который поставщик не опроверг (так в акте), не «установил суд».
// № 49 — в «Договоры», а не новый раздел «Недвижимость»: хаб с одной статьёй — тонкая страница; раздел — когда наберётся 3+.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;|\u00a0/g, ' ').replace(/&#8209;|‑/g, '-');
const S47 = 'moratorij-dividendy-neustojka-vs-2026';
const S48 = 'shtraf-za-prosrochku-zadatka-vs-2026';
const S49 = 'vykup-uchastka-pod-domom-izhs-vs-2026';
const S45 = 'dividendy-chistye-aktivy-nizhe-ustavnogo-vs-2026';

test('Разборы № 47–49: данные — акты, итоги, копия, кнопки, перелинковка, входящие', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  assert.deepStrictEqual(D.razbory.slice(0, 4).map((x) => x.slug), [S45, S47, S48, S49], 'новые — первыми (№ 45 вышел позже)');
  const [, r47, r48, r49] = D.razbory;
  const st = (r) => r.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog + ' ' + d.itog_nov + ' ' + d.sverka_vid);
  assert.deepStrictEqual(st(r47), ['№ 307-ЭС26-4178 2026-10-26 На новое рассмотрение true kopiya']);
  assert.deepStrictEqual(st(r48), ['№ 307-ЭС26-6651 2026-11-09 На новое рассмотрение true kopiya']);
  assert.deepStrictEqual(st(r49), ['№ 308-ЭС26-7100 2026-11-06 В пользу предпринимателя false kopiya']);
  assert.ok(r47.dela[0].delo.includes('А56-78469/2025') && r48.dela[0].delo.includes('А56-53854/2025') && r49.dela[0].delo.includes('А32-36147/2024'));
  for (const [r, c] of [[r47, 'razbor47_check'], [r48, 'razbor48_check'], [r49, 'razbor49_check']]) {
    assert.strictEqual(r.razdel, 'dogovory');
    assert.strictEqual(r.knopka.cel, c);
    assert.ok(r.title.length <= 70 && r.description.length <= 160, r.slug + ': title/description');
    assert.ok(Object.values(D.ssylki_s_sajta).filter((v) => Array.isArray(v) && v.includes(r.slug)).length >= 2, r.slug + ': ≥ 2 входящие');
    assert.ok(!/[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+(ович|евич|овна|евна)|Газпром|ЦПСиК/.test(JSON.stringify(r)), 'без имён и названий');
  }
  assert.ok(r47.pohozhie.includes(S48) && r48.pohozhie.includes(S47) && r48.pohozhie.includes(S49) && r49.pohozhie.includes(S48), 'перелинковка');
  assert.ok(D.razbory.find((x) => x.slug === 'garantiya-sverh-neustojki-vernut').pohozhie.includes(S47));
  assert.ok(D.razbory.find((x) => x.slug === 'kontejnery-na-selhozzemle-vs-2026').pohozhie.includes(S49));
});

test('Разбор № 47: суммы, даты и цитаты — по определению; дивиденды — довод, не опровергнутый', () => {
  const t = un(chitat('tests/praktika/' + S47 + '.html'));
  for (const s of ['3 795 249 322,80 ₽', '379 184 238 ₽', '27 677 947,20 ₽', '22 800 000 ₽', '250 000 000 ₽', '411 500 000 ₽',
    'с 1 апреля по 1 октября 2022 года', 'поставщик не опроверг', 'абз. 9–10 п. 1 ст. 63', 'п. 2 ч. 4 ст. 233 АПК',
    '«по существу свидетельствуют о проявлении недобросовестного поведения»',
    '«…распространил действие моратория на ответчика, проигнорировав императивные нормы Закона о банкротстве»'])
    assert.ok(t.includes(s), s);
  assert.strictEqual(250000000 + 411500000, 661500000, 'больше 661 млн ₽');
  assert.strictEqual(Math.round((379184238 - 3000000) / 1e6), 376, '376 млн ₽ на кону');
  for (const d of ['2025-04-30', '2025-11-06', '2026-03-19', '2026-10-26']) assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  assert.ok(t.includes('/praktika/dogovory/' + S48 + '/'));
});

test('Разбор № 48: суммы, даты и цитаты — по определению; наличные — факт дела', () => {
  const t = un(chitat('tests/praktika/' + S48 + '.html'));
  for (const s of ['58 200 000 ₽', '194 кв. м', '1 565 000 ₽', '1 746 000 ₽', '359 177,46 ₽', '3 670 177,46 ₽', '1 750 000 ₽', 'А56-65623/2026',
    '«может свидетельствовать о направленности его действий на получение необоснованной выгоды»',
    '«не дали оценку приведенной совокупности фактических обстоятельств дела»',
    '«Само по себе такое условие предварительного договора не может быть признано ничтожным»',
    'Права на само помещение по ЕГРН мы не проверяем'])
    assert.ok(t.includes(s), s);
  assert.strictEqual(1565000 * 100 + 1746000 * 100 + 35917746, 367017746, 'сумма требований');
  assert.strictEqual(3 * 0.01 * 58200000, 1746000, 'штраф = 3 × 1 % цены');
  for (const d of ['2024-08-09', '2024-11-07', '2025-02-05', '2025-04-07', '2025-09-25', '2025-12-20', '2026-04-10', '2026-11-09'])
    assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
});

test('Разбор № 49: площади, даты, цитата; ВС сам решил спор; ЕГРН не проверяем', () => {
  const t = un(chitat('tests/praktika/' + S49 + '.html'));
  for (const s of ['2 401 кв. м', '64 кв. м', 'от 500 до 2 500 кв. м', 'подп. 6 п. 2 ст. 39.3, п. 1 ст. 39.20 ЗК', 'Верховный суд не стал возвращать дело',
    '«…не может определяться исключительно размером территории, застроенной индивидуальным жилым домом»', 'Делоскоп не проверяет'])
    assert.ok(t.includes(s), s);
  for (const d of ['2023-07-18', '2023-11-22', '2024-06-14', '2025-11-05', '2026-01-15', '2026-04-02', '2026-11-06'])
    assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  assert.ok(!/ \d[\d ]* ?₽/.test(t.split('<h2>Сколько на кону</h2>')[1]), 'сумм в определении нет — рублей в «Сколько на кону» нет');
});

test('Разборы № 47–49: страницы собраны — h1, FAQPage 3, «Сверено» по копии, хаб «Договоры», без обещаний', () => {
  const hab = un(chitat('praktika/dogovory/index.html'));
  for (const s of [S45, S47, S48, S49]) {
    const h = un(chitat('praktika/dogovory/' + s + '/index.html'));
    assert.strictEqual((h.match(/<h1[ >]/g) || []).length, 1, s);
    assert.strictEqual((h.match(/"@type": ?"Question"/g) || []).length, 3, s + ': FAQ');
    assert.ok(h.includes('определение суда — по полному тексту в копии правовой базы, с сайтом Верховного суда ещё сверяем'), s + ': «Сверено»');
    assert.ok(hab.includes('/praktika/dogovory/' + s + '/'), s + ' в хабе');
    const t = un(chitat('tests/praktika/' + s + '.html'));
    assert.ok(!/вернём деньги|(?<!не )гарантируем|₽ в месяц|тариф|нейросет/i.test(t), s + ': исход не обещаем, цен нет');
    assert.strictEqual((t.match(/<blockquote/g) || []).length, 1, s + ': цитата одна');
  }
});

test('Разбор № 45: суммы, даты, цитата — по определению; без названий сторон; перелинковка с № 47 и № 48', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory[0];
  assert.strictEqual(r.slug, S45);
  assert.strictEqual(r.razdel, 'dogovory');
  assert.strictEqual(r.knopka.cel, 'razbor45_check');
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog + ' ' + d.sverka_vid), ['№ 305-ЭС26-8406 2026-11-06 В пользу компании kopiya']);
  assert.ok(r.dela[0].delo.includes('А41-27237/2025'));
  assert.ok(r.title.length <= 70 && r.description.length <= 160);
  assert.ok(Object.values(D.ssylki_s_sajta).filter((v) => Array.isArray(v) && v.includes(S45)).length >= 2, '≥ 2 входящие');
  assert.ok(r.pohozhie.includes(S47) && r.pohozhie.includes(S48));
  assert.ok(D.razbory.find((x) => x.slug === S47).pohozhie.includes(S45) && D.razbory.find((x) => x.slug === S48).pohozhie.includes(S45));
  const t = un(chitat('tests/praktika/' + S45 + '.html'));
  for (const s of ['1 929 747,32 ₽', '871 374,17 ₽', '165 млн ₽', '196 млн ₽', '2,8 млн ₽', 'абз. 5 п. 1 ст. 43', 'п. 9 ст. 42',
    '«…принятое же вопреки упомянутому ограничению решение не влечет за собой возникновение на стороне акционера обязательственного требования о выплате дивидендов»'])
    assert.ok(t.includes(s), s);
  assert.strictEqual(Math.round((192974732 + 87137417) / 1e7) / 10, 2.8, '2,8 млн ₽ на кону');
  for (const d of ['2020-07-10', '2025-04-02', '2025-10-24', '2026-02-09', '2026-06-16', '2026-11-06'])
    assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  assert.ok(!/Ремвооружение|Центральный завод|41 ЦЗ/.test(JSON.stringify(r) + t), 'без названий сторон');
  assert.ok(t.includes('/praktika/dogovory/' + S47 + '/'));
});
