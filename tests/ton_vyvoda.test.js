// ton-vyvoda-v1 [Ночные запуски] 19.11: при ≥ 1 существенном минусе «Главного» вывод без причин — не зелёный «Работать можно»,
// а нейтральный «Перед оплатой посмотрите: {минус}» (юристы 19.11, разд. 4: «два вывода спорят»). Предел, совет, документы и
// письмо — прежние. Компании ниже вымышленные; форма ответа — живой /api/check 8602060185 (19.11 00:13). node --test tests/ton_vyvoda.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const PM = require('../js/plyusy-minusy.js');
const G = require('../js/glavnoe.js');
const U = require('../js/usloviya.js');
const bez = (t) => String(t).replace(/[ ⁠]/g, ' ');
const SEG = new Date('2026-11-19T15:00:00+03:00');

function otvet(summaIskov) {
  return {
    company: { inn: '7700000001', kind: 'LEGAL', name_short: 'ООО "ОБРАЗЕЦ"', status: 'ACTIVE', reg_date: '2007-10-24', okved: '35.12' },
    checked_at: '2026-11-19T15:00:00+03:00', risk_level: 'low',
    verdict: 'Работать можно. Серьёзных признаков риска не найдено.',
    signals: [
      { id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП' },
      { id: 'address', title: 'Адрес', status: 'ok', detail: 'Нет', source: 'ЕГРЮЛ' },
      { id: 'age', title: 'Возраст', status: 'ok', detail: '19 лет', source: 'ЕГРЮЛ' },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '2026-10-01' }
    ],
    damia: {
      sudy: { nazvanie: 'Арбитражные суды', istochnik: 'Картотека арбитражных дел (через Checko)', sostoyanie: 'found', data_svedeniy: '2026-11-13T09:17+03:00',
        dannye: { otvetchik_nezaversheno: 34, otvetchik_summa_nezaversheno: summaIskov } },
      fssp: { nazvanie: 'Приставы', istochnik: 'ФССП (через Checko)', sostoyanie: 'not_found', data_svedeniy: '2026-11-13T09:17+03:00', dannye: { otkryto: 0, ostatok: 0 } }
    },
    dengi: { vyruchka: { summa: 113976150000, god: 2025 }, sostavlyayushchie: [] },
    finance: { revenue: 113976150000, revenue_year: 2025 },
    dossier: { strengths: [], concerns: [], kpi: [], charts: {} }
  };
}
const itogIz = (r) => G.sobrat(r, SEG, PM).itog;
const bezPeredachi = (v) => { const o = Object.assign({}, v); delete o.headline; delete o.pered; return JSON.stringify(o); };

test('ton-vyvoda-v1: существенный минус (иски 2 % выручки) — «Перед оплатой посмотрите: …» вместо «Работать можно»', () => {
  const r = otvet(2279523000), it = itogIz(r);
  assert.strictEqual(it.vid, 'est');
  const byl = U.decide(r, {});
  assert.ok(!byl.pered, 'без итога «Главного» вывод прежний');
  const v = U.decide(r, { itogG: it });
  assert.strictEqual(byl.tone, 'go');
  assert.ok(v.pered, 'pered');
  assert.ok(bez(v.headline).startsWith('Перед оплатой посмотрите: 34 незавершённых дела'), v.headline);
  assert.ok(/\(2 % выручки за 2025 год\)$/.test(bez(v.headline)), v.headline);
  assert.ok(!/Работать можно|Можно/.test(v.headline));
  assert.strictEqual(v.pered.bylo, byl.headline);
  assert.strictEqual(bezPeredachi(v), bezPeredachi(byl), 'предел, совет, документы и письмо — прежние');
});

test('ton-vyvoda-v1: «Они платят мне» — так же, остальное прежнее', () => {
  const r = otvet(2279523000), it = itogIz(r);
  const byl = U.decide(r, { napravlenie: 'otgruzhaem' }), v = U.decide(r, { napravlenie: 'otgruzhaem', itogG: it });
  assert.strictEqual(byl.tone, 'go');
  assert.ok(bez(v.headline).startsWith('Перед оплатой посмотрите: '));
  assert.strictEqual(bezPeredachi(v), bezPeredachi(byl));
});

test('ton-vyvoda-v1: иски 0,15 % выручки — не существенны, вывод прежний', () => {
  const r = otvet(169231336.84), it = itogIz(r);
  assert.notStrictEqual(it.vid, 'est');
  assert.strictEqual(JSON.stringify(U.decide(r, { itogG: it })), JSON.stringify(U.decide(r, {})));
});

test('ton-vyvoda-v1: «Работать можно» → заголовок (zag), предел → пояснение (pod); «стоп», «по факту», «Проверили не всё» не трогаем', () => {
  const it = { vid: 'est', t: 'Есть 1 существенный минус на 19.11.2026', sushchestvennye: [{ k: 'tax_debt', t: 'Долг по налогам 9 млн ₽', dolya: '1,2 % выручки за 2025 год' }] };
  assert.ok(U.peredOplatoj(it, 'go', [], 'Работать можно'));
  assert.ok(U.peredOplatoj(it, 'go', [], 'Серьёзных сигналов в проверенных источниках нет'));
  assert.ok(U.peredOplatoj(it, 'go', [], 'Предварительно: серьёзного не нашли'));
  assert.strictEqual(U.peredOplatoj(it, 'go', [], 'Работать можно').rezhim, 'zag');
  assert.strictEqual(U.peredOplatoj(it, 'post', [], 'Только оплата по факту'), null);
  assert.strictEqual(U.peredOplatoj(it, 'stop', [], 'Не платите вперёд'), null);
  const cap = U.peredOplatoj(it, 'cap', ['задолженность по налогам: 9 млн ₽', 'адрес: недостоверность'], 'Предоплата — по нашей оценке не больше 5 000 000 ₽');
  assert.strictEqual(cap.rezhim, 'pod', 'предел — заголовок прежний, минус — в пояснении');
  assert.deepStrictEqual(cap.esche, ['адрес: недостоверность'], 'та же причина, что минус, не повторяется');
  assert.strictEqual(U.peredOplatoj(it, 'go', [], 'Проверили не всё: суды сегодня не ответили'), null);
  assert.strictEqual(U.peredOplatoj({ vid: 'schet', t: 'Плюсов 3, минусов 1', sushchestvennye: [] }, 'go', [], 'Работать можно'), null);
  assert.strictEqual(U.peredOplatoj(null, 'go', [], 'Работать можно'), null);
  const p = U.peredOplatoj(it, 'go', [], 'Работать можно');
  assert.strictEqual(bez(p.minus), 'долг по налогам 9 млн ₽ (1,2 % выручки за 2025 год)');
  const fssp = U.peredOplatoj({ vid: 'est', t: 'x', sushchestvennye: [{ t: 'РНП: запись', dolya: '' }] }, 'go', [], 'Работать можно');
  assert.strictEqual(fssp.minus, 'РНП: запись', 'аббревиатура в начале — без строчной');
});

test('ton-vyvoda-v1: пояснение — итог «Главного», несколько — «все первыми в «Главном»», оговорка «Не проверяли» остаётся', () => {
  const p1 = { itog: 'Есть 1 существенный минус на 19.11.2026', n: 1 };
  assert.strictEqual(U.poyasneniePered(p1, 'Серьёзных признаков риска не найдено'), p1.itog);
  assert.strictEqual(bez(U.poyasneniePered({ itog: 'Есть 2 существенных минуса на 19.11.2026', n: 2 }, '')), 'Есть 2 существенных минуса на 19.11.2026 — все первыми в «Главном»');
  assert.strictEqual(U.poyasneniePered(p1, 'Не проверяли: банкротство. Перед крупной оплатой посмотрите их сами'),
    p1.itog + '. Не проверяли: банкротство. Перед крупной оплатой посмотрите их сами');
  const pod = { rezhim: 'pod', minus: 'иск на 421,7 млн ₽ (2 % выручки за 2025 год)', itog: 'x', n: 2, esche: ['задолженность по налогам: 6 360 ₽'] };
  assert.strictEqual(bez(U.poyasneniePered(pod, 'что угодно')),
    'Перед оплатой посмотрите: иск на 421,7 млн ₽ (2 % выручки за 2025 год); остальные — первыми в «Главном». Ещё — задолженность по налогам: 6 360 ₽');
});

// живой /api/check 2457083313 (19.11 16:20): предел по выручке, причина — налог 6 360 ₽, а иск 421,7 млн ₽ (2 % выручки) — только в «Главном»
test('ton-vyvoda-v1: вывод с пределом (cap) и причиной-мелочью — заголовок прежний, пояснение начинается с существенного минуса', () => {
  const r = otvet(2279523000);
  r.signals[3] = { id: 'tax_debt', title: 'Задолженность по налогам', status: 'warn', detail: '6 360 ₽ (недоимка, пени и штрафы)', source: 'ФНС, открытые данные', as_of: '2026-10-01' };
  r.verdict = 'Работать можно. Есть один момент: задолженность по налогам. Уточните его перед крупной оплатой.';
  const it = itogIz(r), byl = U.decide(r, {}), v = U.decide(r, { itogG: it });
  assert.strictEqual(it.vid, 'est');
  assert.ok(byl.reasons.length, 'есть причина');
  assert.strictEqual(v.headline, byl.headline);
  assert.strictEqual(v.pered.rezhim, 'pod');
  assert.ok(bez(U.poyasneniePered(v.pered, '')).startsWith('Перед оплатой посмотрите: 34 незавершённых дела'));
  assert.strictEqual(bezPeredachi(v), bezPeredachi(byl));
});

test('ton-vyvoda-v1: разметка — нейтральный тон в «Условиях сделки», полосе вывода, «Ответе» и «Четырёх вопросах»; в тексте «Скопировать» нет «Без серьёзных сигналов»', () => {
  const rd = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  assert.ok(/v\.nedostatochno \|\| neVse \|\| v\.pered \? ' ned'/.test(rd('js/usloviya.js')));
  assert.ok(/st\.itogG = itogGlavnogo\(win, r\);[^\n]*\n\s*var v = decide\(r, st\)/.test(rd('js/usloviya.js')), 'итог «Главного» — до decide');
  assert.ok(/if \(l === 'low' && peredOplatoj\(r\)\) return 'nejtr';/.test(rd('js/otchet.js')));
  assert.ok(/\.ot-vd--nejtr\{background:var\(--surface-2,#EDE8DA\)\}/.test(rd('css/otchet.css')));
  assert.ok(/\.lip-o\[data-ton=nejtr\] \.lip-o__t::before\{background:var\(--muted,#5B6783\)\}/.test(rd('css/perehod.css')));
  assert.ok(/\|\| v\.pered \? 'ned'/.test(rd('js/chetyre-voprosa.js')));
  assert.ok(/u&&u\.pered\?'':\(\{low:'Без серьёзных сигналов'/.test(rd('index.html')));
});
