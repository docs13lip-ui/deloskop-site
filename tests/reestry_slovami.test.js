// otchet-p7-v1 [Ночные запуски] 18.11: «В реестрах» словами в шапке отчёта по ИНН (план 18.11, разд. 3 п. 7).
// Данные — те же плитки DlkPlitki.sobrat; ответ по форме живого /api/check. Компании вымышленные.
// node --test tests/reestry_slovami.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../js/plitki.js');
const R = require('../js/reestry-slovami.js');
const bezNb = (t) => String(t).replace(/\u00a0/g, ' ');
const K = path.join(__dirname, '..');

function blok(nazvanie, istochnik, sostoyanie, dannye, data) {
  return { nazvanie, istochnik, status: sostoyanie === 'not_checked' ? 'ne_provereno' : 'polucheno', sostoyanie, data_svedeniy: data || '2026-11-12T23:39+03:00', dannye: dannye || {} };
}
function otvet(dm) {
  return {
    company: { inn: '7700000001', kind: 'LEGAL', name_short: 'ООО "ОБРАЗЕЦ"', status: 'ACTIVE' },
    checked_at: '2026-11-18T15:00:00Z',
    damia: Object.assign({
      sudy: blok('Арбитражные суды', 'Картотека арбитражных дел (через Checko)', 'found', { vsego: 12, otvetchik_nezaversheno: 3, otvetchik_summa_nezaversheno: 35900 }),
      fssp: blok('Приставы', 'ФССП (через Checko)', 'not_found', { otkryto: 0 }),
      kontrakty: blok('Госконтракты', 'ЕИС: контракты 44-ФЗ и договоры 223-ФЗ (через Checko)', 'found', { vsego: 1, summa: 54000, summa_ohvat: 'vse' }),
      bankrotstvo: blok('Банкротство', 'ЕФРСБ (через Checko)', 'not_found', { vsego: 0 }),
      priostanovki: blok('Счета: решения ФНС о приостановлении', 'ФНС (через DaMIA)', 'not_checked'),
      rnp: blok('Недобросовестные поставщики (РНП)', 'ЕИС', 'not_checked')
    }, dm || {}),
    dossier: { kpi: [], charts: { revenue: [{ year: 2024, value: 412062000 }] } }
  };
}
const S = (dm) => R.stroki(P.sobrat(otvet(dm)));
const po = (s, k) => s.find((x) => x.k === k);

test('пять строк в порядке плиток; Финансов и Связей нет (они в реквизитах проверки и приходят позже)', () => {
  assert.deepStrictEqual(S().map((x) => x.k), ['sudy', 'fssp', 'kontrakty', 'bankrotstvo', 'priostanovki']);
});

test('суды: дела против компании словами плиток, требования — не «долг»; тире не отрывается от слова', () => {
  const s = po(S(), 'sudy');
  assert.strictEqual(bezNb(s.t), '3 незавершённых дела, где компания — ответчик; требования к компании — 36 тыс. ₽');
  assert.ok(!/ —/.test(s.t), 'перед тире — неразрывный пробел');
  assert.strictEqual(s.ton, 'vnim');
  assert.strictEqual(bezNb(s.meta), 'КАД · на 12.11.2026');
  assert.ok(!/долг/i.test(s.t));
});

test('«не нашли» — с источником и датой; «не проверяли» — не «не нашли» и не «чисто»', () => {
  const s = S();
  assert.strictEqual(bezNb(po(s, 'fssp').t), 'Производств не нашли');
  assert.strictEqual(bezNb(po(s, 'fssp').meta), 'ФССП · на 12.11.2026');
  assert.strictEqual(bezNb(po(s, 'bankrotstvo').t), 'Сообщений о банкротстве не нашли');
  assert.strictEqual(bezNb(po(s, 'priostanovki').t), 'Сегодня не проверяли');
  assert.strictEqual(po(s, 'priostanovki').ton, 'ne');
  s.forEach((x) => assert.ok(!/чист|нет долгов|надёжн/i.test(x.t), x.t));
});

test('госконтракты: число, склонение и сумма только при полном охвате; РНП — вместо суммы', () => {
  assert.strictEqual(bezNb(po(S(), 'kontrakty').t), '1 контракт или договор как поставщик на 54 тыс. ₽');
  const chast = S({ kontrakty: blok('Госконтракты', 'ЕИС (через Checko)', 'found', { vsego: 245, summa: 9e8, summa_ohvat: 'pervye_200_iz_245' }) });
  assert.strictEqual(bezNb(po(chast, 'kontrakty').t), '245 контрактов и договоров как поставщик');
  const rnp = S({ rnp: blok('Недобросовестные поставщики (РНП)', 'ЕИС', 'found', {}, '2026-10-12') });
  assert.match(bezNb(po(rnp, 'kontrakty').t), /^1 контракт или договор как поставщик; есть запись в реестре недобросовестных поставщиков на 12\.10\.2026$/);
});

test('приставы с остатком и приостановки: число словами, «не меньше» сохраняется', () => {
  const s = S({
    fssp: blok('Приставы', 'ФССП (через Checko)', 'found', { otkryto: 2, ostatok: 8166155, ostatok_tochno: false }),
    priostanovki: blok('Счета: решения ФНС о приостановлении', 'ФНС (через DaMIA)', 'found', { vsego: 1 })
  });
  assert.strictEqual(bezNb(po(s, 'fssp').t), '2 производства; остаток долга — не меньше 8,1 млн ₽');
  assert.strictEqual(bezNb(po(s, 'priostanovki').t), '1 решение ФНС о приостановке счетов');
  assert.strictEqual(po(s, 'priostanovki').ton, 'vnim');
});

test('устаревшие сведения — с датой, не «не нашли»', () => {
  const s = S({ rnp: undefined, kontrakty: blok('Госконтракты', 'ЕИС (через Checko)', 'stale', {}, '2026-10-12') });
  assert.strictEqual(bezNb(po(s, 'kontrakty').t), 'Сведения устарели — на 12.10.2026');
});

test('ИП — те же пять строк; пустой ответ — пусто', () => {
  const r = otvet(); r.company.inn = '770000000012'; r.company.kind = 'INDIVIDUAL';
  assert.strictEqual(R.stroki(P.sobrat(r)).length, 5);
  assert.deepStrictEqual(R.stroki(P.sobrat(null)), []);
  assert.strictEqual(R.html([]), '');
});

test('разметка: заголовок, ссылки к плиткам, экранирование', () => {
  const h = bezNb(R.html(S()));
  assert.match(h, /<section class="rs1" aria-labelledby="rs1-h"><h2 id="rs1-h" class="rs1__h">В реестрах<\/h2>/);
  assert.strictEqual((h.match(/href="#pl-h"/g) || []).length, 5);
  assert.match(h, /data-rs="sudy"/);
  assert.ok(!/<script/i.test(R.html([{ k: 'x', zag: '<script>', t: 'a', ton: '', meta: '' }])));
});

test('подключено: пакет «otchet» после plitki.js, вызов в index.html после DlkPlitki.mount, цвета — токенами', () => {
  const sb = JSON.parse(fs.readFileSync(path.join(K, 'partials/sborka.json'), 'utf8')).pakety.otchet;
  assert.ok(sb.indexOf('js/reestry-slovami.js') > sb.indexOf('js/plitki.js'));
  assert.ok(sb.indexOf('js/zametka-otcheta.js') > sb.indexOf('js/plitki.js'));
  const ix = fs.readFileSync(path.join(K, 'index.html'), 'utf8');
  const a = ix.indexOf('DlkPlitki.mount(report,r)'), b = ix.indexOf('DlkReestrySlovami.mount(report,r)'), c = ix.indexOf('DlkZametkaOtcheta.mount(report,r)');
  assert.ok(a > 0 && b > a && c > b);
  assert.ok(!/#[0-9A-Fa-f]{3,6}(?![0-9A-Fa-f]*\))/.test(R.CSS.replace(/var\(--[\w-]+,#[0-9A-Fa-f]+\)/g, '')), 'цвет только var(--x,#…)');
});
