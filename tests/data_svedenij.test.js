// data-sveden-v1 (05.10.2026, [Ночные-3]): даты сведений признаков в Паспорте контрагента и PDF-досье.
// Найдено отрисовкой живого /api/report (ООО «ЯНДЕКС», 05.10.2026): у «Задолженность по налогам» as_of = «01.09.2026»,
// а Паспорт и «Досье контрагента» писали «на 09.01.2026» — new Date('01.09.2026') читает «месяц.день».
// Экран проверки и раздел 14 Паспорта в те же минуты писали верно «на 01.09.2026» — на одном документе две даты.
// Тесты шли на выдуманных ответах с ISO-датами «2026-09-01», поэтому ошибку не ловили.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = require('../js/pasport-kontragenta.js');

// Форма — из живого ответа /api/report (05.10.2026), только нужные поля
const ZHIVOJ = {
  checked_at: '2026-10-05T03:21:09+00:00',
  company: { inn: '7736207543', ogrn: '1027700229193', kpp: '770401001', kind: 'LEGAL', status: 'ACTIVE',
    reg_date: '2000-09-14', name_short: 'ООО "ПРИМЕР"', name_full: 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ПРИМЕР"', okved: '62.01' },
  signals: [
    { id: 'status', as_of: null, title: 'Статус', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', status: 'ok' },
    { id: 'address', as_of: null, title: 'Адрес', detail: 'Отметок о недостоверности нет', source: 'ЕГРЮЛ', status: 'ok' },
    { id: 'age', as_of: null, title: 'Возраст компании', detail: 'С 14.09.2000', source: 'ЕГРЮЛ', status: 'ok' },
    { id: 'tax_debt', as_of: '01.09.2026', title: 'Задолженность по налогам', detail: 'Нет', source: 'ФНС, открытые данные', status: 'ok' }
  ],
  dossier: { data_dates: 'ЕГРЮЛ/ЕГРИП — на 01.10.2026; задолженность — на 01.09.2026', kpi: [], charts: {} }
};

function razdel(p, id) { return p.razdely.find((x) => x.id === id); }

test('dataRu: «ДД.ММ.ГГГГ» остаётся как есть, ISO-дата — без сдвига часового пояса', () => {
  assert.strictEqual(P.dataRu('01.09.2026'), '01.09.2026');
  assert.strictEqual(P.dataRu('2026-09-01'), '01.09.2026');
  assert.strictEqual(P.dataRu('31.12.2025'), '31.12.2025');
  assert.strictEqual(P.isoIz('01.09.2026'), '2026-09-01');
  assert.strictEqual(P.isoIz('2026-09-01'), '2026-09-01');
});

test('Паспорт на живом ответе: налоги — «сведения на 01.09.2026», не 09.01', () => {
  const p = P.sobrat(JSON.parse(JSON.stringify(ZHIVOJ)), { persons: false });
  const n = p.razdely.find((x) => x.fakty.some((f) => f.tekst === 'Задолженность по налогам'));
  assert.ok(n, 'нет строки о налогах');
  const f = n.fakty.find((x) => x.tekst === 'Задолженность по налогам');
  assert.strictEqual(P.dataRu(f.data), '01.09.2026');
  assert.strictEqual(P.dataRu(n.data_svedeniy), '01.09.2026');
  const vse = JSON.stringify(p);
  assert.ok(!/09\.01\.2026|2026-01-09/.test(vse), 'в Паспорте снова 9 января');
});

test('самая свежая дата раздела выбирается по календарю, а не по строке «ДД.ММ»', () => {
  const r = JSON.parse(JSON.stringify(ZHIVOJ));
  r.signals.push({ title: 'Недоимка и задолженность по пеням', detail: 'Нет', source: 'ФНС', status: 'ok', as_of: '15.01.2026' });
  const p = P.sobrat(r, { persons: false });
  const daty = p.razdely.filter((x) => x.data_svedeniy).map((x) => x.data_svedeniy);
  assert.ok(daty.every((d) => /^\d{4}-\d{2}-\d{2}/.test(d)), daty.join(', '));
  const n = p.razdely.find((x) => x.fakty.some((f) => f.tekst === 'Задолженность по налогам'));
  if (n.fakty.some((f) => f.data === '2026-01-15')) assert.strictEqual(n.data_svedeniy, '2026-09-01');
});

test('раздел 1: статус и дата регистрации без повторов признаком «ok»', () => {
  const p = P.sobrat(JSON.parse(JSON.stringify(ZHIVOJ)), { persons: false });
  const r1 = razdel(p, 'rekvizity');
  assert.strictEqual(r1.fakty.filter((f) => f.tekst === 'Статус').length, 1);
  assert.strictEqual(r1.fakty.filter((f) => f.tekst === 'Возраст компании').length, 0);
  assert.strictEqual(r1.fakty.filter((f) => f.tekst === 'Адрес').length, 1, 'строку о недостоверности адреса не теряем');
});

test('замечание не прячем: статус с другим значением или тоном остаётся строкой', () => {
  const r = JSON.parse(JSON.stringify(ZHIVOJ));
  r.signals[0] = { title: 'Статус', detail: 'Действующая, есть решение о предстоящем исключении', source: 'ЕГРЮЛ', status: 'bad' };
  r.signals[2] = { title: 'Возраст компании', detail: 'С 14.09.2000', source: 'ЕГРЮЛ', status: 'warn' };
  const r1 = razdel(P.sobrat(r, { persons: false }), 'rekvizity');
  assert.strictEqual(r1.fakty.filter((f) => f.tekst === 'Статус').length, 2);
  assert.strictEqual(r1.fakty.filter((f) => f.tekst === 'Возраст компании').length, 1);
});

function vynut(src, start) {
  const i = src.indexOf(start); assert.ok(i >= 0, start);
  let depth = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (!depth) return src.slice(i, k + 1); } }
  throw new Error('не нашли конец ' + start);
}

test('PDF-досье (report.html): дата сведений «01.09.2026» не превращается в 9 января', () => {
  const s = fs.readFileSync(path.join(ROOT, 'report.html'), 'utf8');
  const esc = (t) => String(t == null ? '' : t);
  const d = new Function('esc', vynut(s, 'function d(v)') + '; return d;')(esc);
  assert.strictEqual(d('01.09.2026'), '01.09.2026');
  assert.strictEqual(d('2026-09-01'), '01.09.2026');
  assert.ok(!/triDaty\(R,function\(v\)\{var x=new Date\(v\)/.test(s), 'triDaty снова через new Date');
});

test('Паспорт компании (/pasport/): дата признака по-русски без перестановки', () => {
  const s = fs.readFileSync(path.join(ROOT, 'pasport', 'index.html'), 'utf8');
  assert.ok(!/new Date\(x\.asOf\)/.test(s), 'asOf снова через new Date');
  const f = new Function(vynut(s, 'function dataSvedenij(v)') + '; return dataSvedenij;')();
  assert.strictEqual(f('01.09.2026'), '01.09.2026');
  assert.strictEqual(f('2026-07-25'), '25.07.2026');
});

test('«Как посчитали предел»: дата ответа реестров в обоих видах', () => {
  const s = fs.readFileSync(path.join(ROOT, 'js', 'usloviya.js'), 'utf8');
  const f = new Function(vynut(s, 'function dataRu(s)') + '; return dataRu;')();
  assert.strictEqual(f('01.09.2026'), '01.09.2026');
  assert.strictEqual(f('2026-10-05'), '05.10.2026');
});
