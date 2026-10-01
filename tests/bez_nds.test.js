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
