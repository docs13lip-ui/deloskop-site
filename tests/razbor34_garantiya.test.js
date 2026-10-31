// razbor34-v1 ([Ночные запуски] 31.10): Разбор № 34 «Банк заплатил по гарантии, а отказ заказчика незаконен» —
// текст [Право] 30.10 (claude/Право_Разбор_34_гарантия_и_✎_письмо_компания_кредиторка_30.10.md, разд. 3; garant.ru doc 415038423).
// Без имён судей; исход клиенту не обещаем («банк приостановит», «вернём деньги» — нет); цен нет.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;|\u00a0/g, ' ').replace(/‑/g, '-');
const SLUG = 'garantiya-vyplachena-otkaz-zakazchika-nezakonen';
const URL = '/praktika/dogovory/' + SLUG + '/';

test('Разбор № 34: данные — ВС № 305-ЭС26-5649 от 20.10.2026, «Договоры», 2 входящие, кнопка razbor34_check', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory.find((x) => x.slug === SLUG);
  assert.ok(r && r.razdel === 'dogovory');
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data), ['№ 305-ЭС26-5649 2026-10-20']);
  assert.ok(r.dela[0].delo.includes('А40-99642/2025'));
  assert.strictEqual(r.knopka.cel, 'razbor34_check');
  const svezh = [...D.razbory].sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 3).map((x) => x.slug);
  assert.ok(svezh.includes(SLUG), 'по дате — среди свежих');
  for (const f of ['nalogi/proverka-kontragenta-pered-dogovorom/index.html', 'nalogi/skolko-platit-vpered-neznakomoj-kompanii/index.html']) {
    assert.ok(D.ssylki_s_sajta[f].includes(SLUG), 'входящая ссылка с ' + f);
    assert.ok(un(chitat(f)).includes(URL), 'ссылка собрана в ' + f);
  }
});

test('Разбор № 34: суммы и даты дела по тексту [Право], без имён судей и обещаний', () => {
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  for (const s of ['156 010 271,23 ₽', '162 015 891,06 ₽', '154 909 933,57 ₽', '02.02.2022', 'п. 2 ст. 376 ГК', 'ст. 375.1 ГК', 'ст. 379 ГК',
    '«отсутствовали законные основания для отказа в выплате»'])
    assert.ok(t.includes(s), s);
  for (const d of ['2024-06-21', '2024-08-26', '2024-09-09', '2025-02-05', '2026-10-20']) assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  assert.ok(!/Букин|Разумов|Самуйлов/.test(t), 'имён судей нет');
  assert.ok(!/банк вас защитит|вернём деньги|(?<!не )гарантируем/i.test(t), 'исход не обещаем');
  assert.ok(/Обещать, что банк приостановит, нельзя/.test(t));
  assert.ok(!/₽ в месяц|тариф/i.test(t), 'цен нет');
});

test('Разбор № 34: страница собрана — h1, FAQ 3, кнопка заказчика', () => {
  const h = un(chitat('praktika/dogovory/' + SLUG + '/index.html'));
  assert.ok(h.includes('Заказчик расторг договор незаконно, но банк уже заплатил по гарантии. Кто прав?'));
  assert.strictEqual((h.match(/<h1[ >]/g) || []).length, 1);
  assert.strictEqual((h.match(/"@type": ?"Question"/g) || []).length, 3);
  assert.ok(h.includes('Проверить заказчика по ИНН'));
});
