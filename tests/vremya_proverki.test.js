// vremya-proverki-v1 (04.10.2026, [Ночные-3]): /api/check отдаёт checked_at только датой («2026-10-04»).
// Date.parse даёт полночь UTC — на экране выходило «Проверено 04.10.2026, 03:00 МСК» и в /pasport/
// «Сверено с реестрами …, 03:00 МСК» — время, которого не было. Теперь: дата — как в ответе, время —
// момент получения ответа (тот же день по Москве) или без времени.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const R = require('../js/rekvizity-proverki.js');
const P = require('../js/pasport-cta.js');
const ROOT = path.join(__dirname, '..');
const NB = '\u00a0';
const otvet = (checked_at) => ({ checked_at, report_id: 'tJv5PMGrnrCg', company: { inn: '7736050003' }, signals: [], dossier: {} });

test('только дата, момент получения не передан — дата без времени, «03:00» нет', () => {
  const o = R.sobrat(otvet('2026-10-04'));
  assert.strictEqual(o.data, '04.10.2026');
  assert.strictEqual(o.vremya, '');
  const h = R.html(otvet('2026-10-04'));
  assert.ok(h.includes('04.10.2026'));
  assert.ok(!h.includes('МСК') && !h.includes('03:00'));
});

test('только дата + ответ получен в тот же день по Москве — время получения', () => {
  const o = R.sobrat(otvet('2026-10-04'), { polucheno: new Date('2026-10-04T01:21:38Z') });
  assert.strictEqual(o.data, '04.10.2026');
  assert.strictEqual(o.vremya, '04:21');
  assert.ok(R.html(otvet('2026-10-04'), { polucheno: Date.parse('2026-10-04T01:21:38Z') }).includes('04.10.2026, 04:21' + NB + 'МСК'));
});

test('только дата + по Москве уже другой день — время не подставляем, дата из ответа', () => {
  const o = R.sobrat(otvet('2026-10-04'), { polucheno: new Date('2026-10-04T21:30:00Z') }); // 05.10 00:30 МСК
  assert.strictEqual(o.data, '04.10.2026');
  assert.strictEqual(o.vremya, '');
});

test('полная метка времени — как раньше, момент получения не мешает', () => {
  const o = R.sobrat(otvet('2026-10-04T01:21:38.018547+00:00'), { polucheno: new Date('2026-10-04T09:00:00Z') });
  assert.strictEqual(o.data, '04.10.2026');
  assert.strictEqual(o.vremya, '04:21');
});

test('главная передаёт момент получения ответа в реквизиты', () => {
  const h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(h.includes('RekvizityProverki.mount(report,r,{polucheno:new Date()})'));
});

test('Паспорт: «Сформирован» по одной дате — без «в 03:00»', () => {
  assert.strictEqual(P.vremyaRu('2026-10-04'), '04.10.2026');
  assert.strictEqual(P.vremyaRu('2026-10-04T01:21:38Z'), '04.10.2026 в 04:21');
});

test('/pasport/: «Сверено с реестрами» — время только если оно известно', () => {
  const h = fs.readFileSync(path.join(ROOT, 'pasport', 'index.html'), 'utf8');
  assert.ok(!/new Date\(r\.checked_at\|\|Date\.now\(\)\)/.test(h), 'checked_at напрямую в Date — снова «03:00»');
  const msk = h.match(/  function msk\(d,opt\)\{[^\n]*\}/)[0];
  const i = h.indexOf('  function kogdaSvereno(');
  assert.ok(i > 0, 'нет kogdaSvereno');
  const kod = h.slice(i, h.indexOf('\n  function ', i + 10));
  const ctx = {}; vm.createContext(ctx); vm.runInContext(msk + '\n' + kod, ctx);
  const seichas = new Date('2026-10-04T01:21:00Z');
  const a = ctx.kogdaSvereno('2026-10-04', seichas);
  assert.strictEqual(a.vremya, true); assert.strictEqual(a.at.getTime(), seichas.getTime());
  const b = ctx.kogdaSvereno('2026-10-03', seichas);
  assert.strictEqual(b.vremya, false); assert.strictEqual(ctx.msk(b.at, { day: '2-digit', month: '2-digit', year: 'numeric' }), '03.10.2026');
  const c = ctx.kogdaSvereno('2026-10-04T01:21:38Z', seichas);
  assert.strictEqual(c.vremya, true); assert.strictEqual(ctx.msk(c.at, { hour: '2-digit', minute: '2-digit' }), '04:21');
  assert.ok(h.includes("(kog.vremya?', '+msk(at,{hour:'2-digit',minute:'2-digit'})+' МСК':'')"));
});
