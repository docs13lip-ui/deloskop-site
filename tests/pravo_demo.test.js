// pravo-demo-v1: строки [Право] 26.10 к показам /kak-rabotaet/ и витрине главной.
// 1) ИНН в показах не принадлежит реальной компании (ст. 152 ГК): код региона 00 ФНС не выдаёт;
//    сверено 27.10.2026 — /api/check?q=0000000000 и ?q=0012345673 (образец Паспорта): «не найдены в ЕГРЮЛ/ЕГРИП».
// 2) «Кому вы платите»: «доначислить по ст. 54.1 НК … окажется «технической» компанией», под суммой — «оценка, не прогноз решения».
// 3) Витрина: у живого продукта не обещаем того, чего нет (п. 2 ч. 3 ст. 5 38-ФЗ) — «Уведомления» только «в разработке».
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const K = path.join(__dirname, "..");
const kr = fs.readFileSync(path.join(K, "kak-rabotaet/index.html"), "utf8");
const main = kr.slice(kr.indexOf("<main"), kr.indexOf("</main>"));
const tekst = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;| | /g, " ").replace(/\s+/g, " ");

test("ИНН в показах /kak-rabotaet/ — только с кодом региона 00 (такого ИНН у компаний нет)", () => {
  const inn = [];
  for (const m of main.matchAll(/data-pech="(\d{10}|\d{12})"/g)) inn.push(m[1]);
  for (const m of main.matchAll(/>(\d{10}|\d{12})</g)) inn.push(m[1]);
  for (const m of main.matchAll(/ИНН[^0-9<]{0,20}(?:<[^>]+>\s*)*(\d{10}|\d{12})\b/g)) inn.push(m[1]);
  assert.ok(inn.length >= 3, "ИНН в показах не найдены — сменилась разметка?");
  for (const x of inn) assert.ok(x.startsWith("00"), "в показе ИНН " + x + " — может принадлежать настоящей компании; берите 0000000000");
});

test("«Кому вы платите»: формулировка [Право] про ст. 54.1 и «оценка, не прогноз»", () => {
  const t = tekst(main);
  assert.ok(!/могут снять/.test(t), "«могут снять» → «могут доначислить» ([Право] 26.10)");
  assert.ok(t.includes("Сколько могут доначислить по ст. 54.1 НК, если поставщик окажется «технической» компанией"), "нет строки шага [Право]");
  assert.ok(t.includes("Оценка, не прогноз решения"), "под суммой «на кону» нет «Оценка, не прогноз решения»");
});

test("витрина: «Уведомления» у живых продуктов — только «в разработке»", () => {
  const v = JSON.parse(fs.readFileSync(path.join(K, "partials/vitrina.json"), "utf8"));
  const spisok = Array.isArray(v) ? v : Object.values(v).find(Array.isArray);
  assert.ok(spisok && spisok.length > 5, "vitrina.json: нет списка экспонатов");
  for (const x of spisok) for (const u of x.umeet || [])
    if (/уведомл/i.test(u) && x.status === "zhivoe") assert.ok(/в разработке/.test(u), x.id + ": «" + u + "» — обещание без функции");
  const glav = fs.readFileSync(path.join(K, "index.html"), "utf8");
  assert.ok(!glav.includes("Уведомления туда, где"), "index.html отстал от vitrina.json — python3 tests/sobrat_vitrinu.py");
});
