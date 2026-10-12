// predel-bank-v1 [Ночные-3] 11.10: «Как посчитали предел» у кредитной организации (ОКВЭД 64.1) без отчётности в ГИР БО.
// ↑ 12.10 predel-finorg-v1: число предела у банка больше не считается — текст и ссылка на Банк России. Запуск: node --test tests/predel_bank.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const U = require('../js/usloviya.js');
const NOW = '2026-10-11';
function resp(c, o) {
  return Object.assign({ checked_at: NOW, risk_level: 'low', signals: [],
    company: Object.assign({ inn: '7707083893', ogrn: '1027700132195', kind: 'LEGAL', name_short: 'ПАО «Банк»', status: 'ACTIVE', reg_date: '1991-06-20', okved: '64.19' }, c || {}) }, o || {});
}

test('банк без отчётности: с 12.10 предел не считаем (predel-finorg-v1, tests/predel_finorg.test.js) — ссылка на cbr.ru с ОГРН', () => {
  const v = U.decide(resp());
  assert.strictEqual(v.cap, null);
  assert.match(v.kak.kak, /^Для банков и страховых организаций предел предоплаты не считаем/);
  assert.deepStrictEqual(v.kak.ssylka, { t: 'Лицензию и отчётность — на сайте Банка России', u: 'https://www.cbr.ru/finorg/foinfo/?ogrn=1027700132195' });
});

test('без ОГРН — ссылка на поиск без параметра', () => {
  const v = U.decide(resp({ ogrn: '' }));
  assert.strictEqual(v.kak.ssylka.u, 'https://www.cbr.ru/finorg/foinfo/');
});

test('обычная компания и компания с выручкой — без строки и ссылки (побайтно как раньше)', () => {
  const a = U.decide(resp({ okved: '46.90' }));
  assert.ok(!/кредитная организация/.test(a.kak.kak));
  assert.strictEqual(a.kak.ssylka, undefined);
  const b = U.decide(resp({ okved: '46.90' }, { dossier: { kpi: [{ label: 'Выручка', value: 52000000 }] } }));
  assert.strictEqual(b.cap, 2000000);
  assert.ok(!/кредитная организация/.test(b.kak.kak));
  assert.strictEqual(b.kak.ssylka, undefined);
});

test('ИП и 64.9 (МФО, лизинг) — не кредитная организация', () => {
  const ip = U.decide(resp({ inn: '770000000000', kind: 'INDIVIDUAL' }));
  assert.ok(!/кредитная организация/.test(ip.kak.kak));
  const mfo = U.decide(resp({ okved: '64.92' }));
  assert.ok(!/кредитная организация/.test(mfo.kak.kak));
});

test('«стоп» и «по факту» — без строки о банке', () => {
  const v = U.decide(resp({ status: 'LIQUIDATED' }));
  assert.ok(!/кредитная организация/.test(v.kak.kak));
  assert.strictEqual(v.kak.ssylka, undefined);
});

test('«Они платят мне»: вместо «квитанции о сдаче в налоговую» — раскрытая отчётность на сайте организации или Банка России', () => {
  const v = U.decide(resp(), { napravlenie: 'otgruzhaem' });
  const ids = v.docs.map((d) => d.id);
  assert.ok(ids.includes('otchetnostBank'));
  assert.ok(!ids.includes('otchetnost'));
  const d = v.docs.find((x) => x.id === 'otchetnostBank');
  assert.ok(!/налогов/.test(d.ask));
  assert.match(d.ask, /Банка России/);
  assert.strictEqual(d.links[0].u, 'https://www.cbr.ru/finorg/foinfo/');
  assert.match(v.letter.body, /на сайте организации или Банка России/);
  const o = U.decide(resp({ okved: '46.90' }), { napravlenie: 'otgruzhaem' });
  assert.ok(o.docs.some((x) => x.id === 'otchetnost'));
});

test('отрисовка: ссылка в «Условиях сделки» и в «Как посчитали предел» (js/otchet.js) — обычной строкой, не плашкой', () => {
  const u = fs.readFileSync(path.join(__dirname, '..', 'js', 'usloviya.js'), 'utf8');
  assert.match(u, /v\.kak\.ssylka \? '<p class="usl-ne" data-u="bank"><a href="' \+ esc\(v\.kak\.ssylka\.u\) \+ '" target="_blank" rel="noopener">/);
  const o = fs.readFileSync(path.join(__dirname, '..', 'js', 'otchet.js'), 'utf8');
  assert.match(o, /kak\.ssylka \? '<p class="n" data-ot="bank"><a href="' \+ esc\(kak\.ssylka\.u\) \+ '" target="_blank" rel="noopener">'/);
});
