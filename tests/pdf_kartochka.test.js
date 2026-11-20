// pdf-kartochka-v1 — аудит 20.11 «PDF отчёта против карточки» на 5 ИНН (п. 22 (г) решения владельца 19.11).
// (1) «4 вопроса» без istochniki.js (обрыв сети) не пишут «Источник пока не подключён» о реестрах, которые ответили:
//     живой PDF «Газпрома» и «Экопэт» 20.11 — «Проверено 3 из 8 групп… суды, приставы — не подключён», а в том же PDF
//     «Плюсы и минусы» — 129 дел и 2 производства «на 20.11.2026». Полнота с модулем и без него — одна.
// (2) «Руководитель не менялся 2 года 8 месяцев» → «… 2 года», не «2 год» (живой PDF «Моторинвест» 20.11).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const path = require('path');

function otvet() {
  return {
    company: { inn: '7736050003', name: 'ПАО «Пример»', kind: 'LEGAL', status: 'ACTIVE' },
    checked_at: '2026-11-20T22:07:00+03:00',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', source: 'ЕГРЮЛ/ЕГРИП' },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', source: 'ФНС, открытые данные', as_of: '2026-10-01' }
    ],
    damia: {
      sudy: { istochnik: 'Картотека арбитражных дел (через Checko)', status: 'polucheno', sostoyanie: 'found', data_svedeniy: '2026-11-20T22:07+03:00' },
      fssp: { istochnik: 'ФССП (через Checko)', status: 'polucheno', sostoyanie: 'found', data_svedeniy: '2026-11-20T22:07+03:00' },
      bankrotstvo: { istochnik: 'ЕФРСБ (через Checko)', status: 'polucheno', sostoyanie: 'not_found', data_svedeniy: '2026-11-20T22:07+03:00' },
      kontrakty: { status: 'polucheno', sostoyanie: 'found', data_svedeniy: '2026-11-13T09:15+03:00' },
      rnp: { status: 'ne_provereno', sostoyanie: 'not_checked' },
      priostanovki: { status: 'ne_provereno', sostoyanie: 'not_checked' },
      mery: { status: 'ne_provereno', sostoyanie: 'not_checked' },
      polnota: { provereno: 4, iz: 7 }
    },
    dossier: { strengths: [], concerns: [], kpi: [], charts: {} }
  };
}

function bezIstochnikov(fn) {
  const orig = Module.prototype.require;
  const put = require.resolve('../js/chetyre-voprosa.js');
  delete require.cache[put];
  Module.prototype.require = function (p) { if (/istochniki/.test(p)) throw new Error('не загрузился'); return orig.apply(this, arguments); };
  try { return fn(require('../js/chetyre-voprosa.js')); } finally { Module.prototype.require = orig; delete require.cache[put]; }
}

test('без istochniki.js полнота та же, что с ним; ответившие реестры — не «не подключён»', () => {
  const I = require('../js/istochniki.js');
  const Q = require('../js/chetyre-voprosa.js');
  const r = otvet(); I.dopolnit(r);
  const s = Q.polnota(Q.gruppy(r));
  const b = bezIstochnikov((Q2) => { const G = Q2.gruppy(otvet()); return { p: Q2.polnota(G), G }; });
  assert.strictEqual(b.p.n + '/' + b.p.m, s.n + '/' + s.m);
  for (const id of ['kad', 'fssp', 'efrsb']) {
    const g = b.G.find((x) => x.id === id);
    assert.strictEqual(g.status, 'ok', id);
  }
  assert.ok(!b.G.some((g) => /не\s+подключ/.test(g.tekst)), b.G.map((g) => g.id + ': ' + g.tekst).join(' | '));
  assert.ok(!/суды|приставы/.test(b.p.tekst.join(' ')), b.p.tekst.join(' '));
});

test('без istochniki.js блок без ответа — «не проверяли в этот раз», а «не подключён» — только когда блока нет', () => {
  bezIstochnikov((Q2) => {
    const G = Q2.gruppy(otvet());
    const nb = G.find((g) => g.id === 'nalog_bi');
    assert.strictEqual(nb.status, 'not_connected');
    assert.match(nb.tekst.replace(/ /g, ' '), /^Не проверяли в этот раз\.$/);
    const r = otvet(); delete r.damia.sudy;
    assert.match(Q2.gruppy(r).find((g) => g.id === 'kad').tekst, /не\s+подключён/);
  });
});

test('с istochniki.js тексты блоков прежние (источник и дата)', () => {
  const I = require('../js/istochniki.js');
  const Q = require('../js/chetyre-voprosa.js');
  const r = otvet(); I.dopolnit(r);
  const nb = Q.gruppy(r).find((g) => g.id === 'nalog_bi');
  assert.ok(nb.tekst && !/в этот раз/.test(nb.tekst), nb.tekst);
});

test('«Руководитель не менялся 2 года 8 месяцев» → «2 года», «1 год» и «17 лет» — как были', () => {
  const PM = require('../js/plyusy-minusy.js');
  const t = (s) => { const r = otvet(); r.dossier.strengths = [s]; return PM.sobrat(r).plyusy.map((x) => String(x.t).replace(/ /g, ' ')).filter((x) => /не менялся/.test(x))[0]; };
  assert.strictEqual(t('Руководитель не менялся 2 года 8 месяцев'), 'Руководитель не менялся 2 года');
  assert.strictEqual(t('Руководитель не менялся 1 год 3 месяца'), 'Руководитель не менялся 1 год');
  assert.strictEqual(t('Руководитель не менялся 17 лет 1 месяц'), 'Руководитель не менялся 17 лет');
  assert.strictEqual(t('Руководитель не менялся 24 года'), 'Руководитель не менялся 24 года');
});
