// razbor26-v1 ([Ночные запуски] 25.10): Разбор № 26 «Отдали имущество за задаток» — текст [Право] 23.10
// (claude/Право_Разбор_26_задаток_убытки_управляющего_и_строка_беты_23.10.md, ✅ по PDF vsrf.ru stor_pdf_ec/2563804).
// Раздел «Договоры» (второй разбор хаба), 6 цитат ВС дословно, имя управляющего и сторон не публикуем, ◐-ответ FAQ не ставим.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/‑/g, '-');
const SLUG = 'peredali-za-zadatok-ubytki-upravlyayushchego-vs-2026';
const URL = '/praktika/dogovory/' + SLUG + '/';

test('Разбор № 26: данные — ВС № 305-ЭС26-3930 от 26.08.2026, раздел «Договоры», первым в списке', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory.find((x) => x.slug === SLUG);
  assert.ok(r && r.razdel === 'dogovory');
  assert.strictEqual(D.razbory[0].slug, SLUG, 'новые разборы — первыми');
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data), ['№ 305-ЭС26-3930 2026-08-26']);
  assert.strictEqual(r.dela[0].istochnik, 'https://vsrf.ru/lk/practice/stor_pdf_ec/2563804');
  assert.strictEqual(r.knopka.cel, 'razbor26_check');
  for (const f of ['nalogi/skolko-platit-vpered-neznakomoj-kompanii/index.html', 'nalogi/proverka-kontragenta-pered-dogovorom/index.html']) {
    assert.ok(D.ssylki_s_sajta[f].includes(SLUG), 'входящая ссылка с ' + f);
    assert.ok(un(chitat(f)).includes(URL), 'ссылка собрана в ' + f);
  }
});

test('Разбор № 26: текст — 6 цитат ВС дословно, суммы и даты инстанций, без имён и обещаний', () => {
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  const cit = ['«экстраординарный способ защиты»', '«технической ошибки»',
    '«по неосторожности, в том числе простой, не освобождается от гражданско-правовой ответственности»',
    '«не могло быть поставлено судами… под условие обращения истца к иным способам защиты»',
    '«не убедившись в полном исполнении приобретателем своих обязательств по оплате»',
    '«не может считаться надлежащим»'];
  for (const c of cit) assert.ok(t.includes(c), 'цитата ' + c);
  for (const s of ['6 102 102 ₽', '297 990 ₽', '5 804 112 ₽', 'А40-4457/2025']) assert.ok(t.includes(s), s);
  assert.strictEqual(6102102 - 297990, 5804112, 'разница = взысканная сумма');
  for (const d of ['2025-07-15', '2025-10-21', '2026-02-27', '2026-08-17']) assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  assert.ok(!/УС-200|А40-83536/.test(t), 'истца и дело о банкротстве не называем — только суть');
  assert.ok(!/отстран/i.test(t), 'FAQ про отстранение — ◐ у [Право], не ставим');
  assert.ok(!/точно выиграете|вернём|гарантирует взыскание/i.test(t));
});

test('Разбор № 26: страница, хаб «Договоры», FAQ дословно из текста, sitemap', () => {
  const s = un(chitat('praktika/dogovory/' + SLUG + '/index.html'));
  assert.ok(s.includes('data-goal="razbor26_check"') && s.includes('№ 305-ЭС26-3930'));
  assert.ok(s.includes('"@type":"FAQPage"') || s.includes('"@type": "FAQPage"'));
  const F = JSON.parse(chitat('praktika/faq.json')).razbory[SLUG];
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  assert.strictEqual(F.length, 3);
  for (const q of F) for (const o of q.o) assert.ok(t.includes(o), 'ответ FAQ дословно из текста: ' + o);
  const h = un(chitat('praktika/dogovory/index.html'));
  assert.ok(h.includes(URL) && h.includes('/praktika/dogovory/kompensaciya-poter-406-1-vs-2026/'), 'на хабе оба разбора');
  assert.ok(un(chitat('sitemap.xml')).includes('https://deloskop.ru' + URL));
});
