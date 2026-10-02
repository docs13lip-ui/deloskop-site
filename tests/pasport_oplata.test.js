// «Паспорт 490 ₽ в один шаг» — лист оплаты (js/pasport-oplata.js; ТЗ [Продукт] 02.10, разд. 1.2–1.4).
// node --test tests/pasport_oplata.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const O = require('../js/pasport-oplata.js');
const T0 = JSON.parse(chitat('tarify/tarify.json'));
const T = Object.assign({}, T0, { beta: false });
const NOW = '2026-10-14T21:30:00Z'; // по Москве — уже 15.10

test('в бете и без цены лист не открывается', () => {
  assert.strictEqual(O.model(Object.assign({}, T0, { beta: true }), {}), null);
  assert.strictEqual(O.model(null, {}), null);
  assert.strictEqual(O.model(Object.assign({}, T, { pasport_razovyj: { cena_rub: 0 } }), {}), null);
});

test('заголовок — дата по Москве и название из отчёта; цена — из tarify.json, «без НДС»', () => {
  const m = O.model(T, { nazvanie: 'ООО «Пример»', now: NOW });
  assert.strictEqual(m.zag, 'Паспорт контрагента на\u00a015.10.2026');
  assert.strictEqual(m.nazvanie, 'ООО «Пример»');
  assert.strictEqual(m.cena, O.rub(T.pasport_razovyj.cena_rub));
  assert.strictEqual(m.nds, 'без НДС');
  const h = O.html(m);
  assert.ok(h.indexOf('po-zag') < h.indexOf('po-vn') && h.indexOf('po-vn') < h.indexOf('po-cena') && h.indexOf('po-cena') < h.indexOf('data-po-schet') && h.indexOf('data-po-schet') < h.indexOf('po-og'), 'порядок: заголовок → что внутри → цена → оплата → оговорка');
});

test('что внутри и оговорка — дословно по ТЗ и [Право]', () => {
  assert.deepStrictEqual(O.VNUTRI, [
    'Все признаки — с источником и датой',
    'Комментарий команды к сигналам, где он есть',
    'PDF с QR-кодом: проверить подлинность может любой',
    'Хранится в Кабинете — часть доказательств вашей осмотрительности'
  ]);
  assert.match(O.OGOVORKA, /^Оплачивая, вы принимаете оферту \(п\.\u00a03\.7\)\. Если Паспорт не сформирован или в нём ошибка по нашей вине, исправим за 3 рабочих дня, не исправим — вернём оплату\.$/);
  assert.strictEqual(O.PO_SCHETU, 'Компании и ИП — оплата по счёту');
});

test('онлайн-кнопок нет, пока провайдер не подключён; счёт — главная кнопка; https-only', () => {
  const m = O.model(T, { now: NOW });
  assert.strictEqual(m.sposoby.length, 0);
  assert.match(O.html(m), /class="po-schet po-schet--gl"/);
  const m2 = O.model(Object.assign({}, T, { sposoby: [{ id: 'sbp', nazvanie: 'СБП', href: 'https://pay.example/sbp' }, { id: 'x', nazvanie: 'Плохая', href: 'javascript:alert(1)' }] }), { now: NOW });
  assert.deepStrictEqual(m2.sposoby.map((s) => s.id), ['sbp']);
  const h2 = O.html(m2);
  assert.match(h2, /<a class="btn p" href="https:\/\/pay\.example\/sbp" data-sposob="sbp"/);
  assert.doesNotMatch(h2, /po-schet--gl/);
});

test('название экранируется; в коде нет цен, давления и ИНН в Метрике', () => {
  assert.doesNotMatch(O.html(O.model(T, { nazvanie: '<img onerror=x>' })), /<img/);
  const kod = chitat('js/pasport-oplata.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(kod, /\b(490|990|330)\b/, 'цены — только из tarify.json');
  assert.doesNotMatch(kod, /успейте|только сегодня|гарант|надёжн|надежн|скидк|setInterval|лучш/i);
  (kod.match(/cel\(w, [^;]*;/g) || []).forEach((c) => assert.doesNotMatch(c, /inn|email/i));
});

test('подключение: модуль на главной после pasport-cta.js и до otchet.js; гость открывает лист; название передаётся', () => {
  const h = chitat('index.html');
  const a = h.indexOf('<script src="/js/pasport-cta.js" defer>'), b = h.indexOf('<script src="/js/pasport-oplata.js" defer>'), c = h.indexOf('<script src="/js/otchet.js" defer>');
  assert.ok(a > 0 && b > a && c > b);
  const cta = chitat('js/pasport-cta.js');
  assert.match(cta, /sost !== 'gost' \|\| !w\.PasportOplata/);
  assert.match(cta, /PasportOplata\.otkryt\(\{ nazvanie:/);
  assert.match(cta, /if \(!ok\) w\.location\.href = href/, 'лист не открылся — обычный переход');
  assert.match(chitat('js/otchet.js'), /PasportCta\.mount\(pa, \{[^}]*nazvanie: r\.company\.name_short/);
});

test('стили: справа, на 520 px — снизу; шрифт не мельче 12 px; в печать не идёт', () => {
  const css = chitat('css/otchet.css');
  const blok = css.slice(css.indexOf('dialog.po{'));
  assert.ok(blok.length > 100);
  assert.match(blok, /@media \(max-width:520px\)\{\s*dialog\.po\{inset:auto 0 0 0/);
  assert.match(blok, /@media print\{dialog\.po\{display:none!important\}\}/);
  (blok.match(/font-size:(\d+(?:\.\d+)?)px/g) || []).forEach((f) => assert.ok(parseFloat(f.slice(10)) >= 12, f));
});
