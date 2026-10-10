// lestnica-390-v1 — у кнопки Паспорта гостю подсказываем «Старт», пока он дешевле разового Паспорта
// (ТЗ [Продукт · Стратег] 03.10.2026 23:55, claude/Продукт_лестница_цен_Старт390_пакет990_03.10.md, разд. 2).
// node --test tests/lestnica_390.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../js/pasport-cta.js');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const TJ = JSON.parse(chitat('tarify/tarify.json'));
const NB = '\u00a0';
const INN = '7736050003';

// копия tarify.json, где «Старт» стоит mesyac рублей в месяц (как после снятия беты — сборщик пишет цену в сам файл)
function sTsenoj(mesyac, izm) {
  const D = JSON.parse(JSON.stringify(TJ));
  const st = D.tarify.find((t) => t.id === 'start');
  st.mesyac = mesyac;
  if (izm) izm(D, st);
  return D;
}
const start = TJ.tarify.find((t) => t.id === 'start');
const cena = TJ.pasport_razovyj.cena_rub;

test('гость: «Старт» дешевле Паспорта — ссылка на /tarify/#t-start, пакета в строке нет', () => {
  const mes = start.startovaya.mesyac;
  assert.ok(mes < cena, 'стартовая цена «Старта» должна быть ниже Паспорта');
  const T = Object.assign(P.iz(sTsenoj(mes)), { beta: false });
  const s = P.sostoyanie({ tarify: T, user: null, inn: INN });
  assert.strictEqual(s.sost, 'gost');
  assert.strictEqual(s.knopka, 'Паспорт на дату сделки — ' + cena + NB + '₽');
  assert.strictEqual(s.stroka, 'Без подписки. PDF с QR-кодом, хранится в Кабинете.');
  assert.strictEqual(s.ssylka.href, '/tarify/#t-start');
  assert.strictEqual(s.ssylka.cel, 'start');
  assert.strictEqual(s.ssylka.t, 'или «' + start.nazvanie + '» — ' + mes + NB + '₽ в месяц, ' + start.otchetov + NB + 'Паспорта включены');
  assert.doesNotMatch(s.ssylka.t, /проверки —/);
  // якорь существует на /tarify/
  assert.ok(chitat('tarify/index.html').includes('id="t-start"'));
});

test('гость: «Старт» не дешевле Паспорта — прежняя ссылка на пакет', () => {
  for (const mes of [cena, cena + 100]) {
    // после беты: сборщик уже переписал цену «Старта» в tarify.json (beta: false в данных — startovaya не подставляется)
    const T = Object.assign(P.iz(sTsenoj(mes, (D) => { D.beta = false; })), { beta: false });
    const s = P.sostoyanie({ tarify: T, inn: INN });
    assert.strictEqual(s.ssylka.href, '/schet/?produkt=paket_pasportov');
    assert.strictEqual(s.ssylka.t, TJ.paket_pasportov.shtuk + ' проверки — ' + P.rub(TJ.paket_pasportov.cena_rub));
  }
  // и сейчас, в бете, tarify.json держит обычную цену; стартовую подставляем, только если она точно включится
  // (vklyuchit и «да» владельца на годовую — с 10.10.2026, oplata-schet-v1)
  const st = start.startovaya;
  const T = Object.assign(P.iz(TJ), { beta: false });
  assert.strictEqual(P.startVygodnee(T), (TJ.beta === true && st.vklyuchit === true && st.god_soglasovan === true ? st.mesyac : start.mesyac) < cena);
});

test('бета: строка с ценой «Старта» — только если стартовая цена точно включится («да» на годовую)', () => {
  // сейчас god_soglasovan не дан → прежняя строка ТЗ 02.10
  const DO = { betaDo: '2026-10-13' }, DO_T = Date.parse('2026-10-10T12:00:00+03:00'); // beta-data-v1: дата и момент фиксированы
  const sejchas = P.sostoyanie({ tarify: Object.assign(P.iz(TJ), DO), beta: true, inn: INN, sejchas: DO_T });
  if (start.startovaya.god_soglasovan !== true) {
    assert.strictEqual(sejchas.stroka, 'В бете — бесплатно. После 13.10 — ' + cena + NB + '₽ или в тарифе «' + start.nazvanie + '».');
  }
  // обычная цена «Старта» (после снятия беты сборщик хранит её в startovaya.obychnaya)
  const obych = (start.startovaya.obychnaya || {}).mesyac || start.mesyac;
  const D = sTsenoj(obych, (D, st) => { D.beta = true; st.startovaya.god_soglasovan = true; });
  const s = P.sostoyanie({ tarify: Object.assign(P.iz(D), DO), beta: true, inn: INN, sejchas: DO_T });
  assert.strictEqual(s.stroka, 'В бете — бесплатно. После 13.10 — ' + cena + NB + '₽ или в тарифе «' + start.nazvanie + '»: '
    + start.startovaya.mesyac + NB + '₽ в месяц, ' + start.otchetov + NB + 'Паспорта включены.');
  assert.ok(!s.ssylka, 'в бете ссылки на оплату нет');
  // vklyuchit: false — «Старт» по обычной цене, подсказки нет
  D.tarify.find((t) => t.id === 'start').startovaya.vklyuchit = false;
  assert.doesNotMatch(P.sostoyanie({ tarify: P.iz(D), beta: true, inn: INN }).stroka, /в месяц/);
});

test('склонение: 1 Паспорт включён / 3 Паспорта включены / 5 и 11 Паспортов включены', () => {
  assert.strictEqual(P.pasportov(1), '1' + NB + 'Паспорт включён');
  assert.strictEqual(P.pasportov(3), '3' + NB + 'Паспорта включены');
  assert.strictEqual(P.pasportov(5), '5' + NB + 'Паспортов включены');
  assert.strictEqual(P.pasportov(11), '11' + NB + 'Паспортов включены');
  assert.strictEqual(P.pasportov(22), '22' + NB + 'Паспорта включены');
});

test('в коде js/pasport-cta.js нет литералов цен и названий тарифов', () => {
  const kod = chitat('js/pasport-cta.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(kod, /390|490|990|Старт/);
});

test('пакет: «без подписки», срок и цена проверки в описании совпадают с полями tarify.json; /tarify/ — «или без подписки»', () => {
  const p = TJ.paket_pasportov;
  const shtuka = Math.floor(p.cena_rub / p.shtuk);
  assert.strictEqual(p.chto, 'Три Паспорта контрагента без подписки: действуют ' + p.srok_mes + ' месяцев с даты оплаты — '
    + shtuka + ' ₽ за проверку вместо ' + cena + ' ₽. Подходит и тем, кому не хватило проверок в тарифе');
  assert.strictEqual(p.shtuk, 3, '«Три» в описании — словом');
  const t = chitat('tarify/index.html');
  assert.ok(t.includes('3 развёрнутые проверки — 990' + NB + '₽ к любому платному тарифу или без подписки.') ||
    t.includes(p.tekst + ' — ' + P.rub(p.cena_rub) + ' к любому платному тарифу или без подписки.'));
  assert.ok(t.includes('Три Паспорта контрагента без подписки: действуют'));
});

test('ссылка «Старт» в браузере: data-ssylka и цель pasport_cta_click с ssylka', () => {
  const kod = chitat('js/pasport-cta.js');
  assert.ok(kod.includes("l.setAttribute('data-ssylka', s.ssylka.cel)"));
  assert.ok(kod.includes("cel(w, 'pasport_cta_click', { mesto: mesto, sost: s.sost, ssylka: s.ssylka.cel })"));
});
