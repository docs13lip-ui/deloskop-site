// ekran-limita-v1 — экран 11-й проверки: одно предложение по поведению (решение команды 12.10.2026, п. 1).
// Флаг tarify.json → ekran_limita (по умолчанию false): пока юрист команды не дал «да» текстам (38-ФЗ), экран прежний.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const L = require('../js/limit.js');
const T = JSON.parse(read('tarify/tarify.json'));
const sp = (s) => String(s).replace(/\u00a0/g, ' ');
const START = T.tarify.find((x) => x.id === 'start');
const PRO = T.tarify.find((x) => x.id === 'pro');
const G = T.gost_v_den;

function hranilishche(store) {
  return { localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } };
}
const vkl = (dop) => L.iz(Object.assign({}, T, { beta: false, ekran_limita: true }, dop || {}));
const vse = (r) => sp([r.zag, r.stroka, r.chestno || ''].concat(r.knopki.map((x) => x.t), r.ssylki.map((x) => x.t)).join(' | '));

test('(1) флаг выключен — экран прежний, побайтно как до ekran-limita-v1', () => {
  assert.strictEqual(typeof T.ekran_limita, 'boolean');
  const t = L.iz(Object.assign({}, T, { beta: false, ekran_limita: false }));
  for (const pov of [null, { dni: 5, inn: 99 }]) {
    const r = L.tekst({ tarify: t, beta: false, inn: '7707083893', stranica: 'glavnaya', povedenie: pov });
    assert.strictEqual(r.vid, undefined);
    assert.strictEqual(r.chestno, undefined);
    assert.deepStrictEqual(r.knopki[0], { kuda: 'tarify', t: 'Тарифы', href: '/tarify/#start', primary: true });
    assert.ok(sp(r.stroka).startsWith('Завтра — снова ' + G + '. Без лимита — в тарифе «'));
  }
  // в бете экран предложения не включается, даже если флаг true
  const b = L.tekst({ tarify: L.iz(Object.assign({}, T, { beta: true, ekran_limita: true })), beta: false, inn: '7707083893', povedenie: { dni: 3, inn: 40 } });
  assert.strictEqual(b.beta, true);
  assert.strictEqual(b.knopki.length, 0);
});

test('(2) одно предложение по правилу: много компаний → «Про», часто → «Старт» на год, иначе Паспорт; ровно одна кнопка', () => {
  const t = vkl();
  const P = T.ekran_limita_pravila;
  const sl = (pov, inn) => L.tekst({ tarify: t, beta: false, inn: inn === undefined ? '7707083893' : inn, stranica: 'glavnaya', povedenie: pov });
  const pro = sl({ dni: 1, inn: P.inn_za_den });
  const start = sl({ dni: P.dni_za_nedelyu, inn: P.inn_za_den - 1 });
  const pas = sl({ dni: 1, inn: 3 });
  const bezInn = sl({ dni: 1, inn: 3 }, '500100732259'); // ИП — без Паспорта (как раньше), предлагаем «Старт»
  assert.deepStrictEqual([pro.vid, start.vid, pas.vid, bezInn.vid], ['pro', 'start', 'pasport', 'start']);
  for (const r of [pro, start, pas, bezInn]) {
    assert.strictEqual(r.knopki.length, 1, 'одно действие на экране: ' + vse(r));
    assert.strictEqual(r.knopki[0].primary, true);
    assert.strictEqual(sp(r.chestno), 'Можно ничего не покупать: завтра снова ' + G + ' бесплатных проверок.');
  }
  // «Про» — партнёрская программа первой ссылкой
  assert.strictEqual(pro.ssylki[0].href, '/partneram/');
  assert.ok(!start.ssylki.some((x) => x.kuda === 'partneram'));
  // «не первый день» — только когда так и есть
  assert.ok(sp(start.stroka).startsWith('Бесплатные проверки заканчиваются у вас не первый день за неделю.'));
  assert.ok(!/не первый день/.test(bezInn.stroka));
});

test('(3) цены и числа на экране = tarify.json; в модуле цифр цен нет', () => {
  const t = vkl();
  const r = (pov, inn) => L.tekst({ tarify: t, beta: false, inn: inn || '7707083893', povedenie: pov });
  const pro = r({ inn: 999 }), start = r({ dni: 7 }), pas = r({});
  assert.strictEqual(sp(pro.knopki[0].t), '«' + PRO.nazvanie + '» на год — ' + sp(L.rub(PRO.god)));
  assert.strictEqual(pro.knopki[0].href, '/schet/?tarif=pro&srok=god');
  assert.ok(sp(pro.stroka).includes(PRO.otchetov + ' развёрнутых проверок в месяц'));
  assert.strictEqual(sp(start.knopki[0].t), '«' + START.nazvanie + '» на год — ' + sp(L.rub(START.god)));
  assert.strictEqual(start.knopki[0].href, '/schet/?tarif=start&srok=god');
  assert.ok(sp(start.stroka).includes(START.otchetov + ' развёрнутые проверки в месяц'));
  assert.strictEqual(sp(pas.knopki[0].t), T.pasport_razovyj.nazvanie + ' — ' + sp(L.rub(T.pasport_razovyj.cena_rub)));
  assert.strictEqual(pas.knopki[0].href, '/schet/?produkt=pasport_razovyj&inn=7707083893');
  assert.strictEqual(pas.knopki[0].gost, true, 'Паспорт — через лист оплаты, как раньше');
  // поменяли цену в файле — поменялась на экране
  const t2 = vkl({ tarify: T.tarify.map((x) => (x.id === 'start' ? Object.assign({}, x, { god: 1234 }) : x)) });
  assert.strictEqual(sp(L.tekst({ tarify: t2, beta: false, povedenie: { dni: 7 } }).knopki[0].t), '«' + START.nazvanie + '» на год — 1 234 ₽');
  assert.ok(!/\b(390|490|990|1490|3700|14300|4990)\b/.test(read('js/limit.js')));
});

test('(4) тон без давления (38-ФЗ): ни «успейте», ни «только сегодня», ни «скидка»', () => {
  const t = vkl();
  for (const pov of [{ inn: 999 }, { dni: 7 }, {}]) {
    const s = vse(L.tekst({ tarify: t, beta: false, inn: '7707083893', povedenie: pov }));
    assert.ok(!/успе[йв]|только сегодня|последн|скидк|выгодн|лучш|не упустите|осталось/i.test(s), s);
  }
});

test('(5) поведение на устройстве: дни лимита за 7 дней (по Москве), разные ИНН за день — отпечатками, без самих ИНН', () => {
  const store = {}, w = hranilishche(store);
  const d0 = Date.UTC(2026, 9, 12, 9, 0); // 12.10 12:00 МСК
  assert.deepStrictEqual(L.povedenie(w, d0), { dni: 0, inn: 0 });
  L.otmetitLimit(w, '7707083893', d0);
  L.otmetitLimit(w, '7707083893', d0 + 1000); // тот же день, тот же ИНН — без повторов
  assert.deepStrictEqual(L.povedenie(w, d0), { dni: 1, inn: 1 });
  L.otmetitInn(w, '500100732259', d0); // ИП считаем, но не храним
  L.otmetitInn(w, 'не ИНН', d0);
  assert.deepStrictEqual(L.povedenie(w, d0), { dni: 1, inn: 2 });
  const vse = JSON.stringify(store);
  assert.ok(!/\d{10}/.test(vse), 'ИНН в хранилище: ' + vse);
  // завтра: дней 2, компаний — с нуля
  const d1 = Date.UTC(2026, 9, 13, 6, 0);
  L.otmetitLimit(w, '7736050003', d1);
  assert.deepStrictEqual(L.povedenie(w, d1), { dni: 2, inn: 1 });
  // через неделю старые дни уходят
  assert.deepStrictEqual(L.povedenie(w, Date.UTC(2026, 9, 20, 9, 0)), { dni: 0, inn: 0 });
  // граница суток по Москве: 13.10 00:30 МСК = 12.10 21:30 UTC — уже новый день
  const s2 = {}, w2 = hranilishche(s2);
  L.otmetitLimit(w2, '7707083893', Date.UTC(2026, 9, 12, 20, 50));
  L.otmetitLimit(w2, '7707083893', Date.UTC(2026, 9, 12, 21, 30));
  assert.strictEqual(L.povedenie(w2, Date.UTC(2026, 9, 12, 21, 30)).dni, 2);
  // испорченное или запрещённое хранилище — не падаем, предложение по умолчанию
  assert.deepStrictEqual(L.povedenie(hranilishche({ dlk_limit_dni: '{x', dlk_limit_den: '"y"' })), { dni: 0, inn: 0 });
  const zapret = { localStorage: { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } } };
  assert.deepStrictEqual(L.otmetitLimit(zapret, '7707083893'), { dni: 0, inn: 0 });
  // отпечаток короткий: 20 бит — по нему ИНН не восстановить
  assert.ok(/^[0-9a-z]{1,4}$/.test(L.otpechatok('7707083893')));
});

test('(6) хранение описано на /cookies/; поведение пишется только при включённом экране и не в бете', () => {
  const c = read('cookies/index.html');
  assert.ok(c.includes('сколько разных компаний вы проверили сегодня'));
  assert.ok(c.includes('Самих ИНН для этого не храним'));
  const kod = read('js/limit.js');
  assert.ok(/t && t\.ekran && !beta && !t\.beta\) pov = otmetitLimit/.test(kod));
  assert.ok(/t && t\.ekran && !t\.beta\) otmetitInn/.test(kod));
  // Метрика: вид предложения — ключом vid (в белом списке js/metrika.js), без ИНН
  assert.ok(/KLYUCHI = \{[^}]*\bvid: 1/.test(read('js/metrika.js')));
});
