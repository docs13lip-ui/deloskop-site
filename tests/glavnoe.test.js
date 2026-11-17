// pervyj-ekran-otcheta-v1 [Ночные запуски] 18.11: «Главное» на первом экране отчёта (решение владельца 18.11, разд. 3 пп. 1–2).
// Форма ответа — живой /api/check 18.11 01:05 (ПАО «Магнит»: 3 незавершённых дела на 35 905 ₽ при выручке 412 млн ₽ за 2024).
// Компании ниже вымышленные. node --test tests/glavnoe.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const PM = require('../js/plyusy-minusy.js');
const G = require('../js/glavnoe.js');
const bez = (t) => String(t).replace(/[ ⁠]/g, ' ');
const SEG = new Date('2026-11-18T01:00:00+03:00');

function otvet(o) {
  o = o || {};
  return {
    company: Object.assign({ inn: '7700000001', kind: 'LEGAL', name_short: 'ООО "ОБРАЗЕЦ"', status: 'ACTIVE', reg_date: '2007-10-24', okved: '47.11' }, o.company || {}),
    checked_at: '2026-11-18T01:05:00+03:00', risk_level: 'low',
    signals: o.signals || [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП' },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Нет', source: 'ЕГРЮЛ' },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '2026-10-01' }
    ],
    damia: o.damia || {
      sudy: { nazvanie: 'Арбитражные суды', istochnik: 'Картотека арбитражных дел (через Checko)', sostoyanie: 'found', data_svedeniy: '2026-11-12T23:38+03:00',
        dannye: { otvetchik_nezaversheno: 3, otvetchik_summa_nezaversheno: 35905 } },
      fssp: { nazvanie: 'Приставы', istochnik: 'ФССП (через Checko)', sostoyanie: 'not_found', data_svedeniy: '2026-11-12T23:38+03:00', dannye: { otkryto: 0, ostatok: 0 } }
    },
    dengi: o.dengi === undefined ? { vyruchka: { summa: 412062000, god: 2024 }, sostavlyayushchie: [{ vid: 'nedoimka', summa: 0 }] } : o.dengi,
    dossier: { strengths: [], concerns: [], kpi: [], charts: {} }
  };
}

test('мелкий иск (< 0,1 % выручки) — не в главном, а строкой «Мелкое к выручке» с долей; свободные места — плюсы', () => {
  const g = G.sobrat(otvet(), SEG, PM);
  assert.strictEqual(g.glavnoe.length, 3);
  assert.ok(g.glavnoe.every((x) => x.znak === 'plus'), 'одни плюсы');
  assert.strictEqual(g.melkoe.length, 1);
  assert.strictEqual(bez(g.melkoe[0].dolya), 'меньше 0,1 % выручки за 2024 год');
  const h = bez(G.html(g));
  assert.match(h, /Мелкое к выручке:<\/span> 3 незавершённых дела/);
  assert.match(h, /Все плюсы и минусы: \d+ и 1 ↓/);
});

test('крупный иск (≥ 10 % выручки) — первым, с долей; приостановка счетов — всегда в главном', () => {
  const r = otvet();
  r.damia.sudy.dannye.otvetchik_summa_nezaversheno = 206031000; // 50 %
  r.damia.priostanovki = { nazvanie: 'Счета: решения ФНС о приостановлении', istochnik: 'ФНС', sostoyanie: 'found', data_svedeniy: '2026-11-17' };
  const g = G.sobrat(r, SEG, PM);
  assert.deepStrictEqual(g.glavnoe.slice(0, 2).map((x) => x.k).sort(), ['damia_priostanovki', 'damia_sudy']);
  const s = g.glavnoe.filter((x) => x.k === 'damia_sudy')[0];
  assert.strictEqual(bez(s.dolya), '50 % выручки за 2024 год');
  assert.strictEqual(g.melkoe.length, 0);
});

test('доли: 0,6 %, 12 %, «больше выручки»; без выручки, у банка и у ИП — доли нет', () => {
  assert.strictEqual(bez(G.dolyaTekst(0.0057, 2025)), '0,6 % выручки за 2025 год');
  assert.strictEqual(bez(G.dolyaTekst(0.123, 2025)), '12 % выручки за 2025 год');
  assert.strictEqual(bez(G.dolyaTekst(1.7, 2025)), 'больше выручки за 2025 год');
  const r = otvet({ dengi: null });
  const g = G.sobrat(r, SEG, PM);
  assert.ok(g.glavnoe.some((x) => x.k === 'damia_sudy' && x.dolya === ''), 'без выручки иск — в главном, без доли');
  assert.strictEqual(G.vyruchka(otvet({ company: { okved: '64.19' } }), SEG), null, 'банк');
  assert.strictEqual(G.vyruchka(otvet({ company: { inn: '770000000001', kind: 'INDIVIDUAL' } }), SEG), null, 'ИП');
  assert.strictEqual(G.vyruchka(otvet({ dengi: { vyruchka: { summa: 1e9, god: 2023 } } }), SEG), null, 'отчёт старше двух лет');
});

test('слова строк — те же, что в «Плюсах и минусах» (новых утверждений нет)', () => {
  const r = otvet();
  const S = PM.sobrat(r, SEG), g = G.sobrat(r, SEG, PM);
  const vse = S.plyusy.concat(S.minusy).map((x) => x.t);
  g.glavnoe.concat(g.melkoe).forEach((x) => assert.ok(vse.indexOf(x.t) >= 0, x.t));
});

test('главная: модуль в пакете otchet и вызывается после «Плюсов и минусов», только для чужой компании', () => {
  const kor = path.join(__dirname, '..');
  const karta = JSON.parse(fs.readFileSync(path.join(kor, 'partials/sborka.json'), 'utf8'));
  assert.ok(karta.pakety.otchet.indexOf('js/glavnoe.js') > karta.pakety.otchet.indexOf('js/plyusy-minusy.js'));
  const ix = fs.readFileSync(path.join(kor, 'index.html'), 'utf8');
  const a = ix.indexOf('PlyusyMinusy.mount(report,r)'), b = ix.indexOf('DlkGlavnoe.mount(report,r)');
  assert.ok(a > 0 && b > a);
  assert.match(ix, /if\(!svoj&&window\.DlkGlavnoe\)/);
});

test('без оценок компании и без «ИИ»: запрещённые слова в модуле', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'js/glavnoe.js'), 'utf8');
  assert.ok(!/надёжн|благонадёжн|рекомендуем|нет долгов|\bИИ\b|нейросет/i.test(js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
});
