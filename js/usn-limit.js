/* Делоскоп — «Лимит упрощёнки» в отчёте о проверке (usn-limit-otchet-v1, тексты сверены налоговым юристом команды 03.11.2026).
 * Когда: организация (10 цифр), режим в досье — УСН, выручка за прошлый год (ГИР БО, строка 2110) — от 80 % лимита
 * доходов упрощёнки на текущий год. Лимит на 2026 год — 490,5 млн ₽ (450 млн ₽ из п. 4 ст. 346.13 НК РФ × дефлятор 1,090).
 * Лимит на 2027 год добавляется в LIMIT только после сверки приказа о дефляторе на 2027 год — до того в 2027 году блок молчит.
 * Тон — только информационный (как «НДС в 2027 году», js/nds-porog.js): пояснение «что значит для сделки», Индекс не двигает.
 * ИП не показываем (у ИП нет бухотчётности; данные ИП не публикуем).
 * Цель Метрики: usn_limit_view {kod: u_limita | vyshe_limita}. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DlkUsnLimit = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Лимит доходов упрощёнки на год (п. 4 ст. 346.13 НК РФ с учётом дефлятора). Нет года — молчим, не угадываем.
  var LIMIT = { 2026: 490.5e6 };
  var DOLYA = 0.8; // «близко к лимиту» — от 80 % (392,4 млн ₽ на 2026 год)

  function mln(n) {
    var x = Math.round(n / 1e5) / 10;
    return String(x).replace(".", ",") + " млн ₽";
  }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // Режим из досье: true — названа упрощёнка (без АУСН, ЕСХН, патента, СРП, общей системы).
  function naUsn(dossier) {
    var secs = (dossier && dossier.sections) || [];
    for (var i = 0; i < secs.length; i++) {
      var rows = secs[i].rows || [];
      for (var j = 0; j < rows.length; j++) {
        if (rows[j][0] !== "Налоговый режим") continue;
        var v = String(rows[j][1] || "");
        if (/АУСН|ЕСХН|СРП|Патент|ПСН|ОСН|Общая/i.test(v)) return false;
        return /УСН/.test(v);
      }
    }
    return false;
  }

  /* remote — ответ /api/check; segodnya — Date. → {kod, title, detail, vyruchka, god, limit} или null. */
  function stroka(remote, segodnya) {
    if (!remote) return null;
    var co = remote.company || {};
    if (!/^\d{10}$/.test(String(co.inn || ""))) return null;              // ИП и без ИНН — молчим
    var d = remote.dossier || {};
    if (!naUsn(d)) return null;
    var T = (segodnya || new Date()).getFullYear(), L = LIMIT[T], god = T - 1;
    if (!L) return null;
    var ryad = (d.charts && d.charts.revenue) || [], v = null;
    for (var i = 0; i < ryad.length; i++) {
      var x = ryad[i];
      if (x && x.year === god && typeof x.value === "number") v = x.value;
    }
    if (v == null || v < L * DOLYA) return null;                          // нет отчётности за год или далеко от лимита
    var title = "Лимит упрощёнки";
    if (v > L) {
      return { kod: "vyshe_limita", title: title, vyruchka: v, god: god, limit: L,
        detail: "Выручка за " + god + " год выше лимита упрощёнки, а режим в реестре — УСН. " +
          "Данные о режиме могут отставать — уточните у компании." };
    }
    return { kod: "u_limita", title: title, vyruchka: v, god: god, limit: L,
      detail: "Выручка за " + god + " год — " + mln(v) + ", это близко к лимиту упрощёнки на " + T + " год (" + mln(L) + "). " +
        "Если компания превысит лимит, она перейдёт на общий режим с начала месяца превышения и начнёт платить НДС 22 %. " +
        "Проверьте, что договор говорит о цене «в том числе НДС» или «плюс НДС»." };
  }

  var CSS = ".ulo{display:grid;gap:6px;padding:16px 18px;border-radius:16px;border:1px solid var(--line,#E6E6E1);border-left-width:3px;border-left-color:#8A8A90;margin-top:12px}" +
    ".ulo__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 10px}.ulo__h b{font-size:15px;font-weight:600}" +
    ".ulo__h span{font-size:13px;color:var(--muted,#6B6B70)}.ulo p{margin:0}.ulo__t{font-size:15px;line-height:1.5}" +
    ".ulo__m{font-size:12px;color:var(--muted,#6B6B70)}@media (max-width:520px){.ulo{padding:14px}}@media print{.ulo{break-inside:avoid}}";

  // Подпись: «Режим — открытые данные ФНС на ДД.ММ.ГГГГ; выручка — бухотчётность ГИР БО за 2025 год. Лимит — п. 4 ст. 346.13 НК РФ.»
  function podpis(remote, god) {
    var s = String(((remote || {}).dossier || {}).data_dates || ""), data = "";
    s.split(";").forEach(function (ch) {
      var m = /^\s*(.+?)\s+—\s+(?:на\s+)?(\d{2}\.\d{2}\.\d{4})\s*$/.exec(ch);
      if (m && !data && /режим/i.test(m[1])) data = m[2];
    });
    return "Режим — открытые данные ФНС" + (data ? " на " + data : "") + "; выручка — бухотчётность ГИР БО за " + god +
      " год. Лимит — п. 4 ст. 346.13 НК РФ.";
  }

  function html(o, pp) {
    if (!o || !o.detail) return "";
    return '<section class="ulo" aria-label="' + esc(o.title) + '" data-usn-limit="' + esc(o.kod) + '">' +
      '<div class="ulo__h"><b>' + esc(o.title) + '</b><span>к сведению · ГИР БО и ФНС</span></div>' +
      '<p class="ulo__t">' + esc(o.detail) + '</p>' +
      (pp ? '<p class="ulo__m">' + esc(pp) + '</p>' : '') +
      '</section>';
  }

  function stil(doc) {
    if (!doc || doc.getElementById("ulo-css")) return;
    var s = doc.createElement("style"); s.id = "ulo-css"; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // Ставится после «НДС в 2027 году» (или после рентабельности / нагрузки / динамики / фактов); повторная проверка заменяет блок.
  function mount(report, r, segodnya) {
    if (!report) return null;
    var star = report.querySelector(".ulo");
    var o = stroka(r, segodnya || new Date()), h = html(o, o ? podpis(r, o.god) : "");
    if (!h) { if (star) star.parentNode.removeChild(star); return null; }
    var doc = report.ownerDocument, t = doc.createElement("div");
    t.innerHTML = h;
    var nov = t.firstChild;
    try { stil(doc); } catch (e) {}
    if (star) star.parentNode.replaceChild(nov, star);
    else {
      var pos = null, sp = [".ndp", ".rnt", ".ngo", ".din", ".izm", ".rows"];
      for (var i = 0; i < sp.length && !pos; i++) pos = report.querySelector(sp[i]);
      if (!pos || !pos.parentNode) return null;
      pos.parentNode.insertBefore(nov, pos.nextSibling);
    }
    if (typeof self !== "undefined" && self.dlkGoal) self.dlkGoal("usn_limit_view", { kod: o.kod });
    return nov;
  }

  return { LIMIT: LIMIT, DOLYA: DOLYA, naUsn: naUsn, stroka: stroka, podpis: podpis, html: html, mount: mount, CSS: CSS };
});
