// razbor44-46 ([Ночные запуски] 13.11): Разборы № 44 и № 46 — пара о едином налоговом счёте.
// № 46 — Президиум ВС № 5-НАД26 от 17.06.2026 (текст [Право] 13.11 разд. 3); № 44 — решение ВС № АКПИ26-138 от 23.04.2026
// и постановление АС ВВО № Ф01-5346/2025 от 09.02.2026 по делу № А39-2105/2025 (текст [Право] 11.11).
// Цитаты и даты сверены Ночными 13.11 по копиям v2b.ru (vsrf.ru из облака закрыт) → sverka_vid kopiya.
// ⚠ Цитата округа в тексте [Право] («не только основных сумм, но и начисленных на них пеней») в акте — доводы заявителя,
// не вывод суда; на странице — дословный вывод суда («любых действий, направленных на взыскание налогов, пени и штрафов»).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/&#8209;|‑/g, '-');
const S46 = 'trebovanie-ens-odin-raz-vs-2026';
const S44 = 'obespechitelnye-mery-ens-chto-vernut';

test('Разборы № 44 и № 46: данные — акты, итоги, копия, кнопки, перелинковка, входящие ссылки', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  assert.deepStrictEqual(D.razbory.slice(4, 6).map((x) => x.slug), [S46, S44], 'новые разборы — первыми'); // razbor47-49 (13.11): № 47–49 встали первыми
  const r46 = D.razbory[4], r44 = D.razbory[5]; // razbor47-49 (13.11): +3; № 45 (14.11): +1
  assert.deepStrictEqual(r46.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog + ' ' + d.sverka_vid), ['№ 5-НАД26 2026-06-17 В пользу налоговой kopiya']);
  assert.deepStrictEqual(r44.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog + ' ' + d.sverka_vid),
    ['№ АКПИ26-138 2026-04-23 В пользу налоговой kopiya', '№ Ф01-5346/2025 2026-02-09 В пользу компании kopiya']);
  assert.ok(r44.dela[1].delo.includes('А39-2105/2025'));
  assert.strictEqual(r46.knopka.cel, 'razbor46_check');
  assert.strictEqual(r44.knopka.cel, 'razbor44_check');
  assert.ok(r46.pohozhie.includes(S44) && r44.pohozhie.includes(S46), 'пара ↔');
  assert.ok(D.razbory.find((x) => x.slug === 'utochnenka-i-peni-ens').pohozhie.includes(S46));
  assert.ok(D.razbory.find((x) => x.slug === 'blokirovka-lichnogo-scheta-ip').pohozhie.includes(S44));
  for (const s of [S44, S46]) {
    const vhod = Object.entries(D.ssylki_s_sajta).filter(([k, v]) => k !== '_kak' && v.includes(s));
    assert.ok(vhod.length >= 2, s + ': входящих ссылок ' + vhod.length);
  }
  for (const r of [r44, r46]) {
    assert.ok(r.title.length <= 70 && r.description.length <= 160, r.slug + ': title/description');
    assert.ok(!/[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+(ович|евич|овна|евна)/.test(JSON.stringify(r)), 'имён граждан нет');
  }
});

test('Разбор № 46: суммы, даты и цитата — по постановлению; оговорка про организации', () => {
  const t = un(chitat('tests/praktika/' + S46 + '.html'));
  for (const s of ['148 083,76 ₽', '16 623,67 ₽', '120 563 ₽', '125 246,28 ₽', '164 707,43 ₽', 'до 26.07.2023', 'до 01.12.2023',
    '«Требование об уплате задолженности в размере отрицательного сальдо ЕНС формируется один раз и действует до момента, пока сальдо ЕНС не примет положительное либо равное нулю значение»',
    'утратила силу с 01.01.2023', 'по смыслу', 'после каждого 28-го числа'])
    assert.ok(t.includes(s), s);
  assert.strictEqual(Math.round((148083.76 + 16623.67) * 100), 16470743, '148 083,76 + 16 623,67');
  for (const d of ['2023-06-27', '2024-08-19', '2024-10-17', '2025-01-16', '2025-10-22', '2026-06-17']) assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  assert.ok(t.includes('/' + S44 + '/') && t.includes('/utochnenka-i-peni-ens/'));
  assert.strictEqual((t.match(/<blockquote/g) || []).length, 1, 'цитата одна');
  assert.ok(!/Кривич|(?<!не )гарантируем|вернём деньги|тариф/i.test(t), 'без имени гражданина, исход не обещаем');
});

test('Разбор № 44: цитаты дословно, расчёт примера, «и обратная сторона», шаги [Право]', () => {
  const t = un(chitat('tests/praktika/' + S44 + '.html'));
  for (const s of ['не признается излишне уплаченным (взысканным) и не подлежит возврату налогоплательщику только на основании факта принятия судом обеспечительных мер',
    'возможность совершения налоговым органом любых действий, направленных на взыскание налогов, пени и штрафов',
    'КЧ-4-8/8543@', '222 307,6 ₽', '2 500 ₽', 'п. 8 ст. 45 НК', 'пп. 3 п. 7 ст. 11.3 НК', 'ч. 3 ст. 199 АПК'])
    assert.ok(t.includes(s), s);
  assert.ok(!t.includes('не только основных сумм, но и начисленных на них пеней'), 'это доводы заявителя, не вывод суда');
  assert.strictEqual(3000000 - 1200000, 1800000, 'пример: 3 000 000 − 1 200 000');
  for (const s of ['3 000 000 ₽', '1 200 000 ₽', '1 800 000 ₽']) assert.ok(t.includes(s), s);
  for (const d of ['2023-07-05', '2026-04-23', '2025-04-04', '2025-09-12', '2025-11-06', '2026-02-09']) assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  assert.strictEqual((t.match(/<blockquote/g) || []).length, 1, 'цитата одна');
  assert.strictEqual((t.match(/<li>/g) || []).length - 6, 4, 'шагов — 4');
  assert.ok(!/ПИНО|ЛТ Групп|(?<!не )гарантируем|вернём деньги|тариф/i.test(t), 'без названий компаний, исход не обещаем');
});

test('Разборы № 44 и № 46: страницы собраны — h1, FAQPage 3, «Сверено» по копии, хаб «Налоги»', () => {
  const hab = un(chitat('praktika/nalogi/index.html'));
  for (const [s, akt, gde] of [[S46, 'постановление суда', 'с сайтом Верховного суда'], [S44, 'акты судов', 'с сайтами судов']]) {
    const h = un(chitat('praktika/nalogi/' + s + '/index.html'));
    assert.strictEqual((h.match(/<h1[ >]/g) || []).length, 1, s);
    assert.strictEqual((h.match(/"@type": ?"Question"/g) || []).length, 3, s + ': FAQ');
    assert.ok(h.includes(akt + ' — по полному тексту в копии правовой базы, ' + gde + ' ещё сверяем'), s + ': строка «Сверено»');
    assert.ok(hab.includes('/praktika/nalogi/' + s + '/'), s + ' в хабе');
  }
});
