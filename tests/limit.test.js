// Экран «бесплатные проверки на сегодня закончились» — js/limit.js (limit-ekran-v1).
// ТЗ [Продукт] 03.10 17:37, разд. 2.6; тексты — с правками [Право · Юрист 115-ФЗ] 03.10 18:10, разд. 1.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const L = require('../js/limit.js');
const T = JSON.parse(read('tarify/tarify.json'));
const NB = ' ';
const sp = (s) => String(s).replace(/ /g, ' ');

const STRANICY = {
  'index.html': 'glavnaya',
  'pasport/index.html': 'pasport',
  'pasport/kontragent/index.html': 'pasport',
  'proverit-schet/index.html': 'schet',
  'delopis/index.html': 'delopis',
  'kontragenty-iz-vypiski/index.html': 'vypiska',
};
const vse = (r) => sp([r.zag, r.stroka, r.sohr, r.ssylkiZag].concat(r.ssylki.map((x) => x.t), r.knopki.map((x) => x.t)).join(' | '));

function hranilishche(store) {
  return { localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } };
}

test('(1) при 429 текст `detail` из API нигде не выводится и «войдите» не обещаем', () => {
  for (const f of Object.keys(STRANICY)) {
    const s = read(f);
    const stroki = s.split('\n').filter((l) => /429/.test(l) && /status|\.s\b|code/.test(l));
    assert.ok(stroki.length >= 1, f + ': нет обработки 429');
    for (const l of stroki) {
      // ветка 429 — от «429» до конца ветки (return; / «:» тернарного else)
      let kusok = l.slice(l.indexOf('429'));
      for (const g of ['return;', ':esc(']) if (kusok.includes(g)) kusok = kusok.slice(0, kusok.indexOf(g));
      assert.ok(!/detail|e\.message/.test(kusok), f + ': при 429 выводится текст API: ' + kusok.slice(0, 120));
    }
    assert.ok(!/войдите в кабинет|Войти или выбрать тариф/i.test(s), f + ': осталось «войдите» у лимита');
  }
});

test('(2) бета: без цен, «Старта» и «войдите»; «тариф» — только в «тарифы не продаём»; дата конца беты', () => {
  for (const tarify of [L.iz(T), null, L.iz(Object.assign({}, T, { beta: false })), L.iz({})]) {
    const r = L.tekst({ tarify, beta: true, inn: '7707083893', stranica: 'glavnaya', sohranen: true });
    assert.strictEqual(r.beta, true);
    const t = vse(r);
    assert.ok(!/₽|Старт|войд|Войд/.test(t), t);
    assert.strictEqual((t.match(/тариф/gi) || []).length, 1, t);
    assert.ok(t.includes('тарифы не продаём и счета не выставляем'), t);
    assert.strictEqual(r.zag, 'На' + NB + 'сегодня 3' + NB + 'бесплатные проверки закончились');
    assert.strictEqual(sp(r.stroka), 'Завтра — снова 3. Пока идёт бета (по 13 октября), тарифы не продаём и счета не выставляем.');
    assert.strictEqual(r.ssylkiZag, 'Что можно сделать прямо сейчас:');
    assert.ok(!/без лимита/i.test(t), 'в бете «без лимита» не обещаем: ' + t);
    assert.strictEqual(r.knopki.length, 0);
  }
  // нет tarify.json — бета-вариант без цен, даже если страница уже не в бете
  assert.strictEqual(L.tekst({ tarify: null, beta: false }).beta, true);
});

test('(3) после беты: цены — из tarify.json; Паспорт — названием из оферты; одна primary', () => {
  const t = L.iz(Object.assign({}, T, { beta: false }));
  const start = T.tarify.find((x) => x.id === 'start');
  const r = L.tekst({ tarify: t, beta: false, inn: '7707083893', stranica: 'glavnaya' });
  assert.strictEqual(r.beta, false);
  assert.strictEqual(sp(r.stroka), 'Завтра — снова 3. Без лимита — в тарифе «' + start.nazvanie + '» за ' + sp(L.rub(start.mesyac)) + ' в месяц.');
  assert.strictEqual(r.knopki.filter((k) => k.primary).length, 1);
  assert.deepStrictEqual(r.knopki[0], { kuda: 'tarify', t: 'Тарифы', href: '/tarify/#start', primary: true });
  assert.strictEqual(sp(r.knopki[1].t), T.pasport_razovyj.nazvanie + ' — ' + sp(L.rub(T.pasport_razovyj.cena_rub)));
  assert.ok(!/Полный/.test(r.knopki[1].t));
  // ИП (12 цифр) или ИНН с опечаткой — без кнопки Паспорта
  assert.strictEqual(L.tekst({ tarify: t, beta: false, inn: '500100732259' }).knopki.length, 1);
  assert.strictEqual(L.tekst({ tarify: t, beta: false, inn: '7707083894' }).knopki.length, 1);
  // цифр в модуле нет: 490/1490 — только из файла
  const kod = read('js/limit.js');
  assert.ok(!/\b490\b|\b990\b|\b1490\b/.test(kod));
  // режим страницы «бета» главнее файла
  assert.strictEqual(L.tekst({ tarify: t, beta: true }).beta, true);
});

test('(4) все страницы лимита подключают js/limit.js и зовут dlkLimit.pokazat', () => {
  for (const [f, st] of Object.entries(STRANICY)) {
    const s = read(f);
    assert.strictEqual((s.match(/<script src="\/js\/limit\.js"/g) || []).length, 1, f);
    assert.ok(s.includes('dlkLimit.pokazat('), f);
    assert.ok(s.includes("stranica:'" + st + "'") || s.includes("stranica: '" + st + "'"), f + ' → ' + st);
  }
  // главная: limit.js — до встроенного скрипта (напоминание при загрузке), напоминание и снятие после проверки
  const g = read('index.html');
  assert.ok(g.indexOf('<script src="/js/limit.js"></script>') < g.indexOf('<script src="/js/inn.js"></script>'));
  assert.ok(g.includes('dlkLimit.napomnit(note,'));
  assert.ok(g.includes('dlkLimit.proveren('));
  // на странице счёта ссылки на саму себя нет
  assert.ok(!L.tekst({ stranica: 'schet' }).ssylki.some((x) => x.kuda === 'schet'));
  assert.strictEqual(L.tekst({ stranica: 'glavnaya' }).ssylki.length, 3);
});

test('(5) отложенные ИНН: только 10 цифр с верной контрольной, до 5, без повторов', () => {
  const store = {}, w = hranilishche(store);
  assert.strictEqual(L.sohranit(w, '500100732259'), false, 'ИНН ИП — персональные данные, не пишем');
  assert.strictEqual(L.sohranit(w, '7707083894'), false, 'опечатка');
  assert.strictEqual(L.sohranit(w, '0000000000'), false);
  assert.strictEqual(L.sohranit(w, 'Сбербанк'), false);
  assert.ok(!(L.KEY in store) || !/\d{12}/.test(store[L.KEY]));
  const inns = ['7707083893', '7736050003', '7702070139', '7728168971', '7740000076', '7713076301'];
  inns.forEach((x, i) => assert.ok(L.sohranit(w, x, 1e12 + i), x));
  L.sohranit(w, '7736050003', 1e12 + 100);
  const a = L.spisok(w, 1e12 + 200);
  assert.strictEqual(a.length, 5);
  assert.strictEqual(a[0].inn, '7736050003');
  assert.strictEqual(a.filter((x) => x.inn === '7736050003').length, 1);
  // строку «сохранили» показываем только для ИНН организации
  assert.strictEqual(L.tekst({ inn: '500100732259', sohranen: true }).sohr, '');
  assert.strictEqual(sp(L.tekst({ inn: '7707083893', sohranen: true }).sohr), 'ИНН 7707083893 сохранили на этом устройстве — завтра проверим одним нажатием.');
  // испорченное хранилище и запрет хранилища — не падаем
  assert.deepStrictEqual(L.spisok(hranilishche({ dlk_otlozhennye: '{не json' })), []);
  const zapret = { localStorage: { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } } };
  assert.strictEqual(L.sohranit(zapret, '7707083893'), false);
});

test('(5б) напоминание — только об отложенных вчера и раньше (по Москве); старше 30 дней — забываем', () => {
  const store = {}, w = hranilishche(store);
  const sejchas = Date.UTC(2026, 9, 4, 9, 0); // 04.10 12:00 МСК
  L.sohranit(w, '7707083893', Date.UTC(2026, 9, 4, 6, 0)); // сегодня 09:00 МСК
  assert.strictEqual(L.kNapominaniyu(w, sejchas), null);
  L.sohranit(w, '7736050003', Date.UTC(2026, 9, 3, 20, 30)); // 03.10 23:30 МСК — вчера
  const x = L.kNapominaniyu(w, sejchas);
  assert.strictEqual(x.inn, '7736050003');
  assert.strictEqual(sp(x.tekst), 'Вчера не успели проверить: 7736050003');
  L.ubratInn(w, '7736050003');
  L.sohranit(w, '7702070139', Date.UTC(2026, 9, 1, 9, 0));
  assert.strictEqual(sp(L.kNapominaniyu(w, sejchas).tekst), 'Не успели проверить: 7702070139');
  assert.strictEqual(L.kNapominaniyu(w, Date.UTC(2026, 10, 15)), null);
});

test('(6) вид: нейтральный блок (не «err»), кнопки 44 px, переносы — без прокрутки вбок; /cookies/ знает об отложенных ИНН', () => {
  const kod = read('js/limit.js');
  assert.ok(/\.limit\{[^}]*max-width:100%/.test(kod));
  assert.ok(/\.limit__kn a\{[^}]*min-height:44px[^}]*max-width:100%/.test(kod));
  assert.ok(/flex-wrap:wrap/.test(kod));
  assert.ok(!/className\s*=\s*'[^']*err/.test(kod));
  const c = read('cookies/index.html');
  assert.ok(c.includes('до 5 ИНН организаций, которые вы не успели проверить, у вас на устройстве'));
  assert.ok(c.includes('ИНН предпринимателей не запоминаем'));
});
