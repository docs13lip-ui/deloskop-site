// «Без НДС» при большой выручке (js/bez-nds.js) на /proverit-schet/. node --test tests/bez_nds.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const B = require("../js/bez-nds.js");

const OKT26 = new Date("2026-10-01T12:00:00+03:00");
function otvet(vyruchka, rezhim, inn = "7707083893", god = 2025) {
  const rows = [["Основной вид деятельности", "62.01"]];
  if (rezhim) rows.push(["Налоговый режим", rezhim]);
  return {
    company: { inn },
    dossier: {
      sections: [{ id: "activity", rows }],
      charts: { revenue: [{ year: god - 1, value: 5e6 }, { year: god, value: vyruchka }] },
    },
  };
}

test("пороги п. 1 ст. 145 НК (ред. 228-ФЗ) по году дохода", () => {
  assert.strictEqual(B.porog(2024), null);
  for (const g of [2025, 2026, 2027, 2028]) assert.strictEqual(B.porog(g), 20e6);
  assert.strictEqual(B.porog(2029), 15e6);
  assert.strictEqual(B.porog(2030), 10e6);
  assert.strictEqual(B.porog(2035), 10e6);
});

test("УСН, «без НДС», выручка 2025 — 48,2 млн: информационная строка с порогом и вопросом", () => {
  const s = B.stroka(true, otvet(48_210_000, "УСН"), OKT26);
  assert.strictEqual(s.st, "info");
  assert.strictEqual(s.title, "Без НДС");
  assert.match(s.detail, /^Поставщик на упрощёнке, выручка за 2025 год по бухотчётности — 48,2\u00a0млн\u00a0₽\. Освобождение от НДС/);
  assert.match(s.detail, /в 2026 году — только при доходе за 2025 год до 20 млн ₽ \(п\. 1 ст\. 145 НК РФ\)/);
  assert.match(s.detail, /ст\. 149 НК РФ/);
  assert.match(s.detail, /вопрос, а не нарушение/);
  assert.match(s.detail, /пункт 2\.2 Делописи/);
});

test("режим неизвестен — та же строка, но условно «Если он на упрощёнке»", () => {
  const s = B.stroka(true, otvet(30e6, null), OKT26);
  assert.ok(s);
  assert.match(s.detail, /^Выручка поставщика за 2025 год/);
  assert.match(s.detail, /Если он на упрощёнке, освобождение от НДС/);
});

test("молчим: НДС в счёте есть; выручка до порога ровно и ниже; нет отчётности за прошлый год", () => {
  assert.strictEqual(B.stroka(false, otvet(48e6, "УСН"), OKT26), null);
  assert.strictEqual(B.stroka(true, otvet(20e6, "УСН"), OKT26), null);
  assert.strictEqual(B.stroka(true, otvet(19_999_999, "УСН"), OKT26), null);
  assert.strictEqual(B.stroka(true, otvet(90e6, "УСН", "7707083893", 2024), OKT26), null); // только 2024 — не судим
  assert.strictEqual(B.stroka(true, { company: { inn: "7707083893" } }, OKT26), null);
  assert.strictEqual(B.stroka(true, null, OKT26), null);
});

test("молчим: другие режимы (АУСН, ЕСХН, патент, общая система) и ИП", () => {
  for (const r of ["АУСН", "УСН, АУСН", "ЕСХН", "Патент", "Общая система (ОСН)", "СРП"])
    assert.strictEqual(B.stroka(true, otvet(48e6, r), OKT26), null, r);
  assert.strictEqual(B.stroka(true, otvet(48e6, "УСН", "500100732259"), OKT26), null);
  assert.strictEqual(B.rezhim({ sections: [{ rows: [["Налоговый режим", "УСН (упрощённая)"]] }] }), "usn");
});

test("2030 год: порог дохода за 2029-й — 15 млн ₽", () => {
  const s = B.stroka(true, otvet(16e6, "УСН", "7707083893", 2029), new Date("2030-03-01T12:00:00+03:00"));
  assert.match(s.detail, /до 15 млн ₽/);
});

test("страница «Проверь счёт» подключает модуль и выводит строку", () => {
  const h = fs.readFileSync(path.join(__dirname, "..", "proverit-schet", "index.html"), "utf8");
  assert.match(h, /<script src="\/js\/bez-nds\.js" defer><\/script>/);
  assert.match(h, /DlkBezNds\.stroka\(r\.noVat,remote,new Date\(\)\)/);
  const js = fs.readFileSync(path.join(__dirname, "..", "js", "bez-nds.js"), "utf8");
  assert.ok(!/innerHTML|fetch\(|XMLHttpRequest/.test(js), "модуль — чистые функции");
  assert.ok(!/\bИИ\b|нейросет/i.test(js));
});

// ---------- «Кому вы платите»: та же строка по ответу /api/shield/counterparties (bez-nds-vypiska-v1) ----------
const E = require("../kontragenty-iz-vypiski/engine.js");
const OOO = "7707083893";
function post(noVatGod, inn = OOO) { return { inn, kind: inn.length === 12 ? "ip" : "org", noVatGod }; }
function rm(dohod, rezhim = "usn", na = "2025-12-31") { return { inn: OOO, rezhim, dohod, dohod_na: na }; }

test("выписка: УСН, доход 2025 — 48,2 млн, платили «без НДС» в 2026-м — строка с суммой, порогом и вопросом", () => {
  const x = B.strokaVypiski(post({ 2026: 1250000 }), rm(48_210_000));
  assert.strictEqual(x.level, "info");
  assert.strictEqual(x.code, "bez_nds");
  assert.match(x.text, /^Платежи «без НДС» в 2026 году — 1 250 000 ₽\. Поставщик на упрощёнке, доход за 2025 год по бухотчётности — 48,2 млн ₽ \(открытые данные ФНС\)\. Освобождение от НДС в 2026 году/);
  assert.match(x.text, /п\. 1 ст\. 145 НК РФ/);
  assert.match(x.text, /ст\. 149 НК РФ\) — поэтому это вопрос, а не нарушение\./);
  assert.match(x.text, /на каком основании платежи без НДС/);
  assert.ok(!/  /.test(x.text), "без двойных пробелов");
});

test("выписка: режим неизвестен (нет в наборе СНР) — условно; спецрежимы — молчим", () => {
  const x = B.strokaVypiski(post({ 2026: 5e5 }), rm(30e6, null));
  assert.match(x.text, /Поставщик: доход за 2025 год .* Если он на упрощёнке, освобождение от НДС/);
  for (const r of ["ausn", "eshn", "srp"]) assert.strictEqual(B.strokaVypiski(post({ 2026: 5e5 }), rm(30e6, r)), null, r);
});

test("выписка: молчим — доход до порога, другой год платежей, нет дохода, ИП, нет ответа", () => {
  assert.strictEqual(B.strokaVypiski(post({ 2026: 5e5 }), rm(20e6)), null);
  assert.strictEqual(B.strokaVypiski(post({ 2025: 5e5 }), rm(48e6)), null);              // платили в 2025-м — решает доход 2024-го
  assert.strictEqual(B.strokaVypiski(post({ 2026: 5e5 }), rm(48e6, "usn", "2024-12-31")), null); // старый доход — не судим
  assert.strictEqual(B.strokaVypiski(post({ 2026: 5e5 }), { rezhim: "usn", dohod: null, dohod_na: null }), null);
  assert.strictEqual(B.strokaVypiski(post({ 2026: 5e5 }, "500100732259"), rm(48e6)), null);
  assert.strictEqual(B.strokaVypiski(post({ 2026: 5e5 }), null), null);
  assert.strictEqual(B.strokaVypiski(post({}), rm(48e6)), null);
});

test("движок выписки раскладывает платежи «без НДС» по годам", () => {
  const ln = (n, d, s, p) => `СекцияДокумент=Платежное поручение\nНомер=${n}\nДата=${d}\nСумма=${s}\nПлательщикСчет=40702810000000000001\nПлательщикИНН=7700000001\nПолучатель1=ООО "Поставщик"\nПолучательИНН=${OOO}\nПолучательСчет=40702810900000000002\nДатаСписано=${d}\nНазначениеПлатежа=${p}\nКонецДокумента`;
  const t = ["1CClientBankExchange", "РасчСчет=40702810000000000001",
    ln(1, "20.12.2025", "100000.00", "Оплата по счёту 1, без НДС"),
    ln(2, "15.01.2026", "250000.00", "Оплата по счёту 2. НДС не облагается"),
    ln(3, "16.02.2026", "300000.00", "Оплата по счёту 3, без налога (НДС)"),
    ln(4, "17.02.2026", "120000.00", "Оплата по счёту 4, в т.ч. НДС 22% 21639.34"), "КонецФайла"].join("\n");
  const r = E.analyze([E.parse(t)], { regime: "osn" });
  const s = r.suppliers.find((x) => x.inn === OOO);
  assert.deepStrictEqual(s.noVatGod, { 2025: 100000, 2026: 550000 });
  const x = B.strokaVypiski(s, rm(48e6));
  assert.match(x.text, /в 2026 году — 550 000 ₽/);
});

test("страница «Кому вы платите» подключает модуль до движка и выводит строку рядом с причинами из реестров", () => {
  const h = fs.readFileSync(path.join(__dirname, "..", "kontragenty-iz-vypiski", "index.html"), "utf8");
  const a = h.indexOf('<script src="/js/bez-nds.js"></script>'), b = h.indexOf('<script src="/kontragenty-iz-vypiski/engine.js"></script>');
  assert.ok(a > 0 && a < b);
  assert.match(h, /DlkBezNds\.strokaVypiski\(s,rm\)/);
});
