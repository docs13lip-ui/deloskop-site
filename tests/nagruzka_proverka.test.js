// nagruzka-proverka-v1 (Ночные-3, 11.10): «Налоги и взносы против отрасли» на экране проверки по ИНН
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
require('./razvernut_sborku.js'); // vizual-v3.0a: главная подключает пакеты — сторож видит исходники в порядке исполнения
const path = require('path');
const P = require('../js/nagruzka-proverka.js');

const KOREN = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(KOREN, 'data', 'fns-normy-2025.json'), 'utf8'));
const NB = ' ';

// Ответ /api/check в виде живого API: KPI «Налоги и взносы за год» + дата набора строкой в dossier.data_dates
function otvet(o) {
  o = o || {};
  return {
    company: { inn: '7700000001', okved: o.okved || '41.20', name_short: 'ООО «Пример»' },
    signals: o.signals || [{ title: 'Налоговый режим', status: 'ok', detail: 'ОСН', source: 'ФНС, открытые данные', as_of: '2026-09-25' }],
    dossier: {
      data_dates: o.dd != null ? o.dd : 'ЕГРЮЛ/ЕГРИП — на 01.10.2026; задолженность — на 01.09.2026; уплаченные налоги — на 31.12.2025',
      kpi: o.kpi || [{ label: 'Налоги и взносы за год', value: o.nalogi != null ? o.nalogi : 20e6 }],
      charts: o.charts || { revenue: [{ year: 2024, value: 90e6 }, { year: 2025, value: 100e6 }] }
    }
  };
}
const F = D.nagruzka.filter(s => s.kod === 'F')[0];

test('сумма с суммой: (налоги + взносы) / выручка против налоговой нормы + нормы по взносам того же года', () => {
  const o = P.raschet(otvet({ nalogi: 22e6 }), D);
  assert.ok(o);
  assert.strictEqual(o.god, 2025);
  assert.strictEqual(o.stroka.kod, 'F');
  assert.strictEqual(o.vid, 'vyruchka');
  assert.ok(Math.abs(o.n - 22) < 1e-9);
  assert.strictEqual(o.norma, Math.round((F.nagruzka['2025'] + F.sv['2025']) * 10) / 10);
  assert.strictEqual(o.st, 'ne-nizhe');
  const h = P.html(o);
  assert.match(h, /Налоги и взносы против отрасли/);
  assert.match(h, /налоги 15,0 % \+ взносы 5,1 %/);
  assert.match(h, /Не ниже средней по отрасли\./);
  assert.doesNotMatch(h, /НДФЛ за работников, а в норме/); // при «не ниже» — без оговорок
});

test('ниже средней — «внимание», оговорка про НДФЛ и признак отбора; меньше половины — «более чем вдвое», но не красный', () => {
  let o = P.raschet(otvet({ nalogi: 15e6 }), D);
  assert.strictEqual(o.st, 'nizhe');
  let h = P.html(o);
  assert.match(h, /ngo--warn/);
  assert.match(h, /настоящая нагрузка, скорее всего, выше/);
  assert.match(h, /один из 12 признаков/);
  o = P.raschet(otvet({ nalogi: 5e6 }), D);
  assert.strictEqual(o.st, 'nizhe-vdvoe');
  h = P.html(o);
  assert.match(h, /ngo--warn/);
  assert.doesNotMatch(h, /ngo--bad|#D/);
  assert.match(h, /более чем вдвое/);
});

test('доходы из набора ФНС «доходы и расходы» главнее выручки, если год совпал', () => {
  const r = otvet({
    dd: 'уплаченные налоги — на 31.12.2025; доходы и расходы — на 31.12.2025',
    kpi: [{ label: 'Налоги и взносы за год', value: 20e6 }, { label: 'Доходы за год', value: 200e6 }]
  });
  const o = P.raschet(r, D);
  assert.strictEqual(o.vid, 'dohody');
  assert.ok(Math.abs(o.n - 10) < 1e-9);
  assert.match(P.html(o), /от доходов за 2025/);
  // доходы за другой год — берём выручку ГИР БО того же года, что и налоги
  const r2 = otvet({ dd: 'уплаченные налоги — на 31.12.2025; доходы и расходы — на 31.12.2024',
    kpi: [{ label: 'Налоги и взносы за год', value: 20e6 }, { label: 'Доходы за год', value: 200e6 }] });
  assert.strictEqual(P.raschet(r2, D).vid, 'vyruchka');
});

test('ряд charts.taxes_paid: последний год, у которого есть выручка того же года', () => {
  const r = otvet({ kpi: [], charts: {
    taxes_paid: [{ year: 2024, value: 9e6 }, { year: 2025, value: 12e6 }],
    revenue: [{ year: 2024, value: 60e6 }] } });
  const o = P.raschet(r, D);
  assert.strictEqual(o.god, 2024);
  assert.ok(Math.abs(o.n - 15) < 1e-9);
  assert.strictEqual(o.norma, Math.round((F.nagruzka['2024'] + F.sv['2024']) * 10) / 10);
});

test('налоги без взносов (будущий ряд API) сравниваются с одной налоговой нормой', () => {
  const r = otvet({ kpi: [], charts: { taxes_paid_bez_vznosov: [{ year: 2025, value: 14e6 }], taxes_paid: [{ year: 2025, value: 99e6 }],
    revenue: [{ year: 2025, value: 100e6 }] } });
  const o = P.raschet(r, D);
  assert.strictEqual(o.sVznosami, false);
  assert.strictEqual(o.norma, F.nagruzka['2025']);
  const h = P.html(o);
  assert.match(h, /Налоговая нагрузка против отрасли/);
  assert.doesNotMatch(h, /\+ взносы/);
});

test('нет блока: ИП, банк, страховщик, доходы < 1 млн, нет года набора, год без нормы', () => {
  const ip = otvet(); ip.company.inn = '770000000012';
  assert.strictEqual(P.raschet(ip, D), null);
  assert.strictEqual(P.raschet(otvet({ okved: '64.19' }), D), null);
  assert.strictEqual(P.raschet(otvet({ okved: '65.12' }), D), null);
  assert.strictEqual(P.raschet(otvet({ charts: { revenue: [{ year: 2025, value: 9e5 }] } }), D), null);
  assert.strictEqual(P.raschet(otvet({ dd: 'задолженность — на 01.09.2026' }), D), null);
  assert.strictEqual(P.raschet(otvet({ dd: 'уплаченные налоги — на 30.06.2025' }), D), null); // не конец года
  const r = otvet({ dd: 'уплаченные налоги — на 31.12.2023', charts: { revenue: [{ year: 2023, value: 100e6 }] } });
  assert.strictEqual(P.raschet(r, D), null);
  assert.strictEqual(P.raschet(otvet(), null), null);
});

test('УСН и спецрежимы — не сравниваем и так и пишем; режим не указан — сравниваем с оговоркой', () => {
  let o = P.raschet(otvet({ signals: [{ title: 'Налоговый режим', detail: 'УСН' }] }), D);
  assert.strictEqual(o.st, 'usn');
  let h = P.html(o);
  assert.match(h, /упрощенца некорректно/);
  assert.doesNotMatch(h, /Средняя по отрасли/);
  assert.match(h, /ngo--ro/);
  o = P.raschet(otvet({ signals: [{ title: 'Налоговый режим', detail: 'ЕСХН' }] }), D);
  assert.strictEqual(o.st, 'spec');
  const r = otvet({ signals: [], nalogi: 15e6 });
  r.dossier.sections = [{ rows: [['Налоговый режим', 'УСН «доходы»']] }];
  assert.strictEqual(P.raschet(r, D).st, 'usn'); // режим из раздела досье, как js/bez-nds.js
  o = P.raschet(otvet({ signals: [], nalogi: 15e6 }), D);
  assert.strictEqual(o.st, 'nizhe');
  assert.match(P.html(o), /Налоговый режим в ответе не указан/);
});

test('ОКВЭД без своей строки у ФНС — «Всего по РФ» не подставляем', () => {
  const o = P.raschet(otvet({ okved: '99.00' }), D);
  assert.strictEqual(o.st, 'net-normy');
  assert.doesNotMatch(P.html(o), /Средняя по отрасли —/);
});

test('год набора: строка и объект data_dates, только 31.12', () => {
  assert.strictEqual(P.godNabora('уплаченные налоги — на 31.12.2025', /уплаченные налоги/i), 2025);
  assert.strictEqual(P.godNabora({ 'уплаченные налоги': '2024-12-31' }, /уплаченные налоги/i), 2024);
  assert.ok(isNaN(P.godNabora('уплаченные налоги — на 01.09.2026', /уплаченные налоги/i)));
  assert.ok(isNaN(P.godNabora(null, /x/)));
});

test('тексты: без обещаний исхода и «безопасного» уровня (38-ФЗ, правила Налогового юриста)', () => {
  const vse = [];
  [otvet(), otvet({ nalogi: 15e6 }), otvet({ nalogi: 1e6 }), otvet({ signals: [{ title: 'Налоговый режим', detail: 'УСН' }] }),
    otvet({ okved: '99.00' }), otvet({ signals: [] })].forEach(r => vse.push(P.html(P.raschet(r, D))));
  const t = vse.join(' ');
  for (const re of [/вас провер/i, /провер(ят|ит) вас/i, /безопасн/i, /гарант/i, /не отбирает/i, /лучш/i, /надёжн/i, /рекоменд/i, /ИИ\b|нейросет/i])
    assert.doesNotMatch(t, re, String(re));
  assert.match(t, /оценка/);
  assert.match(t, /ММ-3-06\/333@/);
});

test('главная подключает модуль до рентабельности; рентабельность и «НДС-2027» ставят себя после .ngo', () => {
  const idx = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  const a = idx.indexOf('/js/nagruzka.js'), b = idx.indexOf('/js/nagruzka-proverka.js'), c = idx.indexOf('/js/rentabelnost.js');
  assert.ok(a > 0 && b > a && c > b, 'порядок скриптов: nagruzka → nagruzka-proverka → rentabelnost');
  assert.match(idx, /NagruzkaProverka\.mount\(report,r\)/);
  assert.match(fs.readFileSync(path.join(KOREN, 'js', 'rentabelnost.js'), 'utf8'), /\['\.ngo', '\.din'/);
  assert.match(fs.readFileSync(path.join(KOREN, 'js', 'nds-porog.js'), 'utf8'), /"\.rnt", "\.ngo"/);
});
