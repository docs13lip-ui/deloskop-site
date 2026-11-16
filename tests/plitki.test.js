// plitki-schetchiki-v1 [Ночные запуски] 16.11: ряд плиток-счётчиков под «Плюсами и минусами» (план отчёта 15.11, п. 1.3).
// Форма ответа — живой /api/check 16.11 04:07 (крупная сетевая компания: 1 426 идущих дел как ответчик на 2,6 млрд ₽,
// 449 производств у приставов, 10 875 госконтрактов; приостановки, меры и РНП — «не проверено»). Компании ниже вымышленные.
// node --test tests/plitki.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../js/plitki.js');
const bezNb = (t) => String(t).replace(/ /g, ' ');
const K = path.join(__dirname, '..');
const po = (T, k) => T.find((x) => x.k === k);

function otvet(o) {
  o = o || {};
  return {
    company: Object.assign({ inn: '7700000001', kind: 'LEGAL', name_short: 'ПАО "ОБРАЗЕЦ"', status: 'ACTIVE' }, o.company || {}),
    checked_at: '2026-11-16T01:07:00Z',
    damia: o.damia || {
      sudy: { nazvanie: 'Арбитражные суды', istochnik: 'Картотека арбитражных дел (через Checko)', status: 'polucheno', sostoyanie: 'found', data_svedeniy: '2026-11-12T23:39+03:00',
        dannye: { vsego: 5652, otvetchik: 5652, otvetchik_nezaversheno: 1426, otvetchik_summa_nezaversheno: 2633108092.69 } },
      fssp: { nazvanie: 'Приставы', istochnik: 'ФССП (через Checko)', status: 'polucheno', sostoyanie: 'found', data_svedeniy: '2026-11-12T23:39+03:00',
        dannye: { otkryto: 449, ostatok: 8166155.28, ostatok_tochno: false, zapisej_vsego: 449 } },
      bankrotstvo: { nazvanie: 'Банкротство', istochnik: 'ЕФРСБ (через Checko)', status: 'polucheno', sostoyanie: 'not_found', data_svedeniy: '2026-11-12T23:39+03:00', dannye: { vsego: 0 } },
      priostanovki: { nazvanie: 'Счета: решения ФНС о приостановлении', istochnik: 'ФНС: действующие решения о приостановлении операций по счетам (через DaMIA)', status: 'ne_provereno', sostoyanie: 'not_checked' },
      rnp: { nazvanie: 'Недобросовестные поставщики (РНП)', status: 'ne_provereno', sostoyanie: 'not_checked' },
      kontrakty: { nazvanie: 'Госконтракты', istochnik: 'ЕИС: контракты 44-ФЗ и договоры 223-ФЗ (через Checko)', status: 'polucheno', sostoyanie: 'found', data_svedeniy: '2026-11-12T23:40+03:00',
        dannye: { vsego: 10875, summa: 970810240, summa_ohvat: 'pervye_200_iz_10875' } }
    },
    dossier: Object.assign({ kpi: [{ label: 'Выручка за 2025', value: 149813246000 }], charts: { revenue: [{ year: 2024, value: 132294213000 }, { year: 2025, value: 149813246000 }] } }, o.dossier || {})
  };
}

test('семь плиток в порядке плана: Суды · Приставы · Госконтракты · Банкротство · Приостановки · Финансы · Связи', () => {
  const T = P.sobrat(otvet());
  assert.deepStrictEqual(T.map((x) => x.zag), ['Суды', 'Приставы', 'Госконтракты', 'Банкротство', 'Приостановки', 'Финансы', 'Связи']);
});

test('суды: число — идущие дела против компании, с суммой исков; латунный кант', () => {
  const s = po(P.sobrat(otvet()), 'sudy');
  assert.strictEqual(bezNb(s.c), '1 426');
  assert.strictEqual(bezNb(s.e), 'незавершённых дел, где компания — ответчик');
  assert.strictEqual(bezNb(s.pod), 'требования к компании — 2,6 млрд ₽');
  assert.strictEqual(s.slovo, 'есть');
  assert.strictEqual(s.ton, 'vnim');
  assert.strictEqual(s.ist, 'КАД', 'на плитке — коротко, чтобы влезла дата; полностью — в подсказке');
  assert.match(s.ist_polno, /через Checko/);
  assert.strictEqual(s.data, '12.11.2026');
  assert.strictEqual(s.nazv, 'Арбитражные суды');
  // одно идущее дело — единственное число
  const r = otvet(); r.damia.sudy.dannye.otvetchik_nezaversheno = 1;
  assert.strictEqual(bezNb(po(P.sobrat(r), 'sudy').e), 'незавершённое дело, где компания — ответчик');
  // нет идущих — «не нашли», без канта, подпись — сколько дел всего в картотеке
  r.damia.sudy.dannye.otvetchik_nezaversheno = 0;
  const s0 = po(P.sobrat(r), 'sudy');
  assert.strictEqual(s0.slovo, 'не нашли');
  assert.strictEqual(s0.ton, 'net');
  assert.strictEqual(bezNb(s0.pod), 'всего в картотеке: 5 652');
});

test('приставы: остаток посчитан не полностью — «от» и вниз (8,16 → 8,1, не 8,2)', () => {
  const f = po(P.sobrat(otvet()), 'fssp');
  assert.strictEqual(bezNb(f.c), '449');
  assert.strictEqual(f.e, 'производств');
  assert.strictEqual(bezNb(f.pod), 'остаток долга — не меньше 8,1 млн ₽');
  const r = otvet(); r.damia.fssp.dannye.ostatok_tochno = true;
  assert.strictEqual(bezNb(po(P.sobrat(r), 'fssp').pod), 'остаток долга — 8,2 млн ₽');
});

test('госконтракты: сумма по части контрактов не выдаётся за полную; РНП найден — подпись и кант', () => {
  const k = po(P.sobrat(otvet()), 'kontrakty');
  assert.strictEqual(bezNb(k.c), '10 875');
  assert.ok(!k.pod, 'сумма по 200 свежим из 10 875 — не на плитке');
  assert.strictEqual(k.ton, 'est');
  const r = otvet(); delete r.damia.kontrakty.dannye.summa_ohvat; r.damia.rnp.sostoyanie = 'found'; r.damia.rnp.status = 'polucheno';
  const k2 = po(P.sobrat(r), 'kontrakty');
  assert.strictEqual(bezNb(k2.pod), 'есть запись в реестре недобросовестных поставщиков');
  assert.strictEqual(k2.ton, 'vnim');
});

test('не проверено ≠ не нашли: источник не ответил — «—» и «не проверено», не «0»', () => {
  const T = P.sobrat(otvet());
  const p = po(T, 'priostanovki');
  assert.strictEqual(p.c, '—');
  assert.strictEqual(p.slovo, 'не проверено');
  assert.strictEqual(p.ton, 'ne');
  assert.strictEqual(bezNb(p.e), 'сегодня не проверяли');
  const b = po(T, 'bankrotstvo');
  assert.strictEqual(b.c, '0');
  assert.strictEqual(b.slovo, 'не нашли');
  // устаревшие сведения — тоже не проверка на сегодня, с датой
  const r = otvet(); r.damia.fssp.status = 'stale';
  const f = po(P.sobrat(r), 'fssp');
  assert.strictEqual(f.slovo, 'не проверено');
  assert.strictEqual(bezNb(f.e), 'сведения на 12.11.2026');
  // нигде не пишем «чисто»: это оценка, а не факт
  assert.ok(!JSON.stringify(P.sobrat(otvet())).includes('чисто'));
});

test('финансы: последняя выручка числом и единицей отдельно; старая отчётность — «старая» и кант', () => {
  const f = po(P.sobrat(otvet()), 'finansy');
  assert.strictEqual(f.c, '149,8');
  assert.strictEqual(bezNb(f.e), 'млрд ₽ выручки за 2025');
  assert.strictEqual(f.slovo, 'отчётность есть');
  assert.strictEqual(f.sel, '.din');
  const r = otvet({ dossier: { kpi: [], charts: { revenue: [{ year: 2021, value: 5e6 }] } } });
  const s = po(P.sobrat(r), 'finansy');
  assert.strictEqual(s.slovo, 'старая отчётность');
  assert.strictEqual(s.ton, 'vnim');
  const n = po(P.sobrat(otvet({ dossier: { kpi: [], charts: {} } })), 'finansy');
  assert.strictEqual(n.c, '—');
});

test('ИП: без «Финансов» и «Связей», данных человека в плитках нет', () => {
  const T = P.sobrat(otvet({ company: { inn: '770000000012', kind: 'INDIVIDUAL', name_short: 'ИП Иванов И. И.' } }));
  assert.deepStrictEqual(T.map((x) => x.k), ['sudy', 'fssp', 'kontrakty', 'bankrotstvo', 'priostanovki']);
  assert.ok(!P.html(T).includes('Иванов'));
});

test('связи: ждём → ответ «Кто рядом» (est / pusto / сбой)', () => {
  assert.strictEqual(P.svyaziPlitka(null).slovo, 'ждём');
  const e = P.svyaziPlitka({ sost: 'est', n: 10, vsego: 14 });
  assert.strictEqual(e.c, '14');
  assert.strictEqual(bezNb(e.e), 'организаций рядом');
  assert.strictEqual(P.svyaziPlitka({ sost: 'pusto' }).slovo, 'не нашли');
  assert.strictEqual(P.svyaziPlitka({ sost: 'oshibka' }).slovo, 'не проверено');
});

test('разметка: заголовок, 7 плиток, подсказка с полным источником; без красного цвета', () => {
  const h = P.html(P.sobrat(otvet()));
  assert.strictEqual((h.match(/<li class="pl__t/g) || []).length, 7);
  assert.match(h, /Коротко по.реестрам/);
  assert.match(h, /title="Картотека арбитражных дел \(через Checko\), на 12\.11\.2026"/);
  assert.strictEqual(P.html([]), '');
  assert.ok(!/#(?:c|d|e|f)[0-3][0-3][0-3]\b|:\s*red\b|crimson/i.test(P.CSS), 'красного светофора нет');
  assert.ok(!/font-size:(?:[0-9]|1[01])px/.test(P.CSS), 'шрифт не меньше 12 px');
});

test('главная: плитки — сразу после «Плюсов и минусов», в пакете otchet после plyusy-minusy; «Связи» — по ответу «Кто рядом»', () => {
  const G = fs.readFileSync(path.join(K, 'index.html'), 'utf8');
  const a = G.indexOf('PlyusyMinusy.mount(report,r)'), b = G.indexOf('DlkPlitki.mount(report,r)');
  assert.ok(a > 0 && b > a, 'после «Плюсов и минусов»');
  assert.match(G, /DlkKrug\.mount\(report,r,\{api:CAPI\}\)\.then\(function\(o\)\{if\(window\.DlkPlitki\)DlkPlitki\.svyazi\(report,o\)\}\)/);
  const S = JSON.parse(fs.readFileSync(path.join(K, 'partials/sborka.json'), 'utf8'));
  const ot = S.pakety.otchet;
  assert.ok(ot.indexOf('js/plitki.js') === ot.indexOf('js/plyusy-minusy.js') + 1);
});
