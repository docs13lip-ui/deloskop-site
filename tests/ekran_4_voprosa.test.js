// ekran-4-voprosa-v1: экран результата «4 вопроса» в отчёте о контрагенте (report.html, js/chetyre-voprosa.js).
// Задание команды 30.10, приёмка: четыре вопроса в DOM; плашка полноты — следующий элемент после строки
// аванса; суды на 12.10 при проверке 30.10 — stale; «неизвестно» без warn/bad/high; ▲ только у строки с кодом признака.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const I = require('../js/istochniki.js');
const Q = require('../js/chetyre-voprosa.js');
const ROOT = path.join(__dirname, '..');

// Вымышленная компания (данных реальных компаний в тестах нет): форма ответа — как у /api/report 30.10
function otvet(dop) {
  const r = {
    company: { inn: '7700000001', name_short: 'ООО «Пример»', status: 'ACTIVE', kind: 'LEGAL', reg_date: '2015-03-01' },
    checked_at: '2026-10-30T18:40:00+00:00', risk_level: 'low', verdict: 'Серьёзного не нашли',
    signals: [
      { title: 'Статус', status: 'ok', source: 'ЕГРЮЛ/ЕГРИП', detail: 'Действующая' },
      { title: 'Адрес', status: 'ok', source: 'ЕГРЮЛ', detail: 'Отметок о недостоверности нет' },
      { title: 'Задолженность по налогам', status: 'ok', source: 'ФНС, открытые данные', as_of: '01.10.2026', detail: 'Нет' }
    ],
    damia: {
      sudy: { status: 'found', istochnik: 'Картотека арбитражных дел', data_svedeniy: '2026-10-12T11:40+03:00', dannye: { vsego: 3, otvetchik: 1, istec: 2 } },
      fssp: { status: 'not_found', istochnik: 'ФССП', data_svedeniy: '2026-10-12T11:40+03:00' },
      rnp: { status: 'not_found', istochnik: 'РНП', data_svedeniy: '2026-10-12T11:40+03:00' },
      kontrakty: { status: 'not_found', istochnik: 'ЕИС', data_svedeniy: '2026-10-12T11:40+03:00' },
      priostanovki: { status: 'not_checked' }, mery: { status: 'not_checked' },
      polnota: { provereno: 4, iz: 7 }
    },
    dossier: { documents: [], charts: { revenue: [{ year: 2024, value: 1e8 }, { year: 2025, value: 1.2e8 }] } }
  };
  Object.assign(r, dop || {});
  return I.dopolnit(r);
}

test('четыре вопроса есть в разметке, порядок 1 → 4', () => {
  const h = Q.html(Q.sobrat(otvet(), { id: 'abcdEFGH12' }));
  const q = ['Что это значит для сделки', 'Насколько полна проверка', 'Что сделать до оплаты', 'Что нашли'];
  let prev = -1;
  q.forEach((t) => { const i = h.indexOf(t); assert.ok(i > prev, t); prev = i; });
});

test('плашка полноты — следующий элемент после строки аванса и не сворачивается', () => {
  const h = Q.html(Q.sobrat(otvet(), { id: 'abcdEFGH12' }));
  assert.match(h, /<p class="q4-avans">[^]*?<\/p><div class="q4-poln[^"]*" role="note"/);
  assert.doesNotMatch(h.slice(h.indexOf('q4-poln'), h.indexOf('q4-dej')), /<details|\shidden[\s>=]/);
});

test('суды и приставы на 12.10 при проверке 30.10 — stale, в полноту не входят; найденное видно', () => {
  const o = Q.sobrat(otvet(), {});
  const g = Object.fromEntries(o.gruppy.map((x) => [x.id, x]));
  assert.strictEqual(g.kad.status, 'stale');
  assert.strictEqual(g.fssp.status, 'stale');
  assert.strictEqual(g.eis.status, 'ok', 'ЕИС устаревает через 30 дней');
  assert.strictEqual(g.efrsb.status, 'not_connected');
  assert.strictEqual(g.girbo.status, 'ok');
  assert.strictEqual(o.polnota.m, 8);
  assert.strictEqual(o.polnota.n, 4); // ЕГРЮЛ, ФНС, ГИР БО, ЕИС
  assert.match(o.polnota.tekst.join(' '), /^Проверено 4 из 8 групп источников\. Суды и приставы — сведения на 12\.10\.2026, устарели\./);
  assert.match(o.polnota.tekst.join(' '), /Это не значит, что споров и долгов нет\.$/);
  const sud = o.fakty.find((f) => f.t.indexOf('Картотека') === 0);
  assert.strictEqual(sud.vid, 'unk');
  assert.match(sud.z, /12\.10\.2026/);
});

test('«неизвестно» — нейтральное: ни у одной строки со статусом stale/not_connected/error/n_a/user нет warn, bad, high', () => {
  const h = Q.html(Q.sobrat(otvet(), {}));
  const rows = h.match(/<div class="q4-f [^"]*" data-status="[^"]+"/g) || [];
  assert.ok(rows.length >= 3);
  rows.forEach((x) => {
    assert.match(x, /data-status="(stale|not_connected|error|n_a|user)"/);
    assert.doesNotMatch(x, /warn|bad|high/);
  });
});

test('▲ только у признака с кодом; сигналы — первыми, неизвестное — последним', () => {
  const r = otvet({ signals: [
    { title: 'Статус', status: 'ok', source: 'ЕГРЮЛ' },
    { title: 'Задолженность по налогам', status: 'bad', source: 'ФНС, открытые данные', as_of: '01.10.2026', detail: '120 000 ₽', signal_id: 'dolg' },
    { title: 'Что-то без правила', status: 'warn', source: 'ЕГРЮЛ' }
  ] });
  const f = Q.sobrat(r, {}).fakty;
  assert.strictEqual(f[0].vid, 'bad');
  assert.ok(f.filter((x) => x.vid === 'warn' || x.vid === 'bad').length === 1, 'без кода — не ▲');
  const iu = f.findIndex((x) => x.vid === 'unk');
  assert.ok(f.slice(iu).every((x) => x.vid === 'unk'));
});

test('главное действие — документы из правил вывода; ИП — без досье и слежения, ГИР БО не в M', () => {
  const o = Q.sobrat(otvet(), { id: 'abcdEFGH12' });
  assert.match(o.deystviya.glavnoe.tekst, /^Запросить у поставщика \d+ документ/);
  assert.deepStrictEqual(o.deystviya.vtorye.map((x) => x.vid), ['dosje', 'slezh']);
  const ip = otvet({ company: { inn: '770000000012', name_short: 'ИП Пример', status: 'ACTIVE', kind: 'INDIVIDUAL', reg_date: '2020-01-01' } });
  const p = Q.sobrat(ip, { id: 'abcdEFGH12' });
  assert.deepStrictEqual(p.deystviya.vtorye, []);
  assert.strictEqual(p.gruppy.find((g) => g.id === 'girbo').status, 'n_a');
  assert.strictEqual(p.polnota.m, 7);
});

test('строка аванса — три состояния различимы, с датой правила', () => {
  const pos = Q.vyvod(otvet(), { tone: 'go', headline: 'Можно работать', cap: 250000, predel: { sostoyanie: 'positive', pravilo: 'usloviya-2026-10-30' } });
  assert.match(pos.avans, /^Предоплата — до 250\s000\s?₽\. Расчёт по правилу от 30\.10\.2026\.$/);
  const nol = Q.vyvod(otvet(), { tone: 'post', headline: 'Только по факту', cap: 0, reasons: ['долг по налогам'], predel: { sostoyanie: 'zero' } });
  assert.strictEqual(nol.avans, 'Без предоплаты. Основание: долг по налогам.');
  const ned = Q.vyvod(otvet(), { tone: 'go', headline: 'Предварительно: данных мало', cap: null, predel: { sostoyanie: 'insufficient_data' } });
  assert.match(ned.avans, /^Сумму аванса не считаем/);
  assert.strictEqual(ned.ton, 'ned');
});

test('реестр групп — копия data/istochniki.json (без группы риска ЦБ)', () => {
  const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/istochniki.json'), 'utf8'));
  const ids = J.istochniki.map((x) => x.id).filter((x) => x !== 'zsk_cbr');
  assert.deepStrictEqual(Q.GRUPPY.map((g) => g.id), ids);
  Q.GRUPPY.forEach((g) => {
    const j = J.istochniki.find((x) => x.id === g.id);
    assert.strictEqual(g.nazv, j.nazvanie, g.id);
    if (j.damia) assert.deepStrictEqual(g.damia, j.damia, g.id);
    if (g.ustarelo_dney != null) assert.strictEqual(g.ustarelo_dney, j.ustarelo_dney, g.id);
  });
});

test('report.html: модуль подключён до вывода, итог монтируется, название — «Отчёт о контрагенте»', () => {
  const h = fs.readFileSync(path.join(ROOT, 'report.html'), 'utf8');
  assert.match(h, /<title>Отчёт о контрагенте по ИНН — Делоскоп<\/title>/);
  assert.match(h, /<script src="\/js\/chetyre-voprosa\.js"><\/script>/);
  assert.match(h, /ChetyreVoprosa\.mount\(q4,r,\{id:id\}\)/);
  assert.doesNotMatch(h, /Досье контрагента/);
});
