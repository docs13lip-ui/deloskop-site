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

// ---------- «НДС в 2027 году»: строка «у порога» (nds-porog-v1; тексты [Право · Налоговый юрист] 03.10 21:10) ----------
const NP = require("../js/nds-porog.js");
const OKT3 = new Date("2026-10-03T12:00:00+03:00");
function usn(v25, v24 = null, inn = "7707083893", rezhim = "УСН", ryad = null) {
  const rev = ryad || [{ year: 2024, value: v24 }, { year: 2025, value: v25 }].filter((x) => typeof x.value === "number");
  return { company: { inn }, dossier: { data_dates: "ЕГРЮЛ/ЕГРИП — на 03.10.2026; специальные налоговые режимы — на 25.09.2026",
    sections: [{ id: "activity", rows: [["Налоговый режим", rezhim]] }], charts: { revenue: rev } } };
}

test("НДС-2027: УСН, 18,4 млн за 2025 — u_poroga, текст [Право] дословно, хвост и п. 5 ст. 145", () => {
  const x = B.prognoz(usn(18_400_000, 18_300_000), OKT3);
  assert.strictEqual(x.kod, "u_poroga");
  assert.strictEqual(x.st, "info");
  assert.strictEqual(x.title, "НДС в 2027 году");
  assert.strictEqual(x.detail.replace(/ /g, " "),
    "Поставщик на упрощёнке, выручка за 2025 год по бухотчётности — 18,4 млн ₽, у порога 20 млн ₽. Если доход за 2026 год превысит 20 млн ₽, " +
    "в 2027 году освобождения от НДС не будет (п. 1 ст. 145 НК РФ). Если превысит уже в 2026 году — НДС появится с 1-го числа следующего месяца " +
    "(п. 5 ст. 145 НК РФ). Спросите поставщика, будет ли НДС в счетах 2027 года, и закрепите в договоре, что будет с ценой: пункт 2.2 Делописи. " +
    "Доход для порога считают по правилам упрощёнки, не по бухотчётности, а «без НДС» законно и при льготной операции (ст. 149 НК РФ) — поэтому это вопрос, а не нарушение.");
});

test("НДС-2027: рост к порогу — u_poroga_rost с фразой «наша оценка… а не данные ФНС»", () => {
  const x = B.prognoz(usn(18_400_000, 13_731_343), OKT3);
  assert.strictEqual(x.kod, "u_poroga_rost");
  assert.match(x.detail, /За 2025 год выручка выросла на 34 %\. Если рост сохранится, доход за 2026 год превысит 20 млн ₽\. Это наша оценка по двум годам отчётности, а не данные ФНС\./);
  assert.ok(!/выросла/.test(B.prognoz(usn(18_400_000, 19e6), OKT3).detail), "падение — без фразы о росте");
});

test("НДС-2027: граница — ровно 20 000 000 «у порога», 20 000 001 — uzhe_platit (в рублях, без «20 млн выше 20 млн»)", () => {
  assert.strictEqual(B.prognoz(usn(20_000_000), OKT3).kod, "u_poroga");
  const x = B.prognoz(usn(20_000_001), OKT3);
  assert.strictEqual(x.kod, "uzhe_platit");
  assert.strictEqual(x.title, "НДС в 2026 году");
  assert.match(x.detail, /— 20 000 001 ₽, выше порога 20 млн ₽\. Поэтому в 2026 году он, вероятно, платит НДС — по общей ставке или по ставке 5 или 7% \(п\. 8 ст\. 164 НК РФ\)\. Если в счёте «Без НДС» — спросите основание\./);
  assert.match(B.prognoz(usn(48_210_000), OKT3).detail, /— 48,2 млн ₽, выше порога/);
});

test("НДС-2027: молчим — 12 млн (на экране), ОСН и неизвестный режим, ИП, нет 2025, май 2027 с выручкой 2026", () => {
  const o = B.prognoz(usn(12e6), OKT3);
  assert.strictEqual(o.kod, "osvobozhdena");
  assert.strictEqual(NP.html(o, "x"), "", "освобождена — на экране блока нет");
  assert.strictEqual(B.prognoz(usn(18.4e6, null, "7707083893", "Общая система (ОСН)"), OKT3), null);
  assert.strictEqual(B.prognoz(usn(18.4e6, null, "7707083893", "АУСН"), OKT3), null);
  const bezRezhima = usn(48e6); bezRezhima.dossier.sections = [];
  assert.strictEqual(B.prognoz(bezRezhima, OKT3), null, "режим неизвестен — не пишем «на упрощёнке»");
  assert.strictEqual(B.prognoz(usn(18.4e6, null, "500100732259"), OKT3), null);
  assert.strictEqual(B.prognoz(usn(null, 18e6), OKT3), null);
  assert.strictEqual(B.prognoz(usn(0, null, "7707083893", "УСН", [{ year: 2024, value: 18e6 }]), OKT3), null);
  const s26 = usn(0, null, "7707083893", "УСН", [{ year: 2025, value: 18.4e6 }, { year: 2026, value: 19e6 }]);
  assert.strictEqual(B.prognoz(s26, new Date("2027-05-02T12:00:00+03:00")), null);
  assert.strictEqual(B.prognoz(s26, new Date("2027-02-01T12:00:00+03:00")), null, "отчётность за 2026 есть — уже не прогноз");
  assert.strictEqual(B.prognoz(usn(18.4e6), new Date("2027-02-01T12:00:00+03:00")).kod, "u_poroga", "до мая 2027 — ещё прогноз");
  assert.strictEqual(B.prognoz(usn(18.4e6), new Date("2025-12-31T12:00:00+03:00")), null);
  assert.strictEqual(B.prognoz(null, OKT3), null);
});

test("НДС-2027: подпись — дата набора спецрежимов из досье; нет даты — без неё", () => {
  assert.strictEqual(B.podpis(usn(1), 2025), "Режим — открытые данные ФНС на 25.09.2026; выручка — бухотчётность ГИР БО за 2025 год.");
  assert.strictEqual(B.podpis({ dossier: {} }, 2025), "Режим — открытые данные ФНС; выручка — бухотчётность ГИР БО за 2025 год.");
});

test("НДС-2027: блок на экране — тон info, ссылка на Делопись с целью, экранирование", () => {
  const x = B.prognoz(usn(18.4e6), OKT3);
  const h = NP.html(x, B.podpis(usn(1), 2025));
  assert.match(h, /^<section class="ndp" aria-label="НДС в 2027 году" data-nds-porog="u_poroga">/);
  assert.match(h, /<a href="\/delopis\/" data-goal="nds_porog_klik">пункт 2\.2 Делописи<\/a>/);
  assert.match(h, /«без НДС»/);
  assert.ok(!/ndp--(warn|bad)|#E0A100|#D9480F/.test(h + NP.CSS), "не жёлтый и не красный");
  const ix = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(ix.indexOf('<script src="/js/bez-nds.js" defer></script>') > 0 && ix.indexOf('<script src="/js/bez-nds.js" defer></script>') < ix.indexOf('<script src="/js/nds-porog.js" defer></script>'));
  assert.match(ix, /if\(!svoj&&window\.NdsPorog\)\{try\{NdsPorog\.mount\(report,r\)\}catch\(e\)\{\}\}/);
});

test("НДС-2027: «Кому вы платите» — счёт поставщиков у порога (УСН, доход 2025 от 15 млн до 20 млн включительно)", () => {
  const sp = [
    { inn: "7707083893", rezhim: "usn", dohod: 18e6, dohod_na: "2025-12-31" },
    { inn: "7707083894", rezhim: "usn", dohod: 20e6, dohod_na: "2025-12-31" },
    { inn: "7707083895", rezhim: "usn", dohod: 20_000_001, dohod_na: "2025-12-31" },
    { inn: "7707083896", rezhim: "usn", dohod: 15e6, dohod_na: "2025-12-31" },
    { inn: "7707083897", rezhim: null, dohod: 18e6, dohod_na: "2025-12-31" },
    { inn: "7707083898", rezhim: "usn", dohod: 18e6, dohod_na: "2024-12-31" },
    { inn: "500100732259", rezhim: "usn", dohod: 18e6, dohod_na: "2025-12-31" },
    null,
  ];
  assert.strictEqual(B.uPorogaVypiski(sp), 2);
  assert.strictEqual(B.uPorogaVypiski(null), 0);
});

// Защита от мифа «15 млн ₽ с 2027 года»: 228-ФЗ от 04.07.2026 сохранил 20 млн ₽ на 2027–2029 годы ([Право] 21:10, разд. 2).
// Верная будущая ступень «15 млн … за 2029 год» / «в 2030 году» и опровержение «…15 млн ₽… в 2027 году не действует» — не нарушение.
test("НДС-2027: на сайте нет «15 млн» рядом с «2027»", () => {
  const koren = path.join(__dirname, "..");
  const plohie = [];
  (function obhod(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.name.startsWith(".") || f.name === "node_modules" || f.name === "tests" || f.name === "kartochki_dannye") continue;
      const p = path.join(d, f.name);
      if (f.isDirectory()) { obhod(p); continue; }
      if (!/\.(html|js|json|xml|txt)$/.test(f.name)) continue;
      const t = fs.readFileSync(p, "utf8").replace(/ |&nbsp;|&#160;/g, " ");
      const rx = /15\s*млн/g; let m;
      while ((m = rx.exec(t))) {
        const okno = t.slice(Math.max(0, m.index - 80), m.index + 80);
        const vpered = t.slice(m.index, m.index + 40);
        if (/2027/.test(okno) && !/^15\s*млн[^.;]{0,25}(2029|2030)/.test(vpered) && !/^15\s*млн[^.;]{0,60}не действует/.test(t.slice(m.index, m.index + 90))) plohie.push(path.relative(koren, p) + ": …" + okno.replace(/\s+/g, " ") + "…");
      }
    }
  })(koren);
  assert.deepStrictEqual(plohie, []);
});
