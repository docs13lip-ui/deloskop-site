// oplata-alfa-v1 (12.10.2026, [Ночные запуски]): оплата картой и по СБП через Альфа-Банк — сайт за флагом.
// ТЗ команды 12.10 04:00. Флаг tarify.json → oplata_kartoj. Запуск: node --test tests/oplata_kartoj.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');
const S = require('../js/schet.js');
const G = require('../js/oplata-gotovo.js');
const T = JSON.parse(chitat('tarify/tarify.json'));

test('флаг есть и булев; без ключей банка — false', () => {
  assert.strictEqual(typeof T.oplata_kartoj, 'boolean');
  assert.ok(T._oplata_kartoj && /dostupno/.test(T._oplata_kartoj));
});

test('ворота: oplata_kartoj: true — только с разделом оферты id="o-karta" и не в бете', () => {
  if (!T.oplata_kartoj) return;
  assert.match(chitat('oferta/index.html'), /id="o-karta"/, 'в оферте нет раздела об оплате картой — флаг рано');
  assert.notStrictEqual(T.beta, true, 'в бете оплаты нет — флаг не включает кнопку');
});

test('kartojMozhno: только флаг true и не бета', () => {
  assert.strictEqual(S.kartojMozhno(null), false);
  assert.strictEqual(S.kartojMozhno({ oplata_kartoj: false }), false);
  assert.strictEqual(S.kartojMozhno({ oplata_kartoj: 'true' }), false);
  assert.strictEqual(S.kartojMozhno({ oplata_kartoj: true, beta: true }), false);
  assert.strictEqual(S.kartojMozhno({ oplata_kartoj: true, beta: false }), true);
  assert.strictEqual(S.kartojMozhno(T), T.oplata_kartoj === true && T.beta !== true);
});

test('тело заказа: тариф и срок или разовый продукт; ИНН не отправляем', () => {
  assert.deepStrictEqual(S.teloKartoj({ tarif: 'pro', srok: 'god' }, 'a@b.ru'), { tarif: 'pro', srok: 'god', email: 'a@b.ru' });
  assert.deepStrictEqual(S.teloKartoj({ produkt: 'pasport_razovyj', tarif: 'pro', srok: 'mes' }, 'a@b.ru'), { produkt: 'pasport_razovyj', email: 'a@b.ru' });
});

test('в банк уводим только по https-ссылке', () => {
  assert.ok(S.bankovskayaSsylka('https://alfa.rbsuat.com/payment/merchants/x/payment_ru.html?mdOrder=1'));
  for (const u of ['http://alfa.rbsuat.com/x', 'javascript:alert(1)', '//zlo.ru/x', 'https://', null, 42]) assert.ok(!S.bankovskayaSsylka(u), String(u));
});

test('окно счёта: кнопка карты есть в коде, но скрыта до флага; строка для граждан честная в обоих режимах', () => {
  const js = chitat('js/schet.js');
  assert.match(js, /<div data-karta hidden>/);
  assert.match(js, /mk\.hidden = !k/);
  assert.match(S.GRAZHDANE_DO, /Для граждан оплата откроется позже/);
  assert.match(S.GRAZHDANE_KARTA, /картой или по СБП/);
  assert.match(S.GRAZHDANE_KARTA, /чек придёт на e-mail/);
  assert.strictEqual(S.TEKST_KARTA, 'Оплатить картой или по СБП');
  // данные карты на нашем сайте не вводятся
  assert.doesNotMatch(js, /cvc|cvv|номер карты/i);
});

test('/oplata/gotovo/: noindex, не в sitemap, без беты-заглушки, скрипт подключён', () => {
  const h = chitat('oplata/gotovo/index.html');
  assert.match(h, /<meta name="robots" content="noindex">/);
  assert.match(h, /<script src="\/js\/oplata-gotovo\.js"><\/script>/);
  assert.match(h, /data-itog/);
  assert.match(h, /<!--shapka-->/);
  assert.match(h, /<!--podval-->/);
  assert.doesNotMatch(chitat('sitemap.xml'), /\/oplata\//);
});

test('экран итога: «оплачено» только по ответу API, не по ссылке', () => {
  assert.strictEqual(G.ekran({ status: 'oplachen' }, 1).sost, 'oplachen');
  assert.strictEqual(G.ekran({ status: 'zaregistrirovan' }, 1).sost, 'zhdem');
  assert.strictEqual(G.ekran({ status: '3ds' }, 3).sost, 'zhdem');
  assert.strictEqual(G.ekran({ status: 'otklonen' }, 1).sost, 'otkaz');
  assert.strictEqual(G.ekran({ status: 'zaregistrirovan', otkaz: true }, 1).sost, 'otkaz');
  assert.strictEqual(G.ekran({ status: 'oplachen', otkaz: true }, 1).sost, 'oplachen'); // банк важнее ссылки
  assert.strictEqual(G.ekran({ status: 'rashozhdenie', zakaz: 'K-1' }, 1).sost, 'proverka');
  assert.strictEqual(G.ekran({ oshibka: 'net', otkaz: true }, 1).sost, 'net');
  assert.strictEqual(G.ekran(null, 0).sost, 'net');
  const dolgo = G.ekran({ status: 'zaregistrirovan' }, 15);
  assert.ok(dolgo.stop && /откроется сам/.test(dolgo.t));
});

test('тексты экрана итога: без обещаний сверх оферты и без канцелярита', () => {
  const vse = ['oplachen', 'otklonen', 'rashozhdenie', 'vozvrat'].map(s => G.ekran({ status: s }, 1))
    .concat([G.ekran(null, 0), G.ekran({ status: 'zaregistrirovan' }, 15)]);
  for (const e of vse) {
    assert.doesNotMatch(e.t, /гарантир|мгновенно|навсегда|в течение 5 минут/i, e.h);
    assert.ok(e.h.length <= 28, e.h);
    for (const k of e.knopki) assert.ok(!k[1] || /^(\/|mailto:)/.test(k[1]), k[1]);
  }
  assert.strictEqual(G.rub(14300), '14 300 ₽');
  assert.ok(G.ZAKAZ_RE.test('K-261012-7F3A9C') && !G.ZAKAZ_RE.test('<b>'));
});
