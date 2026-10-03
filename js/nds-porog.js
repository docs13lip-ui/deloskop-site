/* Делоскоп — «НДС в 2027 году» на экране проверки: строка «у порога» (nds-porog-v1, Ночные-2, 03.10.2026).
 * Логика и тексты — js/bez-nds.js prognoz() (тексты [Право · Налоговый юрист] 03.10 21:10 дословно).
 * Тон — только информационный: это вопрос поставщику, а не красный флаг (не жёлтый и не красный).
 * Ставится после «Рентабельности» / «Динамики» / фактов; повторная проверка заменяет блок; нет строки — блока нет.
 * Цели Метрики: nds_porog_view (строка показана), nds_porog_klik (переход в Делопись). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NdsPorog = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var CSS = ".ndp{display:grid;gap:6px;padding:16px 18px;border-radius:16px;border:1px solid var(--line,#E6E6E1);border-left-width:3px;border-left-color:#8A8A90;margin-top:12px}" +
    ".ndp__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 10px}.ndp__h b{font-size:15px;font-weight:600}" +
    ".ndp__h span{font-size:13px;color:var(--muted,#6B6B70)}.ndp p{margin:0}.ndp__t{font-size:15px;line-height:1.5}" +
    ".ndp__t a{color:inherit;text-decoration:underline;text-underline-offset:2px}.ndp__m{font-size:12px;color:var(--muted,#6B6B70)}" +
    "@media (max-width:520px){.ndp{padding:14px}}@media print{.ndp{break-inside:avoid}}";

  // o — результат DlkBezNds.prognoz(); molchat: osvobozhdena на экране не показываем (только факт на карточке).
  function html(o, podpis) {
    if (!o || !o.detail || o.kod === "osvobozhdena") return "";
    var t = esc(o.detail).replace("пункт 2.2 Делописи", '<a href="/delopis/" data-goal="nds_porog_klik">пункт 2.2 Делописи</a>');
    return '<section class="ndp" aria-label="' + esc(o.title) + '" data-nds-porog="' + esc(o.kod) + '">' +
      '<div class="ndp__h"><b>' + esc(o.title) + '</b><span>к сведению · ГИР БО и ФНС</span></div>' +
      '<p class="ndp__t">' + t + '</p>' +
      (podpis ? '<p class="ndp__m">' + esc(podpis) + '</p>' : '') +
      '</section>';
  }

  function stil(doc) {
    if (!doc || doc.getElementById("ndp-css")) return;
    var s = doc.createElement("style"); s.id = "ndp-css"; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  function mount(report, r, B, segodnya) {
    B = B || (typeof self !== "undefined" ? self.DlkBezNds : null);
    if (!report || !B || !B.prognoz) return null;
    var star = report.querySelector(".ndp");
    var o = B.prognoz(r, segodnya || new Date()), h = html(o, o ? B.podpis(r, o.god) : "");
    if (!h) { if (star) star.parentNode.removeChild(star); return null; }
    var doc = report.ownerDocument, t = doc.createElement("div");
    t.innerHTML = h;
    var nov = t.firstChild;
    try { stil(doc); } catch (e) {}
    if (star) star.parentNode.replaceChild(nov, star);
    else {
      var pos = null, sp = [".rnt", ".din", ".izm", ".rows"];
      for (var i = 0; i < sp.length && !pos; i++) pos = report.querySelector(sp[i]);
      if (!pos || !pos.parentNode) return null;
      pos.parentNode.insertBefore(nov, pos.nextSibling);
    }
    // клик по «пункт 2.2 Делописи» считает общий обработчик a[data-goal] (js/metrika.js)
    if (typeof self !== "undefined" && self.dlkGoal) self.dlkGoal("nds_porog_view", { kod: o.kod });
    return nov;
  }

  return { html: html, mount: mount, CSS: CSS };
});
