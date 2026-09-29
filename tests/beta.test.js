// beta-v1: открытая бета (решение владельца 29.09.2026) — скрипты и живые файлы. node --test tests/beta.test.js
// Сборку в обе стороны проверяет tests/test_beta.py (на копии сайта).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const { platnyj, vidimoe } = require('./beta_vid.js');
const S = require('../js/schet.js');
const O = require('../js/otzyv.js');
const D = JSON.parse(chitat('tarify/tarify.json'));
const BETA = D.beta === true;

const dok = (meta) => ({ querySelector: (s) => (meta && /deloskop-rezhim/.test(s) ? { getAttribute: () => meta } : null) });

test('schet.js: режим беты — только по метке сборщика', () => {
  assert.strictEqual(S.vBete(dok('beta')), true);
  assert.strictEqual(S.vBete(dok('rabota')), false);
  assert.strictEqual(S.vBete(dok(null)), false);
});

test('schet.js: в бете вместо формы — честный текст и путь к бесплатной проверке, без полей и отправки', () => {
  const js = chitat('js/schet.js');
  const i = js.indexOf('var BETA_HTML'), j = js.indexOf('function formaBeta');
  const t = js.slice(i, j);
  assert.ok(t.includes('В бете счета не выставляем'));
  assert.ok(t.includes('href="/#inn"'));
  assert.ok(!/<input|<form|type="submit"|\/api\/schet/.test(t));
  assert.ok(/function forma\(box, nach, vDialoge\) \{\n    if \(vBete\(\)\) return formaBeta\(box\);/.test(js), 'проверка беты — первой строкой формы');
});

test('rekvizity.js: в бете реквизиты из админки не подставляет', () => {
  const R = require('../js/rekvizity.js');
  let spros = 0;
  global.fetch = () => { spros++; return Promise.resolve({ ok: false }); };
  const d = { querySelector: (s) => (s === '[data-rekv]' ? {} : /deloskop-rezhim/.test(s) ? { getAttribute: () => 'beta' } : null) };
  R.zapustit(d);
  assert.strictEqual(spros, 0);
  delete global.fetch;
});

test('otzyv.js: на сервер уходит только путь страницы — без ?inn= и без ИНН предпринимателя', () => {
  assert.strictEqual(O.stranica('/report.html?inn=7707083893#x'), '/report.html');
  assert.strictEqual(O.stranica('/company/500100732259/'), '/company/ip/');
  assert.strictEqual(O.stranica('/company/7707083893-sberbank/'), '/company/7707083893-sberbank/');
  assert.strictEqual(O.vid('/report.html'), 'otchet');
  assert.strictEqual(O.vid('/pasport/kontragent/'), 'pasport');
  assert.strictEqual(O.vid('/company/7707083893-sberbank/'), 'kartochka');
});

test('otzyv.js: из текста вырезаются почта, телефон и длинные номера; длина — до 500', () => {
  const t = O.chistyj('Иван, ivan.petrov@mail.ru, +7 (903) 123-45-67, 8 903 123 45 67, ИНН 500100732259, счёт 40702810900000000001');
  assert.ok(!/@|903|500100732259|40702810900000000001/.test(t), t);
  assert.ok(t.includes('[почта]') && t.includes('[телефон]') && t.includes('[номер]'));
  assert.strictEqual(O.chistyj('а'.repeat(900)).length, 500);
});

test('otzyv.js: тело запроса — без e-mail и имени; оценка только из двух значений; id склеивает оценку и текст', () => {
  const b = O.telo('/pasport/kontragent/?inn=7707083893', 'что-то', '', true, 'abcdef0123456789');
  assert.deepStrictEqual(Object.keys(b).sort(), ['id', 'ocenka', 'rezhim', 'stranica', 'vid']);
  assert.strictEqual(b.ocenka, 'neponyal');
  assert.strictEqual(b.id, 'abcdef0123456789');
  assert.strictEqual(b.rezhim, 'beta');
  assert.match(O.telo('/', 'polezno', 'ок', false).id, /^[0-9a-f]{16}$/);
  assert.strictEqual(O.telo('/', 'polezno', 'ок', false).tekst, 'ок');
});

test('отзыв подключён на отчёте, Паспорте контрагента и в шаблоне карточки компании', () => {
  for (const f of ['report.html', 'pasport/kontragent/index.html', 'tests/kartochki.py'])
    assert.ok(chitat(f).includes('<script src="/js/otzyv.js" defer></script>'), f);
});

test('полоса беты: одна строка, крестик прячет на неделю, хранилище — в try', () => {
  const p = chitat('partials/beta.html');
  assert.ok(p.includes('Открытая бета: всё бесплатно.'));
  assert.ok(p.includes('mailto:help@deloskop.ru'));
  assert.ok(p.includes('aria-label="Скрыть на неделю"'));
  assert.ok(/try\{if\(\+localStorage\.getItem\("dlk_beta_skryt"\)>Date\.now\(\)\)/.test(p));
  const js = chitat('js/shapka.js');
  assert.ok(js.includes('try { localStorage.setItem("dlk_beta_skryt"'));
  assert.ok(!/ИИ|нейросет/i.test(p));
});

test('живой режим: страницы собраны по флагу из tarify.json', () => {
  const glav = chitat('index.html');
  assert.strictEqual(glav.includes('<meta name="deloskop-rezhim" content="beta">'), BETA);
  assert.strictEqual(/<!--beta-polosa-->/.test(glav), BETA);
  const v = vidimoe(glav);
  if (BETA) {
    assert.ok(!v.includes('href="/schet/'), 'на главной нет ссылок на счёт');
    assert.strictEqual((v.match(/>В бете — бесплатно<\/a>/g) || []).length, 3);
    assert.ok(v.includes('<summary>Сколько это стоит сейчас?</summary>'));
    assert.ok(!v.includes('<summary>Как оплатить?</summary>'));
  }
  // оплата не потеряна: в «платном» виде все три тарифа снова с двумя кнопками
  const p = vidimoe(platnyj(glav));
  assert.strictEqual((p.match(/data-tarif="[a-z]+" data-srok="mes" href="\/schet\//g) || []).length, 3);
  assert.ok(p.includes('<summary>Как оплатить?</summary>'));
});

test('живой режим: /osnovatel/, /skoraya-115-fz/, /schet/, оферта — в бете без пути к оплате', { skip: !BETA }, () => {
  const osn = vidimoe(chitat('osnovatel/index.html'));
  assert.ok(!/Забронировать|data-schet|href="\/schet\//.test(osn));
  assert.ok(osn.includes('>В бете — всё бесплатно</a>'));
  const sk = vidimoe(chitat('skoraya-115-fz/index.html'));
  assert.ok(!/Получить пакет|Оплатите пакет|href="\/schet\//.test(sk));
  assert.strictEqual((sk.match(/href="#sc"/g) || []).length, 2);
  const sch = vidimoe(chitat('schet/index.html'));
  assert.ok(sch.includes('<title>Счета в бете — Делоскоп</title>') && !sch.includes('<ol class="shagi">'));
  assert.ok(sch.includes('<div class="card" id="forma">'), 'контейнер формы на месте — скрипт покажет текст беты');
  const of = vidimoe(chitat('oferta/index.html'));
  assert.ok(!of.includes('href="/schet/"') && of.includes('счёт — на сайте после окончания открытой беты'));
});

test('лента «Что нового»: запись об открытой бете', () => {
  const L = JSON.parse(chitat('obnovleniya.json')).obnovleniya;
  const z = L.find((x) => x.id === '2026-09-29-5');
  assert.ok(z, 'нет записи 2026-09-29-5');
  assert.ok(/бета/i.test(z.zagolovok));
  assert.ok(z.chto_proverit.every((x) => x.ssylka));
});
