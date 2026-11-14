// znakomstvo-v3 (14.11.2026): PDF «Знакомство с Делоскопом» (/znakomstvo.pdf — ссылка из баннера подписи писем).
// Сторожа: исходник в репозитории; знак № 27 и палитра бренда; без цен и устаревших дат (оплаты на паузе — бесплатно);
// у цифр «Почему сейчас» — первоисточник и дата; PDF — A4, 10 страниц, лёгкий, свежее исходника по смыслу (тот же заголовок).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const ISH = fs.readFileSync(path.join(KOREN, 'tests/znakomstvo/znakomstvo.html'), 'utf8');
const TEKST = ISH.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ');

test('знакомство: знак № 27 и палитра бренда, прежнего синего нет', () => {
  assert.ok(ISH.includes('M49.86 85.91A12 12 0 0 1 32.14 102.09'), 'футляр знака № 27');
  assert.ok(ISH.includes('M54 43a29 29 0 1 1 58 0'), 'линза знака № 27');
  for (const c of ['#0D2247', '#D9B45A', '#B58A32', '#F5F1E6']) assert.ok(ISH.includes(c), 'цвет ' + c);
  assert.ok(!/#(2563eb|1d4ed8|3b82f6)/i.test(ISH), 'синий прежней палитры');
  assert.ok(ISH.includes('"Unbounded"'), 'слово — Unbounded');
});

test('знакомство: без цен, тарифов «с 14 октября» и «Тарифа основателя»', () => {
  assert.ok(!/\d[\s ]?\d{3}[\s ]?₽\s*(в месяц|за год|\/год)/.test(TEKST), 'цена тарифа');
  assert.ok(!/(490|990|390)[\s ]?₽/.test(TEKST), 'цена разовой покупки');
  for (const s of ['Тариф основателя', 'с 14 октября', 'до 13 октября', 'Прайс', 'ПРАЙС']) assert.ok(!TEKST.includes(s), s);
  assert.ok(TEKST.includes('Все проверки бесплатны'), 'режим «бесплатно»');
});

test('знакомство: у цифр — источник и дата', () => {
  for (const s of ['Банк России, пресс-релиз от 31.07.2026', '«Интерфакса» от 08.09.2026', 'НК РФ, ст. 164', '23.10.2026', 'на 14 ноября 2026'])
    assert.ok(TEKST.includes(s), s);
  assert.ok(TEKST.includes('компания вымышленная') || TEKST.includes('Компания вымышленная'), 'пример отчёта помечен');
});

test('знакомство: PDF A4, 10 страниц, лёгкий', () => {
  const buf = fs.readFileSync(path.join(KOREN, 'znakomstvo.pdf'));
  assert.ok(buf.length < 400000, 'размер ' + buf.length);
  const s = buf.toString('latin1');
  assert.ok(/\/Count 10\b/.test(s), '10 страниц');
  assert.ok(/MediaBox \[0 0 594\.9\d* 841\.9\d*\]/.test(s), 'A4');
  assert.ok(buf.length > 100000, 'не пустой');
});
