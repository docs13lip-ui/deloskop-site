// Оплата по QR СБП для граждан на /tarify/ (sbp-tarify-v1, 12.10.2026). Запуск: node --test tests/sbp_tarify.test.js
// Ворота: суммы на экране = tarify.json; ссылка QR — только из js/sbp-qr.js; в бете блока не видно; без ссылки — блока нет;
// чек и кассу не обещаем (касса — следующим шагом), давления нет.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(R, 'tarify/tarify.json'), 'utf8'));
const html = fs.readFileSync(path.join(R, 'tarify/index.html'), 'utf8');
const sbpSrc = fs.readFileSync(path.join(R, 'js/sbp-qr.js'), 'utf8');
const SSYLKA = (sbpSrc.match(/var SSYLKA = "([^"]*)";/) || [])[1] || '';
const T = require('../js/sbp-tarify.js');
const NB = ' ';

const vidimoe = (s) => s.replace(/<template\b[\s\S]*?<\/template>/g, '');
const blok = () => (html.match(/<section class="sbp-t"[\s\S]*?<\/section>/) || [])[0] || '';

test('блок есть ровно тогда, когда есть ссылка банка и бета выключена', () => {
  const est = vidimoe(html).includes('data-sbp-tarify');
  assert.strictEqual(est, Boolean(SSYLKA) && D.beta !== true);
});

test('каждая сумма на кнопках = tarify.json (разовые — cena_rub, тарифы — god и mesyac)', { skip: !blok() }, () => {
  const b = blok();
  const knopki = [...b.matchAll(/data-sbp-id="([a-z_]+)"[^>]*?data-sg="(\d+)"(?: data-sm="(\d+)")?/g)];
  assert.ok(knopki.length >= 4, 'кнопок «что оплачиваете» мало: ' + knopki.length);
  for (const [, id, sg, sm] of knopki) {
    const t = (D.tarify || []).find((x) => x.id === id);
    if (t) {
      assert.strictEqual(Number(sg), t.god, id + ': год');
      assert.strictEqual(Number(sm), t.mesyac, id + ': месяц');
    } else {
      assert.ok(D[id] && D[id].razovo, id + ' — не разовая покупка из tarify.json');
      assert.strictEqual(Number(sg), D[id].cena_rub, id);
      assert.strictEqual(sm, undefined, id + ': у разовой покупки нет «на месяц»');
    }
  }
  // все платные тарифы и три разовые покупки — на месте
  for (const t of D.tarify.filter((x) => x.mesyac > 0)) assert.ok(b.includes('data-sbp-id="' + t.id + '"'), t.id);
  for (const k of ['pasport_razovyj', 'paket_pasportov', 'pasport_svoj']) assert.ok(b.includes('data-sbp-id="' + k + '"'), k);
});

test('стартовая сумма — «Старт» на год, с неразрывным пробелом', { skip: !blok() }, () => {
  const start = D.tarify.find((x) => x.id === 'start');
  const m = blok().match(/data-sbp-summa[^>]*>([^<]+)</);
  assert.ok(m);
  assert.strictEqual(m[1], T.rub(start.god));
  assert.ok(m[1].includes(NB + '₽'));
  assert.match(blok(), /data-sbp-id="start"[^>]*aria-checked="true"|aria-checked="true" data-sbp-id="start"/);
});

test('ссылка «Оплатить по СБП» — та же, что в js/sbp-qr.js, и цель Метрики oplata_sbp', { skip: !blok() || D.beta === true }, () => {
  const a = blok().match(/<a class="cta primary sbp-t__a" href="([^"]+)"[^>]*data-goal="oplata_sbp"/);
  assert.ok(a, 'кнопка оплаты');
  assert.strictEqual(a[1].replace(/&amp;/g, '&'), SSYLKA);
});

test('в бете блок только внутри <!--oplata--> (уходит в template)', () => {
  const src = fs.readFileSync(path.join(R, 'tests/sobrat_tarify.py'), 'utf8');
  assert.ok(src.includes("return ('<!--oplata--><section class=\"sbp-t\""));
  assert.ok(src.includes("'</section><!--/oplata-->\\n')"));
});

test('скрипты подключены по порядку: кодировщик → ссылка → блок', { skip: !blok() }, () => {
  const i1 = html.indexOf('/js/qr-platezh.js'), i2 = html.indexOf('/js/sbp-qr.js'), i3 = html.indexOf('/js/sbp-tarify.js');
  assert.ok(i1 > 0 && i1 < i2 && i2 < i3);
});

test('честно: без обещаний чека и кассы, без давления; строка под тарифами не говорит «только по счёту»', { skip: !blok() || D.beta === true }, () => {
  const t = blok().replace(/<[^>]+>/g, ' ');
  for (const w of [/чек/i, /касс/i, /успе[йв]/i, /скидк/i, /только сегодня/i]) assert.ok(!w.test(t), String(w));
  assert.ok(vidimoe(html).includes('Гражданам — <a href="#sbp">по СБП</a>'));
  assert.ok(!vidimoe(html).includes('Оплата — по счёту с расчётного счёта.'));
});

test('логика: сумма и название по сроку', () => {
  assert.strictEqual(T.summa('3700', '390', 'god'), 3700);
  assert.strictEqual(T.summa('3700', '390', 'mes'), 390);
  assert.strictEqual(T.summa('490', null, 'mes'), 490);
  assert.strictEqual(T.summa('x', null, 'god'), 0);
  assert.strictEqual(T.nazv('тариф «Про»', 'mes', true), 'тариф «Про» на месяц');
  assert.strictEqual(T.nazv('«Паспорт контрагента на дату сделки»', 'mes', false), '«Паспорт контрагента на дату сделки»');
  assert.strictEqual(T.rub(14300), '14' + NB + '300' + NB + '₽');
});

test('без ссылки банка блок прячется сам (мёртвых кнопок не держим)', () => {
  const s = { hidden: false, querySelector: () => null, querySelectorAll: () => [] };
  const doc = { querySelector: (q) => (q === '[data-sbp-tarify]' ? s : null) };
  const bylo = global.DeloskopSBP;
  global.DeloskopSBP = { ssylka: () => '' };
  try { T.zapusk(doc); } finally { global.DeloskopSBP = bylo; }
  assert.strictEqual(s.hidden, true);
});
