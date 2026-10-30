// svezhest-demo-v1 (30.10.2026): образец Паспорта не «стареет» сам.
// Образец (/pasport/kontragent/?demo=1, превью /pasport/) берёт дату проверки = сегодня, а набор ФНС «Долги по налогам»
// считается проверенным, только пока он не старше 3 месяцев (js/usloviya.js, SVEZHEST_MES). С набором на 01.09.2026
// образец 01.12.2026 сам себе противоречил бы: в разделе 7 «Долги по налогам — нет», в оговорке — «не проверяли … долги
// по налогам», а показ «Паспорт компании» на /kak-rabotaet/ — «ФНС, на 01.09.2026». Сторож краснеет за 14 дней до
// границы — освежите дату на последний выпущенный набор ФНС (данные на 1-е число выходят около 25-го) в
// pasport/engine.js (DEMO) и /kak-rabotaet/ (показ «Паспорт») одной правкой, как sroki.json.
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const K = path.join(__dirname, '..');
const E = require(path.join(K, 'pasport', 'engine.js'));
const U = require(path.join(K, 'js', 'usloviya.js'));

const ZAPAS_DNEJ = 14;
const segodnyaMsk = (d = new Date()) => new Date(d.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
const ru = (ymd) => ymd.split('-').reverse().join('.');
const nalogi = () => E.DEMO.signals.find((s) => s.id === 'tax_debt');

test('образец: набор ФНС «Долги по налогам» свежий ещё 14 дней (иначе — освежить дату DEMO и /kak-rabotaet/)', () => {
  const s = nalogi();
  assert.ok(s && /^\d{4}-\d{2}-01$/.test(s.as_of), 'дата набора ФНС — 1-е число: ' + (s && s.as_of));
  const [g, m] = s.as_of.split('-').map(Number);
  const granica = new Date(Date.UTC(g, m - 1 + 3, 1)); // как в usloviya.js: + 3 месяца
  const krasneet = new Date(granica.getTime() - ZAPAS_DNEJ * 86400000).toISOString().slice(0, 10);
  const seg = segodnyaMsk();
  assert.ok(seg < krasneet, `сегодня ${seg}: набор образца ${ru(s.as_of)} станет «не проверяли» ${granica.toISOString().slice(0, 10)} — освежите pasport/engine.js (DEMO) и показ «Паспорт» на /kak-rabotaet/`);
});

test('образец сегодня: долги по налогам — не в «не проверяли» оговорки Паспорта', () => {
  const P = require(path.join(K, 'js', 'pasport-kontragenta.js'));
  const IV = require(path.join(K, 'js', 'indeks-vorota.js'));
  const r = JSON.parse(JSON.stringify(E.DEMO));
  r.checked_at = new Date().toISOString(); // как на странице образца
  r.dossier = { kpi: [{ label: 'Выручка за 2025', value: 61400000 }] };
  const p = P.sobrat(r, { usloviya: U, indeksVorota: IV, nomer: 'ОБРАЗЕЦ' });
  const predel = p.razdely.find((x) => x.id === 'predel');
  const t = predel.fakty.map((f) => f.tekst + ' ' + f.znachenie).join(' | ').replace(/[\s\u00a0\u202f]+/g, ' ');
  const neProv = (/не проверяли ([^.]*)/.exec(t) || [])[1] || '';
  assert.doesNotMatch(neProv, /налог/, t);
  assert.ok(t.includes('нет в списке ФНС на ' + ru(nalogi().as_of)), t);
});

test('одна дата набора ФНС: образец Паспорта = показ «Паспорт» на /kak-rabotaet/', () => {
  const d = ru(nalogi().as_of);
  const mass = E.DEMO.signals.find((s) => s.title === 'Массовый адрес');
  assert.strictEqual(mass.as_of, nalogi().as_of, 'массовый адрес и долги — из одного выпуска ФНС');
  const h = fs.readFileSync(path.join(K, 'kak-rabotaet', 'index.html'), 'utf8').replace(/&nbsp;| /g, ' ');
  const daty = [...h.matchAll(/ФНС[^<]{0,30}на (\d{2}\.\d{2}\.\d{4})/g)].map((x) => x[1]);
  assert.ok(daty.length >= 2, 'в показе «Паспорт» две строки ФНС с датой');
  daty.forEach((x) => assert.strictEqual(x, d, 'на /kak-rabotaet/ ' + x + ', в образце ' + d));
});
