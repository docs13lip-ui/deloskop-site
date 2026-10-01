/* Делоскоп — «Без НДС» при большой выручке, /proverit-schet/.
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
      detail: nachalo + " от НДС в " + (god + 1) + " году — только при доходе за " + god + " год до " + mln(p) +
        " (п. 1 ст. 145 НК РФ), выше — счёт выставляют с НДС: по общей ставке или по ставке 5 или 7%. " +
        "Доход для порога считают по правилам упрощёнки, не по бухотчётности, а «без НДС» законно и при льготной " +
        "операции (ст. 149 НК РФ) — поэтому это вопрос, а не нарушение. Спросите поставщика, на каком основании " +
        "счёт без НДС. Что будет с ценой, если НДС появится, — заранее в договоре: пункт 2.2 Делописи."
    };
  }

  return { porog: porog, rezhim: rezhim, stroka: stroka, mln: mln };
});
