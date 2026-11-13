// bank-girbo-v2 [Ночные-3] 04.10: банк без отчётности в ответе ГИР БО — «Откуда данные» и Паспорт контрагента пишут,
// как устроено (сдаёт в Банк России; в ГИР БО передаёт Банк России, доступ может быть ограничен — ч. 9 и 12 ст. 18 402-ФЗ),
// а не «отчётности нет» / «могла её не сдавать». Текст — [Право · Налоговый] 04.10 11:30 разд. 1.4 + 12:30 разд. 1.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const U = require(path.join(ROOT, 'js', 'usloviya.js'));
const IV = require(path.join(ROOT, 'js', 'indeks-vorota.js'));

const NB = '\u00a0';
const otvet = (okved, charts) => ({
  checked_at: '2026-10-04',
  company: { inn: '7707083893', ogrn: '1027700132195', kind: 'LEGAL', okved: okved, status: 'ACTIVE', name_short: 'ПАО «БАНК»', name_full: 'ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО «БАНК»', reg_date: '1991-06-20' },
  signals: [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null }],
  dossier: { kpi: [], charts: charts || {} }
});
const plain = (s) => String(s).replace(/\u00a0/g, ' ');

test('Паспорт контрагента: банк без ГИР БО — раздел «Финансы» не пишет «могла её не сдавать», первая ссылка — cbr.ru', () => {
  const p = P.sobrat(otvet('64.19'), { usloviya: U, indeksVorota: IV });
  const f = p.razdely.find((x) => x.id === 'finansy');
  assert.strictEqual(f.status, 'not_checked');
  assert.ok(!/могла её не сдавать/.test(f.prichina), f.prichina);
  assert.match(plain(f.prichina), /^Бухгалтерскую отчётность организация сдаёт в Банк России; в ГИР БО её передаёт Банк России, доступ может быть ограничен \(ч\. 9 и 12 ст\. 18 402-ФЗ\)\.$/);
  assert.strictEqual(f.sam[0].url, 'https://www.cbr.ru/finorg/foinfo/?ogrn=1027700132195');
  assert.ok(f.sam.some((s) => s.url === 'https://bo.nalog.gov.ru/'), 'ГИР БО в «проверьте сами» остаётся');
  assert.deepStrictEqual(P.proverit(p), []);
});

test('Паспорт контрагента: не банк без ГИР БО — прежняя причина; ссылки cbr.ru нет', () => {
  const p = P.sobrat(otvet('46.71'), { usloviya: U, indeksVorota: IV });
  const f = p.razdely.find((x) => x.id === 'finansy');
  assert.match(f.prichina, /могла её не сдавать/);
  assert.ok(!f.sam.some((s) => /cbr\.ru/.test(s.url)));
});

test('Паспорт контрагента: ссылка cbr.ru не копится между сборками (RAZDELY не мутируется)', () => {
  P.sobrat(otvet('64.19'), { usloviya: U, indeksVorota: IV });
  const p = P.sobrat(otvet('64.19'), { usloviya: U, indeksVorota: IV });
  const f = p.razdely.find((x) => x.id === 'finansy');
  assert.strictEqual(f.sam.filter((s) => /cbr\.ru/.test(s.url)).length, 1);
  assert.strictEqual(P.RAZDELY.find((d) => d.id === 'finansy').sam.length, 1);
});
