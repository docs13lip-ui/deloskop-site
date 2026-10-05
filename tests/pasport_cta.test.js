// «Паспорт 490 ₽ в один шаг» — кнопка Паспорта по состояниям (js/pasport-cta.js; ТЗ [Продукт] 02.10, разд. 1).
// node --test tests/pasport_cta.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../js/pasport-cta.js');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const TJ = JSON.parse(chitat('tarify/tarify.json'));
const NB = '\u00a0';
// startMes: null — прежние состояния ТЗ 02.10 без подсказки «Старта»; её проверяет tests/lestnica_390.test.js (и до, и после снятия беты)
const T = Object.assign(P.iz(TJ), { beta: false, startMes: null });
const INN = '7736050003';

test('цены и названия — только из tarify.json', () => {
  assert.strictEqual(T.cena, TJ.pasport_razovyj.cena_rub);
  assert.strictEqual(T.paketCena, TJ.paket_pasportov.cena_rub);
  assert.strictEqual(T.paketShtuk, TJ.paket_pasportov.shtuk);
  assert.strictEqual(T.start, TJ.tarify.find((t) => t.id === 'start').nazvanie);
  const kod = chitat('js/pasport-cta.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(kod, /490|990|Старт/, 'чисел и названий тарифов в коде нет');
  assert.strictEqual(P.iz({}), null);
});

test('бета: «Паспорт контрагента» + строка ТЗ дословно; ссылки на оплату нет', () => {
  const s = P.sostoyanie({ tarify: T, beta: true, inn: INN });
  assert.strictEqual(s.sost, 'beta');
  assert.strictEqual(s.knopka, 'Паспорт контрагента');
  assert.strictEqual(s.stroka, 'В бете — бесплатно. После 13.10 — ' + TJ.pasport_razovyj.cena_rub + NB + '₽ или в тарифе «Старт».');
  assert.strictEqual(s.href, '/pasport/kontragent/?inn=' + INN);
  assert.ok(!s.ssylka);
  assert.doesNotMatch(s.href, /schet|oplat/);
  // флаг beta в tarify.json тоже включает бету
  assert.strictEqual(P.sostoyanie({ tarify: Object.assign({}, T, { beta: true }), inn: INN }).sost, 'beta');
});

test('гость и бесплатный: цена в кнопке, строка ТЗ, «3 проверки — 990 ₽», путь — прежняя форма счёта', () => {
  for (const user of [null, { plan: 'free' }, { plan: 'free', paket: { ostalos: 0 } }]) {
    const s = P.sostoyanie({ tarify: T, user, inn: INN });
    assert.strictEqual(s.sost, 'gost');
    assert.strictEqual(s.knopka, 'Паспорт на дату сделки — 490' + NB + '₽');
    assert.strictEqual(s.stroka, 'Без подписки. PDF с QR-кодом, хранится в Кабинете.');
    assert.deepStrictEqual(s.ssylka, { t: '3 проверки — 990' + NB + '₽', href: '/schet/?produkt=paket_pasportov', cel: 'paket' });
    assert.strictEqual(s.href, '/schet/?produkt=pasport_razovyj');
  }
});

test('пакет, тариф, готовый Паспорт', () => {
  const p = P.sostoyanie({ tarify: T, user: { plan: 'free', paket: { ostalos: 2, do: '2027-10-14' } }, inn: INN });
  assert.deepStrictEqual([p.sost, p.knopka, p.stroka], ['paket', 'Сформировать Паспорт', 'Осталось 2 из 3 · до 14.10.2027']);
  for (const plan of ['start', 'pro', 'business', 'team']) {
    const t = P.sostoyanie({ tarify: T, user: { plan }, inn: INN });
    assert.deepStrictEqual([t.sost, t.knopka, t.stroka], ['tarif', 'Сформировать Паспорт', 'Входит в ваш тариф'], plan);
  }
  const g = P.sostoyanie({ tarify: T, beta: true, gotov: { nomer: 'ДС-0001', sformirovan: '2026-10-02T13:05:00Z' }, inn: INN });
  assert.deepStrictEqual([g.sost, g.knopka, g.stroka], ['gotov', 'Открыть Паспорт № ДС-0001', 'Сформирован 02.10.2026 в 16:05']);
  // tarify.json не загрузился — без цены, без выдумок
  const n = P.sostoyanie({ tarify: null, inn: INN });
  assert.deepStrictEqual([n.knopka, n.stroka], ['Паспорт контрагента', '']);
});

test('нельзя (ТЗ 1.3): ни давления, ни обещаний, ни таймеров; ИНН в Метрику не уходит', () => {
  const kod = chitat('js/pasport-cta.js');
  assert.doesNotMatch(kod, /успейте|только сегодня|гарант|надёжн|надежн|скидк|setInterval|лучш/i);
  assert.match(kod, /pasport_cta_view', \{ mesto: mesto, sost: s\.sost \}/);
  assert.match(kod, /pasport_cta_click', \{ mesto: mesto, sost:/);
  assert.doesNotMatch(kod.match(/function cel[\s\S]*?\n  }/)[0] + kod.match(/cel\(w, [^)]*\)/g).join(''), /inn|email/i);
});

test('главная: модуль подключён до otchet.js; лист передаёт адрес API; строка 13 px', () => {
  const h = chitat('index.html');
  const iP = h.indexOf('<script src="/js/pasport-cta.js" defer>'), iO = h.indexOf('<script src="/js/otchet.js" defer>');
  assert.ok(iP > 0 && iO > iP);
  assert.match(h, /Otchet\.razlozhit\(report,r,\{[^}]*api:CAPI\}/);
  assert.match(chitat('js/otchet.js'), /PasportCta\.mount\(pa, \{ inn: r\.company\.inn, mesto: 'list'/);
  assert.match(chitat('css/otchet.css'), /\.pcta\{[^}]*font-size:13px/);
});
