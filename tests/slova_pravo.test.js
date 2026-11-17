// slova-pravo-v1 [Ночные запуски] 16.11: сторож слов отчёта по [Право] 16.11 п. 1
// (claude/Право_суды_плитки_плюсы_реклама_erid_Разбор_52_16.11.md): утверждения не шире данных.
// ФССП показывает только идущие производства, Checko отдаёт часть списка дел, сумма исков — не долг.
// На выводе «Плюсов и минусов», «Коротко по реестрам» и «Суды, приставы, госконтракты — подробно» нет
// «за всё время», «долг от», «нет долгов», «чисто», «иски на», «идущих дел против»; у прогноза ЗСК — «не оценка Банка России».
// Компании ниже вымышленные. node --test tests/slova_pravo.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const PM = require('../js/plyusy-minusy.js');
const PL = require('../js/plitki.js');
const SP = require('../js/sudy-pristavy.js');

const ZAPRET = /за\s+всё\s+время|долг\s+от|нет\s+долгов|(^|[^а-яё])чисто([^а-яё]|$)|иски\s+на|идущ\S*\s+дел\S*\s+против/i;
const bezNb = (t) => String(t).replace(/[  ]/g, ' ');
const DATA = '2026-11-12T19:10+03:00';

function otvet(v) {
  const sudy = { nazvanie: 'Арбитражные суды', istochnik: 'Картотека арбитражных дел (через Checko)', status: 'polucheno', data_svedeniy: DATA };
  const fssp = { nazvanie: 'Приставы', istochnik: 'ФССП (через Checko)', status: 'polucheno', data_svedeniy: DATA };
  const rnp = { nazvanie: 'Недобросовестные поставщики (РНП)', istochnik: 'ЕИС', status: 'polucheno', data_svedeniy: DATA };
  const kontrakty = { nazvanie: 'Госконтракты', istochnik: 'ЕИС', status: 'polucheno', data_svedeniy: DATA };
  if (v === 'est') {
    sudy.sostoyanie = 'found';
    sudy.dannye = { vsego: 120, otvetchik: 80, otvetchik_summa_vsego: 9e8, otvetchik_nezaversheno: 7, otvetchik_summa_nezaversheno: 4.5e7,
      dela: [{ nomer: 'А40-1/2026', data: '2026-10-01', istcy: 'ООО "ИСТЕЦ"', aktivno: true, summa: 1e6 }] };
    fssp.sostoyanie = 'found';
    fssp.dannye = { otkryto: 40, ostatok: 3.2e6, ostatok_tochno: false, proizvodstva: [{ nomer: '1/26/77001-ИП', data: '2026-09-01', predmet: 'Налог', ostatok: 1e5 }] };
    rnp.sostoyanie = 'found'; rnp.dannye = { vsego: 1 };
    kontrakty.sostoyanie = 'found'; kontrakty.dannye = { vsego: 12 };
  } else {
    sudy.sostoyanie = v === 'nol' ? 'found' : 'not_found';
    if (v === 'nol') sudy.dannye = { vsego: 3, otvetchik_nezaversheno: 0 };
    fssp.sostoyanie = 'not_found'; rnp.sostoyanie = 'not_found';
    kontrakty.sostoyanie = 'found'; kontrakty.dannye = { vsego: 2 };
  }
  return {
    company: { inn: '7700000002', kind: 'LEGAL', name_short: 'ООО "ПРИМЕР"', status: 'ACTIVE', reg_date: '2010-01-01' },
    checked_at: '2026-11-16', risk_level: 'low',
    signals: [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ' },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.10.2026' }],
    damia: { sudy, fssp, rnp, kontrakty },
    podderzhka: { status: 'najdeno', istochnik: 'ФНС, реестр получателей поддержки', data_nabora: '2026-10-10' },
    zsk: { level: v === 'est' ? 'high' : 'medium', title: v === 'est' ? 'Высокая вероятность' : 'Средняя вероятность', groups: [] },
    dossier: { strengths: [], concerns: [], kpi: [], charts: {} }
  };
}

function tekst(r) {
  const pm = PM.sobrat(r, '2026-11-16'), pl = PL.sobrat(r), sp = SP.sobrat(r);
  return bezNb([PM.html(pm), PL.html(pl), SP.html(sp), JSON.stringify(pm), JSON.stringify(pl), JSON.stringify(sp)].join('\n'));
}

for (const v of ['est', 'nol', 'pusto']) {
  test('слова не шире данных — вариант «' + v + '»', () => {
    const t = tekst(otvet(v)), m = ZAPRET.exec(t);
    assert.ok(!m, 'запрещённое: «' + (m && m[0]) + '» … ' + (m ? t.slice(Math.max(0, m.index - 60), m.index + 60) : ''));
  });
}

test('прогноз ЗСК в «минусах» — только с «не оценка Банка России»', () => {
  for (const v of ['est', 'nol']) {
    const S = PM.sobrat(otvet(v), '2026-11-16');
    const z = S.minusy.filter((x) => /ЗСК/.test(x.t));
    assert.strictEqual(z.length, 1);
    assert.match(bezNb(z[0].t), /^Наш прогноз по признакам ЗСК: .+ — не оценка Банка России$/);
  }
});

test('«не нашли» — с датой сведений; остаток при неполном списке — «не меньше … (по n из N)»', () => {
  const p = PM.sobrat(otvet('pusto'), '2026-11-16').plyusy.map((x) => bezNb(x.t));
  assert.ok(p.includes('Производств у приставов не нашли на 12.11.2026'), p.join(' | '));
  assert.ok(p.includes('Не нашли арбитражных дел, где компания — ответчик, на 12.11.2026'), p.join(' | '));
  const p0 = PM.sobrat(otvet('nol'), '2026-11-16').plyusy.map((x) => bezNb(x.t));
  assert.ok(p0.includes('Не нашли незавершённых дел, где компания — ответчик, на 12.11.2026'), p0.join(' | '));
  assert.ok(p.includes('Недоимки и долгов по пеням и штрафам в открытых данных ФНС не нашли — сведения на 01.10.2026'), p.join(' | '));
  assert.ok(p.includes('Есть в реестре получателей поддержки МСП (ФНС) на 10.10.2026'), p.join(' | '));
  const m = PM.sobrat(otvet('est'), '2026-11-16').minusy.map((x) => bezNb(x.t));
  assert.ok(m.includes('Производства у приставов: 40, остаток долга — не меньше 3,2 млн ₽ (по 1 из 40)'), m.join(' | '));
  assert.ok(m.includes('7 незавершённых дел, где компания — ответчик; требования к компании — 45 млн ₽'), m.join(' | '));
  assert.ok(m.includes('Есть запись в реестре недобросовестных поставщиков на 12.11.2026'), m.join(' | '));
});
