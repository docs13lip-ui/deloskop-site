// starye-ubytki-v1 [Ночные запуски] 21.11: отчётность старше двух лет — убыток, минус в капитале и ликвидность из неё
// не замечания «сейчас», а факт с годом ([Право] 19.11 вечер, разд. 1 (1): «год проверки − год отчётности > 2 → только
// факт с годом и запрос»; ст. 152 ГК). Живой /api/check 21.11 (ООО, отчётность в открытых данных — до 2021):
// «Плюсы и минусы» — минус «Убытки несколько лет подряд · по ответу проверки» без года; «Существенные факты» — строка
// «Убыток 2 года подряд» над «Выручка за 2021 · последняя открытая · убыток 202,3 млн ₽».
// Форма ответа — как на живом; суммы и компания — условные.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const S = require(path.join(ROOT, 'js', 'sushchestvennoe.js'));
const PM = require(path.join(ROOT, 'js', 'plyusy-minusy.js'));
const G = require(path.join(ROOT, 'js', 'glavnoe.js'));
const NB = ' ';

function otvet(g1, o) {
  o = o || {};
  const g0 = g1 - 1;
  return {
    checked_at: o.checked_at || '2026-11-21T00:10:00+03:00', risk_level: 'medium',
    company: { inn: '7800000002', ogrn: '1027800000002', kind: 'LEGAL', name_short: 'ООО «Пример»', status: 'ACTIVE', reg_date: '2011-04-19', okved: '29.10' },
    signals: [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП' }],
    dossier: {
      strengths: [], concerns: ['Убытки несколько лет подряд'], kpi: [], sections: [
        { id: 'dynamics', title: 'Финансовая динамика по годам', tone: 'warn', rows: [['Текущая ликвидность', '0.62']] }],
      charts: {
        revenue: [{ year: g0, value: 8000000 }, { year: g1, value: 19600000 }],
        profit: [{ year: g0, value: -223000000 }, { year: g1, value: -202000000 }],
        balance: { year: g1, equity: o.equity != null ? o.equity : -15000000, long_debt: 3700000000, short_debt: 347000000 }
      }
    }
  };
}

test('факты: старые убыток, капитал и ликвидность — не отдельные строки «внимание», а подстрочник «последней открытой»', () => {
  const f = S.fakty(otvet(2021), {});
  const vse = f.spisok.concat(f.eshche);
  for (const k of ['ubytki', 'kapital', 'likvidnost']) assert.ok(!vse.some((x) => x.k === k), k + ' не отдельной строкой');
  const o = vse.find((x) => x.k === 'otchetnost');
  assert.ok(o && /последняя открытая/.test(o.nazv));
  assert.ok(o.pod.startsWith('Убыток за' + NB + '2020 и 2021. Собственный капитал на' + NB + '31.12.2021 — минус '), o.pod);
  assert.ok(o.pod.includes('Текущая ликвидность на' + NB + '31.12.2021 — 0,62.'));
  assert.ok(o.pod.includes('Это старые данные — о' + NB + 'нынешнем положении компании они не' + NB + 'говорят.'));
  assert.ok(o.pod.endsWith('запросите отчётность у' + NB + 'компании.'), 'запрос остаётся последним');
});

test('факты: свежая отчётность — убыток, капитал и ликвидность как были', () => {
  const f = S.fakty(otvet(2025), {});
  const vse = f.spisok.concat(f.eshche);
  for (const k of ['ubytki', 'kapital', 'likvidnost']) assert.ok(vse.some((x) => x.k === k && x.ton === 'warn'), k);
  const o = vse.find((x) => x.k === 'otchetnost');
  assert.ok(!o.pod || !/старые данные/.test(o.pod));
});

test('факты: граница — 2024 при проверке в 2026 ещё не старая', () => {
  const vse = (function (f) { return f.spisok.concat(f.eshche); })(S.fakty(otvet(2024), {}));
  assert.ok(vse.some((x) => x.k === 'ubytki'));
});

test('плюсы и минусы: старая отчётность — замечание сервера об убытках не минус, а строка с годом', () => {
  const s = PM.sobrat(otvet(2021));
  assert.ok(!s.minusy.some((x) => /убыт/i.test(x.t)), 'нет минуса без года');
  assert.deepStrictEqual(s.ostatok.map((x) => x.t), ['Последняя открытая отчётность — за' + NB + '2021' + NB + 'год: убыток за' + NB + '2020 и 2021 (ГИР' + NB + 'БО). Это старые данные — о' + NB + 'нынешнем положении компании они не' + NB + 'говорят.']);
  assert.ok(PM.html(s).includes('class="pm__ost" data-pm-ost="otchetnost"'));
});

test('плюсы и минусы: свежая отчётность — замечание остаётся минусом', () => {
  const s = PM.sobrat(otvet(2025));
  assert.ok(s.minusy.some((x) => x.k === 'dossier' && x.t === 'Убытки несколько лет подряд'));
  assert.strictEqual(s.ostatok.length, 0);
});

test('плюсы и минусы: нефинансовое замечание при старой отчётности — по-прежнему минус', () => {
  const r = otvet(2021); r.dossier.concerns = ['Недавняя смена адреса', 'Убытки несколько лет подряд'];
  const s = PM.sobrat(r);
  assert.ok(s.minusy.some((x) => x.t === 'Недавняя смена адреса'));
  assert.strictEqual(s.ostatok.length, 1);
});

test('плюсы и минусы: убыток одного года при старой отчётности — год из ряда, без серии', () => {
  const r = otvet(2021); r.dossier.charts.profit = [{ year: 2020, value: 5000000 }, { year: 2021, value: -202000000 }];
  r.dossier.concerns = ['Убыток за последний год'];
  assert.ok(PM.sobrat(r).ostatok[0].t.includes(': убыток за' + NB + '2021 (ГИР'));
});

test('«Главное»: старый убыток не считается минусом, строка — под «Не проверяли»', () => {
  const g = G.sobrat(otvet(2021), null, PM);
  assert.ok(!g.glavnoe.some((x) => /убыт/i.test(x.t)));
  assert.ok(g.itog.ostatok.some((t) => /^Последняя открытая отчётность — за/.test(t)));
});
