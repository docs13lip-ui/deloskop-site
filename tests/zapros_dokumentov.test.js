// zapros-dokumentov-v1: письмо-запрос документов контрагенту — текст [Право] 11.11 п. «а» (claude/Право_выплаты_карта_запрос_11.11.md).
// Запуск: node --test tests/zapros_dokumentov.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const U = require('../js/usloviya.js');
const S = require('../js/schetchik.js');

const NOW = '2026-11-12T20:08:00+03:00';
const KART = '/company/0274110679-farmstandart/';
function sig(title, status) { return { title, status, detail: '' }; }
function resp(o) {
  return Object.assign({ checked_at: NOW, risk_level: 'low', company: { inn: '0274110679', name_short: 'АО «Фармстандарт»', status: 'ACTIVE', reg_date: '2003-03-01' }, signals: [] }, o || {});
}
const VSE = [sig('Недостоверные сведения', 'warn'), sig('Задолженность по налогам', 'warn'), sig('Долги у приставов', 'warn'),
  sig('Руководитель сменился', 'warn'), sig('Массовый адрес', 'warn'), sig('Приостановление операций по счёту', 'bad')];

test('текст [Право] дословно: приветствие, комплект, ссылка на карточку с датой, «Спасибо!» и подпись-заготовка', () => {
  const v = U.decide(resp(), { amount: 500000, kartochka: KART });
  const b = v.letter.body;
  assert.ok(b.startsWith('Здравствуйте!\n\nГотовим договор с АО «Фармстандарт» и собираем стандартный комплект документов — так мы делаем со всеми новыми партнёрами. Пришлите, пожалуйста, сканы или выписки:\n\n1. '), b);
  assert.ok(b.includes('Сведения из открытых реестров о вашей компании на 12.11.2026 мы уже посмотрели: https://deloskop.ru/company/0274110679-farmstandart/. Если там что-то неточно — напишите, учтём.'), b);
  assert.ok(b.endsWith('Спасибо!\n[Имя, должность, телефон]'), b);
  assert.strictEqual(v.letter.subject, 'Документы для договора с [Наша компания]');
});

test('запрещённые слова [Право] — ни при каком наборе признаков и суммы, в обоих направлениях', () => {
  const nabory = [[], VSE, [sig('Недостоверные сведения', 'bad')]];
  for (const s of nabory) for (const a of [0, 50000, 5e6]) for (const napr of ['platim', 'otgruzhaem']) {
    const v = U.decide(resp({ signals: s, zsk: { level: 'high' } }), { amount: a, kartochka: KART, napravlenie: napr });
    if (napr === 'platim') assert.ok(!U.LETTER_NELZYA.test(v.letter.subject + '\n' + v.letter.body), napr + ' ' + a + ': ' + (v.letter.body.match(U.LETTER_NELZYA) || [])[0]);
    // «на кону», «проверено», «надёжен» — ни в одном письме
    assert.ok(!/проверено|надёжн|подозр|115-ФЗ|Индекс/i.test(v.letter.body), napr);
  }
});

test('ссылки нет: карточки нет, адрес не карточки, ИП (12 знаков) — абзац о сведениях выпадает целиком', () => {
  for (const k of [undefined, '', '/company/', 'https://evil.example/', '/company/0274110679-x/?a=1', '/proverka/0274110679/']) {
    const b = U.decide(resp(), { kartochka: k }).letter.body;
    assert.ok(!/deloskop\.ru|Сведения из открытых реестров/.test(b), String(k));
  }
  const ip = U.decide(resp({ company: { inn: '771234567890', name_short: 'ИП Тестов', status: 'ACTIVE', reg_date: '2015-01-01' } }), { kartochka: '/company/7712345678-test/' });
  assert.ok(!/deloskop\.ru|Сведения из открытых реестров/.test(ip.letter.body));
});

test('без даты проверки — без «на …», ссылка остаётся', () => {
  const r = resp(); delete r.checked_at;
  const b = U.decide(r, { kartochka: KART }).letter.body;
  assert.ok(b.includes('Сведения из открытых реестров о вашей компании мы уже посмотрели: https://deloskop.ru' + KART), b);
});

test('карта карточек из sitemap-companies.xml: путь по ИНН, хаб и чужое не берём; живой файл — все адреса в формате', () => {
  const m = U.kartaKartochek('<loc>https://deloskop.ru/company/</loc><loc>https://deloskop.ru/company/0274110679-farmstandart/</loc><loc>https://deloskop.ru/company/771234567890-ip/</loc>');
  assert.deepStrictEqual(m, { '0274110679': KART });
  const xml = fs.readFileSync(path.join(__dirname, '..', 'sitemap-companies.xml'), 'utf8');
  const zhivaya = U.kartaKartochek(xml), n = (xml.match(/\/company\/\d/g) || []).length;
  assert.ok(Object.keys(zhivaya).length >= 100 && Object.keys(zhivaya).length === n, Object.keys(zhivaya).length + ' из ' + n);
  for (const [inn, p] of Object.entries(zhivaya)) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', p, 'index.html')), 'нет страницы ' + p);
    // письмо со ссылкой на любую из них проходит проверку адреса
    assert.ok(U.decide(resp({ company: { inn, name_short: 'ООО «Т»', status: 'ACTIVE', reg_date: '2015-01-01' } }), { kartochka: p }).letter.body.includes('https://deloskop.ru' + p));
  }
});

test('список в письме — те же пункты, что в «Что запросить у них», и без слова «налоговой»', () => {
  const v = U.decide(resp({ signals: VSE }), { amount: 5e6, kartochka: KART });
  v.docs.forEach((d, i) => assert.ok(v.letter.body.includes((i + 1) + '. ' + d.ask + '.'), d.id));
  assert.ok(v.docs.some((d) => d.id === 'unblock'), 'unblock в наборе');
  assert.ok(v.letter.body.includes('Решение ФНС об отмене приостановления операций по счёту.'));
});

test('событие zapros_copy в белом списке счётчика — только вид, без идентификаторов', () => {
  assert.strictEqual(S.VIDY.zapros_copy, 1);
  assert.deepStrictEqual(S.teloSobytiya('zapros_copy', { host: 'deloskop.ru', pathname: '/', search: '?inn=0274110679', referrer: '' }), { sobytie: 'zapros_copy' });
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'usloviya.js'), 'utf8');
  assert.ok(/dlkSobytie\('zapros_copy'\)/.test(src));
  assert.ok(!/dlkSobytie\([^)]*(inn|letter|body)/i.test(src), 'в событие не уходит ИНН и текст письма');
});
