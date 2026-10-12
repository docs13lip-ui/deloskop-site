// pokupka-chestno-v1 (ТЗ [команда] 12.10, разд. 2, пп. 1–3): Паспорт покупают на конкретную компанию — её ИНН
// в ссылке, в форме счёта, в заявке и в комментарии СБП; тексты /schet/ для разовой покупки; квартал без «по цене месяца».
// Запуск: node --test tests/pokupka_chestno.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const S = require('../js/schet.js');
const P = require('../js/pasport-cta.js');
const L = require('../js/limit.js');
const T = JSON.parse(R('tarify/tarify.json'));

test('строка «Паспорт на …»: компания — с названием, ИП — без имени, битый ИНН — пусто', () => {
  assert.strictEqual(S.pasportNa('7707083893', 'ПАО «Сбербанк»'), 'Паспорт на ПАО «Сбербанк», ИНН 7707083893 — сведения на день открытия.');
  assert.strictEqual(S.pasportNa('7707083893', ''), 'Паспорт на компанию, ИНН 7707083893 — сведения на день открытия.');
  assert.strictEqual(S.pasportNa('500100732259', 'Иванов Иван Иванович'), 'Паспорт на индивидуального предпринимателя, ИНН 500100732259 — сведения на день открытия.');
  assert.strictEqual(S.pasportNa('7707083894', 'x'), '');
  assert.strictEqual(S.innKontragenta(' 7707 083 893 '), '7707083893');
});

test('комментарий СБП — «{e-mail} {ИНН}»', () => {
  assert.strictEqual(S.sbpKommentarij(' buh@firma.ru ', '7707083893'), 'buh@firma.ru 7707083893');
  assert.strictEqual(S.sbpKommentarij('', '7707083893'), '7707083893');
  assert.strictEqual(S.sbpKommentarij('a@b.ru', '123'), 'a@b.ru');
});

test('заявка письмом называет компанию Паспорта', () => {
  const t = S.tekstZayavki({ produkt: 'pasport_razovyj', inn: '7736050003', email: 'a@b.ru', inn_kontragenta: '7707083893', nazvanie_kontragenta: 'ПАО «Сбербанк»' }, T);
  assert.match(t, /Паспорт на компанию: ИНН 7707083893 \(ПАО «Сбербанк»\)/);
  assert.match(t, /ИНН плательщика: 7736050003/);
});

test('экран результата: ссылка на /schet/ содержит inn=', () => {
  const s = P.sostoyanie({ tarify: { cena: 490, start: 'Старт', startMes: 390, paketShtuk: 3, paketCena: 990 }, user: null, inn: '7707083893' });
  assert.match(s.href, /^\/schet\/\?produkt=pasport_razovyj&inn=7707083893$/);
  const src = R('js/limit.js');
  assert.match(src, /href: '\/schet\/\?produkt=pasport_razovyj' \+ \(.*'&inn=' \+ inn/);
});

test('форма счёта: ИНН компании передаётся в заявку; без него — обязательное поле', () => {
  const src = R('js/schet.js');
  assert.ok(src.includes('inn_kontragenta: st.kInn || undefined'));
  assert.ok(src.includes('ИНН компании, которую проверяем'));
  assert.ok(src.includes('Впишите ИНН компании — Паспорт делаем на неё'));
  assert.ok(src.includes('ваш e-mail и ИНН компании: '));
  assert.ok(src.includes('Скопировать комментарий'));
  const lst = R('js/pasport-oplata.js');
  assert.ok(lst.includes('S.forma(box, { produkt: m.produkt, inn: m.inn, nazvanie: m.nazvanie }, true)'));
});

test('/schet/: разовая покупка без «тарифа и срока», квартал — без «по цене месяца», inn из адреса', () => {
  const h = R('schet/index.html');
  assert.ok(!/по цене месяца/.test(h));
  assert.ok(h.includes('<b>Квартал</b> — три месяца одним счётом, без скидки. <b>Год</b> — на&nbsp;20&nbsp;% дешевле.'));
  assert.ok(h.includes("Впишите ИНН плательщика — счёт с реквизитами будет готов сразу."));
  assert.ok(h.includes('Откроем Паспорт в кабинете на почту из заявки и пришлём акт для бухгалтерии.'));
  assert.ok(h.includes("inn:q.get('inn')"));
});

test('цены не тронуты: Паспорт в tarify.json — 490 ₽', () => {
  assert.strictEqual(T.pasport_razovyj.cena_rub, 490);
  assert.ok(L);
});
