// razbor31-v1 ([Ночные запуски] 30.10): Разбор № 31 «Долг списали как безнадёжный — а отвечать всё равно придётся» —
// текст [Право] 30.10 (claude/Право_ответы_✎_30.10_лист_рисков_1С_недоимка_Разбор_31.md, разд. 5; PDF vsrf.ru stor_pdf_ec/2522724).
// ВС дело по существу не решил — исход не обещаем; имён физлиц нет; длинных цитат без сверки буква в букву нет.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/‑/g, '-');
const SLUG = 'spisali-dolg-subsidiarka';
const URL = '/praktika/nalogi/' + SLUG + '/';

test('Разбор № 31: данные — ВС № 305-ЭС22-15047 (6,7) от 19.02.2026, раздел «Налоги», первым, 2 входящие', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory.find((x) => x.slug === SLUG);
  assert.ok(r && r.razdel === 'nalogi');
  assert.strictEqual(D.razbory[0].slug, SLUG, 'новые разборы — первыми');
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog), ['№ 305-ЭС22-15047 (6,7) 2026-02-19 На новое рассмотрение']);
  assert.strictEqual(r.dela[0].istochnik, 'https://vsrf.ru/lk/practice/stor_pdf_ec/2522724');
  assert.ok(r.dela[0].delo.includes('А41-84436/2020'));
  assert.strictEqual(r.knopka.cel, 'razbor31_check');
  assert.ok(!r.knopka.slezh, 'писем слежения нет — второй кнопки не ставим');
  for (const f of ['nalogi/kody-statusa-egryul/index.html', 'nalogi/skolko-platit-vpered-neznakomoj-kompanii/index.html']) {
    assert.ok(D.ssylki_s_sajta[f].includes(SLUG), 'входящая ссылка с ' + f);
    assert.ok(un(chitat(f)).includes(URL), 'ссылка собрана в ' + f);
  }
});

test('Разбор № 31: суммы и даты по тексту [Право], 5 лет хранения, исход не обещан, без имён физлиц', () => {
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  for (const s of ['21 261 258,01 ₽', '19,06 млн ₽', '210 млн ₽', '96,6 млн', '29,8 млн', '84 млн ₽', 'ст. 59 НК РФ',
    'ст. 61.11 Закона о банкротстве', '№ 50-П', '№ 32-П', '№ 39-П', '№ 53', 'пп. 8 п. 1 ст. 23 НК РФ', 'не меньше 5 лет'])
    assert.ok(t.includes(s), s);
  for (const d of ['2018-09-28', '2020-02-25', '2025-03-14', '2025-07-17', '2026-02-19']) assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  assert.ok(!/4 года|четыре года/.test(t), 'срок хранения — 5 лет, не 4 ([Право] 30.10)');
  assert.ok(/пока неизвестно/.test(t), 'исход нового рассмотрения не известен — так и пишем');
  assert.ok(!/blockquote/.test(t), 'длинных цитат без сверки буква в букву не ставим');
  assert.ok(!/(?<!не )гарантир|точно (взыщут|ответит)|придётся заплатить/i.test(t), 'исход не обещаем');
  assert.ok(!/[А-ЯЁ][а-яё]+ов(а)? [А-ЯЁ]\. ?[А-ЯЁ]\./.test(t), 'имён физлиц нет');
  const s = un(chitat('praktika/nalogi/' + SLUG + '/index.html'));
  assert.ok(/"@type": ?"FAQPage"/.test(s) && s.includes('razbor31_check'));
});

test('sroki.json: 170956 — пересверка [Право] 30.10, proverit_do 15.12', () => {
  const S = JSON.parse(chitat('sroki.json'));
  const z = S.sroki.find((x) => x.id === 'zakonoproekt_170956_chastichnoe_sovpadenie');
  assert.strictEqual(z.proverit_do, '2026-12-15');
  assert.ok(z.sverka.startsWith('2026-10-30'));
});
