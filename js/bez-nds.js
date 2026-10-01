/* Делоскоп — «Без НДС» при большой выручке: /proverit-schet/ и «Кому вы платите» (/kontragenty-iz-vypiski/).
 * Счёт «без НДС» от поставщика на упрощёнке законен, пока его доход за прошлый год не больше порога
 * п. 1 ст. 145 НК РФ (ред. 228-ФЗ от 04.07.2026): 20 млн ₽ за 2025–2028 годы, 15 млн ₽ за 2029-й,
 * 10 млн ₽ за 2030-й и дальше. Сверено [Налоговым юристом] — sroki.json, id usn_nds_porog.
 * Данные — из ответа /api/check: выручка (строка 2110) по годам из ГИР БО ФНС — dossier.charts.revenue,
 * налоговый режим — строка «Налоговый режим» раздела activity (открытые данные ФНС «СНР» и DaData).
 * Честно о пределах: выручка по бухотчётности ≠ доход по правилам упрощёнки, а «без НДС» законно и при
 * большой выручке по льготным операциям (ст. 149 НК РФ). Поэтому это информационная строка («спросите»),
 * а не красный флаг. ИП не показываем (у ИП нет бухотчётности; данные ИП не публикуем).
 * Чистые функции: без DOM, без сети. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DlkBezNds = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Порог дохода за год `godDohoda`, выше которого в следующем году освобождения нет (п. 1 ст. 145 НК РФ).
  function porog(godDohoda) {
    if (godDohoda < 2025) return null;          // старые годы — другие пороги, не считаем
    if (godDohoda <= 2028) return 20e6;         // 20 млн ₽ — доход за 2025–2028 годы
    if (godDohoda === 2029) return 15e6;
    return 10e6;
  }

  function mln(n) {
    var x = Math.round(n / 1e5) / 10;
    return String(x).replace(".", ",") + " млн ₽";
  }

  // Режим из досье: "usn" | "drugoj" (АУСН, ЕСХН, патент, СРП, ОСН — правило не то) | null (не знаем)
  function rezhim(dossier) {
    var secs = (dossier && dossier.sections) || [];
    for (var i = 0; i < secs.length; i++) {
      var rows = secs[i].rows || [];
      for (var j = 0; j < rows.length; j++) {
        if (rows[j][0] !== "Налоговый режим") continue;
        var v = String(rows[j][1] || "");
        if (/АУСН|ЕСХН|СРП|Патент|ПСН|ОСН|Общая/i.test(v)) return "drugoj";
        if (/УСН/.test(v)) return "usn";
        return null;
      }
    }
    return null;
  }

  /* noVat — в счёте «Без НДС» / «НДС не облагается»; remote — ответ /api/check; segodnya — Date.
   * → {st:'info', title, detail} или null (молчим, если не уверены). */
  function stroka(noVat, remote, segodnya) {
    if (!noVat || !remote) return null;
    var co = remote.company || {};
    if (co.inn && String(co.inn).length !== 10) return null;            // ИП — не показываем
    var d = remote.dossier || {};
    var rz = rezhim(d);
    if (rz === "drugoj") return null;
    var god = (segodnya || new Date()).getFullYear() - 1;               // доход прошлого года решает этот год
    var p = porog(god);
    if (!p) return null;
    var ryad = (d.charts && d.charts.revenue) || [];
    var t = null;
    for (var i = 0; i < ryad.length; i++) if (ryad[i] && ryad[i].year === god) t = ryad[i];
    if (!t || typeof t.value !== "number" || t.value <= p) return null;   // нет отчётности за год — молчим
    var nachalo = rz === "usn"
      ? "Поставщик на упрощёнке, выручка за " + god + " год по бухотчётности — " + mln(t.value) + ". Освобождение"
      : "Выручка поставщика за " + god + " год по бухотчётности — " + mln(t.value) + ". Если он на упрощёнке, освобождение";
    return {
      st: "info",
      title: "Без НДС",
      detail: nachalo + osvobozhdenie(god, p) + " Спросите поставщика, на каком основании " +
        "счёт без НДС. Что будет с ценой, если НДС появится, — заранее в договоре: пункт 2.2 Делописи."
    };
  }

  // Общая середина строки — одна для «Проверь счёт» и «Кому вы платите» (текст сверяет [Налоговый юрист]).
  function osvobozhdenie(god, p) {
    return " от НДС в " + (god + 1) + " году — только при доходе за " + god + " год до " + mln(p) +
      " (п. 1 ст. 145 НК РФ), выше — счёт выставляют с НДС: по общей ставке или по ставке 5 или 7%. " +
      "Доход для порога считают по правилам упрощёнки, не по бухотчётности, а «без НДС» законно и при льготной " +
      "операции (ст. 149 НК РФ) — поэтому это вопрос, а не нарушение.";
  }

  function rub(n) {
    return Math.round(n).toLocaleString("ru-RU").replace(/[\s\u202f]/g, "\u00a0") + "\u00a0₽";
  }

  // Режим из ответа /api/shield/counterparties (открытые данные ФНС «СНР»): "usn" | "ausn" | "eshn" | "srp" | null.
  // null — компании нет в наборе спецрежимов: общая система или набор отстаёт → говорим условно.
  function rezhimKoda(k) {
    if (k === "usn") return "usn";
    if (k === "ausn" || k === "eshn" || k === "srp") return "drugoj";
    return null;
  }

  /* «Кому вы платите» (/kontragenty-iz-vypiski/): s — поставщик из DeloVypiska.analyze (inn, kind, noVatGod —
   * {год: сумма платежей с «без НДС» в назначении}); rm — элемент ответа /api/shield/counterparties
   * (rezhim, dohod — «СумДоход» набора ФНС revexp, dohod_na — 31.12 отчётного года).
   * Судим только платежи года, следующего за годом дохода: платили в 2026-м — решает доход за 2025-й.
   * → {level:'info', code:'bez_nds', text} или null. */
  function strokaVypiski(s, rm) {
    if (!s || !rm || s.kind !== "org" || !s.inn || String(s.inn).length !== 10) return null;
    var rz = rezhimKoda(rm.rezhim);
    if (rz === "drugoj") return null;
    if (typeof rm.dohod !== "number" || !/^\d{4}-/.test(String(rm.dohod_na || ""))) return null;
    var god = parseInt(String(rm.dohod_na).slice(0, 4), 10);
    var p = porog(god);
    if (!p || rm.dohod <= p) return null;
    var summa = (s.noVatGod || {})[god + 1];
    if (!(summa > 0)) return null;
    var dohod = "доход за " + god + " год по бухотчётности — " + mln(rm.dohod) + " (открытые данные ФНС).";
    var nachalo = "Платежи «без НДС» в " + (god + 1) + " году — " + rub(summa) + ". " + (rz === "usn"
      ? "Поставщик на упрощёнке, " + dohod + " Освобождение"
      : "Поставщик: " + dohod + " Если он на упрощёнке, освобождение");
    return {
      level: "info",
      code: "bez_nds",
      text: nachalo + osvobozhdenie(god, p) + " Спросите поставщика, на каком основании платежи без НДС. " +
        "Что будет с ценой, если НДС появится, — заранее в договоре: пункт 2.2 Делописи."
    };
  }

  return { porog: porog, rezhim: rezhim, stroka: stroka, mln: mln, rezhimKoda: rezhimKoda, strokaVypiski: strokaVypiski };
});
