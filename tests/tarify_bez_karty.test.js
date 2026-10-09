// tarify-bez-karty-v1: /tarify/ честно без карты (ТЗ [Продукт · Стратег] 03.10.2026; тексты [Право] 03.10.2026, разд. 4).
// "karta": false в tarify.json — оплата только по счёту: нет автосписаний, «карту не трогаем», «частным лицам», «самозанят».
// Сборку в обе стороны проверяем на копии сайта (живые файлы не трогаем). node --test tests/tarify_bez_karty.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const D = JSON.parse(chitat('tarify/tarify.json'));
const T = require('../tarify/tarify.js');

// видимый текст страницы: без JSON-данных, скриптов и стилей (там служебные пояснения)
const vidimoe = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
const ZAPRET = [/спиш/i, /списани/i, /карту не трогаем/i, /частным лицам/i, /самозанят/i, /376-ФЗ/];
const OBYAZ = ['Счёт на месяц', 'ИП и небольшим компаниям', 'Сами мы ничего не списываем', 'Отменять нечего',
  'Отказаться можно и раньше', 'вернём деньги за неиспользованные дни', 'только если вы сами оплатите новый счёт'];
const BESP = 'Бесплатно — быстрая проверка. В тарифе — развёрнутая проверка (Паспорт контрагента) и PDF с датой проверки.';

function sobrat(karta) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bez-karty-'));
  const kop = path.join(tmp, 'site');
  fs.cpSync(K, kop, { recursive: true, filter: (s) => !/[\\/](\.git|node_modules|company|__pycache__)$/.test(s) });
  const f = path.join(kop, 'tarify/tarify.json');
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  d.karta = karta;
  fs.writeFileSync(f, JSON.stringify(d, null, 2));
  execFileSync('python3', ['-W', 'ignore', 'tests/sobrat_tarify.py', '.'], { cwd: kop, stdio: 'pipe' });
  const h = fs.readFileSync(path.join(kop, 'tarify/index.html'), 'utf8');
  fs.rmSync(tmp, { recursive: true, force: true });
  return h;
}

test('живой tarify.json: karta = false, пока нет эквайера (14.10 — только счёт)', () => {
  assert.strictEqual(D.karta, false);
  assert.ok(D._karta && D._karta.includes('false'), 'пояснение _karta');
  assert.strictEqual(D.tarify.find((t) => t.id === 'start').dlya_bez_karty, 'ИП и небольшим компаниям');
});

test('живой /tarify/ собран из tarify.json (karta:false): запретных слов нет, обязательные есть', () => {
  const h = chitat('tarify/index.html');
  const v = vidimoe(h);
  for (const z of ZAPRET) assert.ok(!z.test(v), 'на странице: ' + z);
  for (const z of [/частным лицам/, /самозанят/, /спиш/]) assert.ok(!z.test(h), 'в данных страницы: ' + z);
  for (const s of OBYAZ) assert.ok(v.includes(s), 'нет строки: ' + s);
  assert.strictEqual((v.match(/>Счёт на месяц</g) || []).length, 3, 'три кнопки «Счёт на месяц»');
  assert.strictEqual((v.match(/data-mes-tekst="Счёт на месяц"/g) || []).length, 3);
  assert.ok(v.includes(BESP));
  assert.ok(v.includes('href="/oferta/#o6"'), 'ссылка на разд. 6 оферты');
});

test('сборка karta:false и karta:true на копии сайта', () => {
  const net = vidimoe(sobrat(false));
  for (const z of ZAPRET) assert.ok(!z.test(net), 'karta:false: ' + z);
  for (const s of OBYAZ) assert.ok(net.includes(s), 'karta:false нет: ' + s);
  const da = vidimoe(sobrat(true));
  for (const s of ['Оплачивать помесячно', 'ИП, самозанятым и частным лицам', 'Отказались — карту не трогаем', '376-ФЗ',
    'следующий месяц просто не спишется', 'двенадцати списаний']) assert.ok(da.includes(s), 'karta:true нет: ' + s);
  assert.ok(!da.includes('data-mes-tekst'), 'karta:true — без data-mes-tekst');
  assert.ok(!da.includes('Отменять нечего'));
  assert.ok(da.includes(BESP), 'строка под «Бесплатно» — при любом флаге');
  // не трогаем: цены и обещания, которые остаются при любом флаге
  for (const s of ['Цена года не меняется', 'Переход выше — только разница', 'Индекс не продаётся']) {
    assert.ok(net.includes(s) && da.includes(s), s);
  }
});

test('tarify.js: подпись помесячной кнопки берётся из data-mes-tekst', () => {
  function el(attrs, text) {
    return { a: Object.assign({}, attrs), textContent: text,
      getAttribute(k) { return this.a[k] === undefined ? null : this.a[k]; }, setAttribute(k, v) { this.a[k] = v; } };
  }
  const a = el({ 'data-srok': 'mes', href: 'm' }, 'Счёт на месяц');
  const b = el({ 'data-srok': 'god', href: 'g' }, 'Оплатить год — 14 300 ₽');
  const k = el({ 'data-cena-m': '1 490 ₽', 'data-cena-g': '14 300 ₽', 'data-mes-tekst': 'Счёт на месяц' });
  k.querySelector = (s) => (s === '.cta' ? a : b);
  const doc = { querySelectorAll: () => [k] };
  T.knopki('god', doc);
  assert.strictEqual(b.textContent, 'Счёт на месяц — 1 490 ₽');
  T.knopki('mes', doc);
  assert.strictEqual(a.textContent, 'Счёт на месяц');
});
