'use strict';
// istochniki-checko-v1 ([Ночные запуски] 12.11.2026). Живой /api/check 12.11 19:10: суды, приставы и ЕФРСБ отвечают
// «через Checko» на день проверки, а реестр источников и главная говорили «не обновляется с 12.10» и «ЕФРСБ не подключён».
// Ответ юриста 12.11 (Право_блоки_12.11, п. 1): подпись — «<реестр> — через Checko»; ошибка посредника — «не проверено»,
// а не «0 дел»; ФИО граждан и ИП из сторон дел и производств не показываем (п. 1.3) — маска до любого вывода и хранения.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const I = require('../js/istochniki.js');

const K = path.join(__dirname, '..');
const R = JSON.parse(fs.readFileSync(path.join(K, 'data/istochniki.json'), 'utf8'));
const G = fs.readFileSync(path.join(K, 'index.html'), 'utf8');
const plain = (s) => String(s).replace(/&nbsp;| /g, ' ');

function otvet(dm) {
  return { company: { inn: '7736186950', kind: 'LEGAL', status: 'ACTIVE', name_short: 'ООО «Тест»' },
    checked_at: '2026-11-12T16:10:00Z', damia: dm };
}

test('реестр: суды, приставы и ЕФРСБ подключены через Checko; РНП и решения ФНС — по-прежнему с 12.10', () => {
  const po = (id) => R.istochniki.find((x) => x.id === id);
  for (const id of ['kad', 'fssp', 'efrsb']) {
    assert.strictEqual(po(id).sostoyanie, 'podklyuchen', id);
    assert.strictEqual(po(id).cherez, 'Checko', id);
    assert.match(po(id).data_nabora, /^через Checko/, id);
    assert.ok(!po(id).zamorozhen_s, id + ': без даты заморозки');
  }
  assert.deepStrictEqual(po('kad').damia, ['sudy'], 'банкротство — не картотека, а ЕФРСБ');
  assert.deepStrictEqual(po('efrsb').damia, ['bankrotstvo']);
  for (const id of ['eis', 'nalog_bi']) assert.strictEqual(po(id).sostoyanie, 'zamorozhen', id);
});

test('главная: без «суды не обновляем» (таблицы источников на главной нет — bez-otkuda-v1, 13.11; «через Checko» — у факта в отчёте)', () => {
  assert.ok(!G.includes('<!--istochniki-glavnaya-->'));
  assert.ok(!/Суды, приставов и&nbsp;госзакупки сейчас не&nbsp;обновляем/.test(G));
  assert.ok(!/банкротства не&nbsp;подключены/.test(G));
});

test('подключённый источник без ответа — «не удалось проверить», не «не подключён» и не «0 дел»', () => {
  const r = I.dopolnit(otvet({
    sudy: { nazvanie: 'Арбитражные суды', istochnik: 'Картотека арбитражных дел (через Checko)', status: 'ne_provereno', sostoyanie: 'not_checked' },
    fssp: { nazvanie: 'Приставы', istochnik: 'ФССП (через Checko)', status: 'ne_provereno', sostoyanie: 'not_checked' }
  }));
  for (const k of ['sudy', 'fssp']) {
    const b = r.damia[k];
    assert.strictEqual(b.status_edinyj, 'error', k);
    assert.match(plain(b.status_edinyj_tekst), /^Не удалось проверить: .* не ответил\. Повторите позже\.$/, k);
    assert.ok(!/не подключён|записей нет|0 дел/.test(b.status_edinyj_tekst), k);
    assert.ok(!b.zamorozhen, k);
  }
});

test('маска сторон: ФИО граждан и ИП → «физическое лицо» / «индивидуальный предприниматель», организации и суды — как есть', () => {
  const tablica = [
    ['Бацунова С. И.', 'физическое лицо'], ['С. И. Бацунова', 'физическое лицо'], ['ИВАНОВ ИВАН ИВАНОВИЧ', 'физическое лицо'],
    ['Иванова Мария Петровна', 'физическое лицо'], ['Мамедов Рашид Али оглы', 'физическое лицо'], ['Петрова-Водкина А.', 'физическое лицо'],
    ['ИП Петров П. П.', 'индивидуальный предприниматель'], ['Индивидуальный предприниматель Сидоров С. С.', 'индивидуальный предприниматель'],
    ['ООО "МОРТРАНССЕРВИС-НХБ"', 'ООО "МОРТРАНССЕРВИС-НХБ"'], ['УМИ АДМИНИСТРАЦИИ ДАЛЬНЕГОРСКОГО ОКРУГА', 'УМИ АДМИНИСТРАЦИИ ДАЛЬНЕГОРСКОГО ОКРУГА'],
    ['Слободской районный суд Кировской области', 'Слободской районный суд Кировской области'], ['ПАО Сбербанк', 'ПАО Сбербанк'],
    ['НКО "НИЖЕГОРОДСКИЙ ФОНД РЕМОНТА МКД"', 'НКО "НИЖЕГОРОДСКИЙ ФОНД РЕМОНТА МКД"']
  ];
  for (const [v, ozh] of tablica) assert.strictEqual(I.storona(v), ozh, v);
});

test('маска сторон: ответ API (форма 12.11) после dopolnit — без ФИО в сторонах; номер дела, суд и сумма на месте', () => {
  const r = I.dopolnit(otvet({
    sudy: { nazvanie: 'Арбитражные суды', istochnik: 'Картотека арбитражных дел (через Checko)', status: 'polucheno', data_svedeniy: '2026-11-12T19:10+03:00',
      dannye: { vsego: 3, otvetchik_nezaversheno: 2, dela: [
        { nomer: 'А32-71991/2026', sud: 'АС Краснодарского края', summa: 34500, istcy: ['ООО "МОРТРАНССЕРВИС-НХБ"', 'Бацунова С. И.'] },
        { nomer: 'А40-1/2026', sud: 'АС города Москвы', summa: 1000, istcy: ['ИП Петров П. П.'], storony: [{ naimenovanie: 'ИВАНОВ ИВАН ИВАНОВИЧ', rol: 'истец', inn: '772012345678' }, { naimenovanie: 'ООО «Тест»', inn: '7736186950' }] }] } },
    fssp: { nazvanie: 'Приставы', istochnik: 'ФССП (через Checko)', status: 'polucheno', data_svedeniy: '2026-11-12T19:10+03:00',
      dannye: { otkryto: 1, proizvodstva: [{ nomer: '1/26/77006-ИП', 'Взыскатель': 'Сидорова Анна Викторовна', 'ДолжНаим': 'ООО «Тест»', ostatok: 750 }] } }
  }));
  const s = JSON.stringify(r.damia);
  for (const fio of ['Бацунова', 'Петров', 'ИВАНОВ', 'Сидорова']) assert.ok(!s.includes(fio), 'в ответе осталось: ' + fio);
  const d = r.damia.sudy.dannye.dela;
  assert.deepStrictEqual(d[0].istcy, ['ООО "МОРТРАНССЕРВИС-НХБ"', 'физическое лицо']);
  assert.deepStrictEqual(d[1].istcy, ['индивидуальный предприниматель']);
  assert.strictEqual(d[1].storony[0].naimenovanie, 'физическое лицо');
  assert.ok(!('inn' in d[1].storony[0]), 'ИНН гражданина или ИП (12 цифр) — убран');
  assert.strictEqual(d[1].storony[1].inn, '7736186950', 'ИНН организации остаётся');
  assert.strictEqual(d[0].nomer, 'А32-71991/2026');
  assert.strictEqual(d[0].sud, 'АС Краснодарского края');
  assert.strictEqual(r.damia.fssp.dannye.proizvodstva[0]['ДолжНаим'], 'ООО «Тест»', 'наименование организации-должника остаётся');
});
