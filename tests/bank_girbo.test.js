// bank-girbo-v1 [Ночные-3] 04.10: у банков (и других поднадзорных ЦБ) бухотчётность в ГИР БО передаёт Банк России
// (ч. 9 ст. 18 402-ФЗ) — фраза «а не в ГИР БО» неполна ([Право · Налоговый] 04.10 11:30 разд. 1.4). Сторож по модулям экрана.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const K = path.join(__dirname, '..');
const bezKomm = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');

test('в коде js/ (без комментариев) нет «а не в ГИР БО»', () => {
  const plohie = fs.readdirSync(path.join(K, 'js')).filter((f) => f.endsWith('.js'))
    .filter((f) => /а не в(\s|\\u00a0|' \+ NB \+ ')ГИР/.test(bezKomm(fs.readFileSync(path.join(K, 'js', f), 'utf8'))));
  assert.deepStrictEqual(plohie, []);
});

test('банк с отчётностью в ответе ГИР БО — строка выручки, как у всех (ЦБ передал — считаем)', () => {
  const S = require(path.join(K, 'js', 'sushchestvennoe.js'));
  const r = { company: { inn: '7707083893', ogrn: '1027700132195', okved: '64.19', status: 'ACTIVE', name: 'ПАО «Банк»' },
    dossier: { kpi: [], charts: { revenue: [{ year: 2025, value: 1e9 }], profit: [{ year: 2025, value: 1e8 }] } } };
  const f = S.fakty(r);
  const o = (f.spisok || []).find((x) => x.k === 'otchetnost');
  assert.ok(o, 'строка отчётности есть');
  assert.match(o.nazv, /^Выручка за 2025/);
  assert.ok(!/Банк России/.test(o.znach), 'при наличии отчётности — без строки о Банке России: ' + o.znach);
});

test('«402-ФЗ)» не рвётся по дефису: в html факта и колонки Индекса — в <span class="nw">', () => {
  const S = require(path.join(K, 'js', 'sushchestvennoe.js'));
  const IO = require(path.join(K, 'js', 'indeks-otvet.js'));
  const r = { company: { inn: '7707083893', ogrn: '1027700132195', kind: 'LEGAL', okved: '64.19', status: 'ACTIVE', name_short: 'ПАО «БАНК»', reg_date: '1991-06-20' },
    signals: [{ id: 'tax', title: 'Долги по налогам', status: 'ok', detail: 'Нет в списке ФНС', source: 'ФНС, открытые данные', as_of: '2026-09-01' },
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null }],
    checked_at: '2026-10-04', dossier: { kpi: [], charts: {} } };
  const h = S.html(r);
  assert.ok(h.includes('<span class="nw">402-ФЗ)</span>'), 'факт');
  const k = IO.htmlKolonka(IO.vid(r));
  assert.ok(k.includes('<span class="nw">402-ФЗ).</span>'), 'колонка Индекса');
});
