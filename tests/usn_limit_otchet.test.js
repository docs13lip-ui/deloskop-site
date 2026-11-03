// «Лимит упрощёнки» в отчёте (js/usn-limit.js, usn-limit-otchet-v1). node --test tests/usn_limit_otchet.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
require("./razvernut_sborku.js");
const U = require("../js/usn-limit.js");

const NOY26 = new Date("2026-11-03T12:00:00+03:00");
function otvet(vyruchka, rezhim, inn = "7707083893", god = 2025) {
  const rows = [["Основной вид деятельности", "41.20"]];
  if (rezhim) rows.push(["Налоговый режим", rezhim]);
  return {
    company: { inn },
    dossier: {
      sections: [{ id: "activity", rows }],
      charts: { revenue: [{ year: god - 1, value: 300e6 }, { year: god, value: vyruchka }] },
      data_dates: "ЕГРЮЛ — 01.11.2026; налоговый режим — на 25.10.2026",
    },
  };
}

test("порог 80 %: 392,4 млн ₽ — строка «у лимита» дословно по тексту юриста; 392,3 — молчим", () => {
  assert.strictEqual(U.LIMIT[2026], 490.5e6);
  const s = U.stroka(otvet(392.4e6, "УСН"), NOY26);
  assert.strictEqual(s.kod, "u_limita");
  assert.strictEqual(s.title, "Лимит упрощёнки");
  assert.strictEqual(s.detail,
    "Выручка за 2025 год — 392,4 млн ₽, это близко к лимиту упрощёнки на 2026 год (490,5 млн ₽). " +
    "Если компания превысит лимит, она перейдёт на общий режим с начала месяца превышения и начнёт платить НДС 22 %. " +
    "Проверьте, что договор говорит о цене «в том числе НДС» или «плюс НДС».");
  assert.strictEqual(U.stroka(otvet(392.3e6, "УСН"), NOY26), null);
  assert.strictEqual(U.stroka(otvet(490.5e6, "УСН"), NOY26).kod, "u_limita", "ровно лимит — ещё не превышение");
});

test("выше лимита при режиме УСН — «данные о режиме могут отставать», без суммы", () => {
  const s = U.stroka(otvet(612e6, "УСН"), NOY26);
  assert.strictEqual(s.kod, "vyshe_limita");
  assert.strictEqual(s.detail, "Выручка за 2025 год выше лимита упрощёнки, а режим в реестре — УСН. Данные о режиме могут отставать — уточните у компании.");
});

test("молчим: ИП, другие режимы, режим не назван, нет отчётности за прошлый год, год без сверенного лимита", () => {
  assert.strictEqual(U.stroka(otvet(450e6, "УСН", "500100732259"), NOY26), null);
  for (const r of ["АУСН", "УСН, АУСН", "ЕСХН", "Патент", "Общая система (ОСН)", "СРП", null])
    assert.strictEqual(U.stroka(otvet(450e6, r), NOY26), null, String(r));
  assert.strictEqual(U.stroka(otvet(450e6, "УСН", "7707083893", 2024), NOY26), null);
  assert.strictEqual(U.stroka(otvet(450e6, "УСН", "7707083893", 2026), new Date("2027-05-10T12:00:00+03:00")), null,
    "лимит 2027 — только после сверки приказа № 732");
  assert.strictEqual(U.stroka(null, NOY26), null);
});

test("вёрстка: серый «к сведению», подпись с датой режима; пакет отчёта и вызов на главной", () => {
  const o = U.stroka(otvet(400e6, "УСН"), NOY26);
  const h = U.html(o, U.podpis(otvet(400e6, "УСН"), o.god));
  assert.match(h, /^<section class="ulo" aria-label="Лимит упрощёнки" data-usn-limit="u_limita">/);
  assert.match(h, /Режим — открытые данные ФНС на 25\.10\.2026; выручка — бухотчётность ГИР БО за 2025 год\./);
  assert.ok(!/#E0A100|#D9480F|ulo--(warn|bad)/.test(h + U.CSS), "не жёлтый и не красный");
  assert.ok(!/ИИ|нейросет/i.test(h));
  const karta = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "partials", "sborka.json"), "utf8"));
  const ot = karta.pakety.otchet;
  assert.ok(ot.indexOf("js/usn-limit.js") === ot.indexOf("js/nds-porog.js") + 1, "в пакете отчёта — сразу после nds-porog");
  const ix = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(ix, /if\(!svoj&&window\.DlkUsnLimit\)\{try\{DlkUsnLimit\.mount\(report,r\)\}catch\(e\)\{\}\}/);
  assert.ok(ix.indexOf("DlkUsnLimit.mount") > ix.indexOf("NdsPorog.mount(report,r)"));
});
