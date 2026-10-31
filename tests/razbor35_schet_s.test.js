// razbor35-v1 ([Ночные запуски] 31.10): Разбор № 35 «Вернули заём иностранному владельцу напрямую» —
// текст [Право] 31.10 (claude/Право_✎_иностранный_контрагент_Обзоры_ВС_Разбор_35_31.10.md, разд. 4);
// первоисточник — Тематический обзор ВС № 8/2026 (vsrf.ru/documents/all/36053/, текст пп. 3–6 — consultant.ru 31.10),
// порог «10 млн ₽ в календарный месяц» — текст Указа № 95 (rg.ru 09.03.2022). Номеров дел в обзоре нет — карточка обзора.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/‑/g, '-');
const SLUG = 'zaem-inostrannoj-kompanii-schet-s-vs-2026';
const URL = '/praktika/dogovory/' + SLUG + '/';

test('Разбор № 35: данные — обзор Президиума ВС 17.06.2026 без номера дела, «Договоры», 2 входящие, razbor35_check', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory.find((x) => x.slug === SLUG);
  assert.ok(r && r.razdel === 'dogovory');
  assert.strictEqual(r.dela.length, 1);
  const d = r.dela[0];
  assert.ok(d.vid === 'obzor' && d.nomer === '' && d.data === '2026-06-17' && /№ 8\/2026/.test(d.akt));
  assert.strictEqual(d.istochnik, 'https://vsrf.ru/documents/all/36053/');
  assert.strictEqual(r.knopka.cel, 'razbor35_check');
  assert.ok(r.title.length <= 70 && r.description.length <= 160);
  for (const f of ['nalogi/proverka-kontragenta-pered-dogovorom/index.html', 'nalogi/nedruzhestvennye-gosudarstva-perechen/index.html']) {
    assert.ok(D.ssylki_s_sajta[f].includes(SLUG), 'входящая ссылка с ' + f);
    assert.ok(un(chitat(f)).includes(URL), 'ссылка собрана в ' + f);
  }
});

test('Разбор № 35: факты обзора и честные оговорки; без «запрещено/нельзя», без имён и обещаний', () => {
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  for (const s of ['10 млн ₽ в календарный месяц', '6 млрд ₽', 'п. 2 ст. 168 ГК', 'п. 1 ст. 167 ГК', 'счёта типа «С»', '(п. 4)', '(п. 5)', '(п. 6)',
    'Это наш вывод, а не позиция ВС', 'может считаться непогашенным', 'href="/nalogi/nedruzhestvennye-gosudarstva-perechen/"'])
    assert.ok(t.includes(s), s);
  for (const d of ['2022-11-15', '2026-06-17']) assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  assert.ok(!/запрещено|нельзя/i.test(t), 'правила зависят от вида сделки — без «запрещено» и «нельзя»');
  assert.ok(!/ООО|АО «|ПАО/.test(t), 'названий компаний нет');
  assert.ok(!/(?<!не )гарантируем|суд признает|вы выиграете/i.test(t), 'исход не обещаем');
  assert.ok(!/постановлени\S* Пленума ВС от 23\.06\.2015/.test(t), 'п. 8 Пленума № 25 в тексте обзора не сверен — не ставим');
});

test('Разбор № 35: страница собрана — h1, FAQ 3, кнопка кредитора, карточка обзора', () => {
  const h = un(chitat('praktika/dogovory/' + SLUG + '/index.html'));
  assert.ok(h.includes('Вернули заём иностранному владельцу напрямую. Чем это кончается в суде'));
  assert.strictEqual((h.match(/<h1[ >]/g) || []).length, 1);
  assert.strictEqual((h.match(/"@type": ?"Question"/g) || []).length, 3);
  assert.ok(h.includes('Проверить кредитора по ИНН') && h.includes('data-goal="razbor35_check"'));
  assert.ok(h.includes('Карточка обзора') && !/№ ·|  ·|· ·/.test(h));
});
