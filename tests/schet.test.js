// Форма «Получить счёт» (js/schet.js): чистые функции. node --test tests/*.test.*
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../js/schet.js");
const D = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tarify", "tarify.json"), "utf8"));
const T = Object.fromEntries(D.tarify.map((t) => [t.id, t]));

test("ИНН: контрольные цифры компании и ИП", () => {
  assert.ok(S.innOk("7707083893"));
  assert.ok(S.innOk("500100732259"));
  assert.ok(!S.innOk("7707083894"));
  assert.ok(!S.innOk("770708389"));
  assert.ok(!S.innOk(""));
});

test("БИК, корсчёт и расчётный счёт сверяются ключом (как в schet.py)", () => {
  assert.ok(S.ksOk("044525225", "30101810400000000225")); // Сбербанк
  assert.ok(S.ksOk("044525593", "30101810200000000593")); // Альфа-Банк
  assert.ok(!S.ksOk("044525593", "30101810400000000225"));
  assert.ok(S.rsOk("044525225", "40802810100000012345"));
  assert.ok(!S.rsOk("044525225", "40802810100000012354"));
  assert.ok(S.ogrnipOk("304480000000011".slice(0, 14) + String(Number(BigInt("30448000000001") % 13n % 10n))));
});

test("сумма: месяц, квартал = 3 × месяц, год — годовая цена из tarify.json", () => {
  assert.strictEqual(S.summa(D, "pro", "mes"), T.pro.mesyac);
  assert.strictEqual(S.summa(D, "pro", "kvartal"), T.pro.mesyac * 3);
  assert.strictEqual(S.summa(D, "pro", "god"), T.pro.god);
  assert.strictEqual(S.summa(D, "free", "god"), null);
  assert.strictEqual(S.summa(D, "pro", "nedelya"), null);
  assert.match(S.podpisSummy(D, "biznes", "god"), /экономия 11 980 ₽/);
});

test("сумма прописью", () => {
  assert.strictEqual(S.propis(14300), "Четырнадцать тысяч триста рублей 00 копеек");
  assert.strictEqual(S.propis(490), "Четыреста девяносто рублей 00 копеек");
  assert.strictEqual(S.propis(4470), "Четыре тысячи четыреста семьдесят рублей 00 копеек");
  assert.strictEqual(S.propis(47900), "Сорок семь тысяч девятьсот рублей 00 копеек");
  assert.strictEqual(S.propis(21001), "Двадцать одна тысяча один рубль 00 копеек");
  assert.strictEqual(S.propis(1112000), "Один миллион сто двенадцать тысяч рублей 00 копеек");
  assert.strictEqual(S.propis(2), "Два рубля 00 копеек");
});

test("запасной путь: письмо с готовым текстом заявки", () => {
  const z = { tarif: "pro", srok: "god", inn: "7707083893", email: "buh@x.ru", nazvanie: "ПАО Сбербанк" };
  const m = S.mailtoZayavki(z, D);
  assert.ok(m.startsWith("mailto:help@deloskop.ru?subject="));
  assert.strictEqual(decodeURIComponent(m.split("subject=")[1].split("&")[0]), "Счёт: Про, год");
  const t = S.tekstZayavki(z, D);
  assert.match(t, /ИНН плательщика: 7707083893 \(ПАО Сбербанк\)/);
  assert.match(t, /14 300 ₽/);
});

test("дата дд.мм.гггг", () => {
  assert.strictEqual(S.ddmm("2026-09-26"), "26.09.2026");
});
