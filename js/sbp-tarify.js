/* Делоскоп — оплата по QR СБП для граждан на /tarify/ (sbp-tarify-v1, 12.10.2026).
   Разметку и суммы собирает tests/sobrat_tarify.py из tarify.json; здесь — только выбор «что оплачиваете» / «на год — на месяц»
   и картинка QR (ссылка — одна, js/sbp-qr.js). Нет ссылки или кодировщика — блок прячется целиком (мёртвых кнопок не держим).
   Тест: node --test tests/sbp_tarify.test.js */
(function (root) {
  "use strict";

  var NB = " ";
  function rub(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + "₽"; }

  // Сумма по выбранной кнопке и сроку: у разовых покупок срока нет — всегда data-sg.
  function summa(sg, sm, srok) {
    var g = parseInt(sg, 10), m = parseInt(sm, 10);
    if (srok === "mes" && m > 0) return m;
    return g > 0 ? g : 0;
  }

  function nazv(chto, srok, estMes) {
    if (!estMes) return chto;
    return chto + (srok === "mes" ? " на месяц" : " на год");
  }

  function zapusk(doc) {
    var s = doc.querySelector("[data-sbp-tarify]");
    if (!s) return;
    var SBP = root.DeloskopSBP, Q = root.DeloskopQR;
    var ss = SBP && SBP.ssylka ? SBP.ssylka() : "";
    var kod = s.querySelector("[data-sbp-kod]");
    var svg = ss && Q && Q.svg ? Q.svg(ss, "QR-код СБП для оплаты Делоскопа") : "";
    if (!ss) { s.hidden = true; return; }
    if (kod) { if (svg) kod.innerHTML = svg; else kod.hidden = true; }

    var chipy = [].slice.call(s.querySelectorAll("[data-sbp-chto]"));
    var srokBox = s.querySelector("[data-sbp-srok]");
    var sroki = srokBox ? [].slice.call(srokBox.querySelectorAll("[data-sbp-s]")) : [];
    var elS = s.querySelector("[data-sbp-summa]"), elN = s.querySelector("[data-sbp-nazv]");
    var st = { srok: "god" };

    function tekushchij() { return chipy.filter(function (b) { return b.getAttribute("aria-checked") === "true"; })[0] || chipy[0]; }
    function risovat() {
      var b = tekushchij(); if (!b) return;
      var estMes = b.hasAttribute("data-sm");
      if (srokBox) srokBox.hidden = !estMes;
      sroki.forEach(function (x) { x.setAttribute("aria-checked", String(x.getAttribute("data-sbp-s") === st.srok)); });
      var n = summa(b.getAttribute("data-sg"), b.getAttribute("data-sm"), estMes ? st.srok : "god");
      if (elS) elS.textContent = n ? rub(n) : "—";
      if (elN) elN.textContent = nazv(b.getAttribute("data-sbp-chto"), st.srok, estMes);
    }
    chipy.forEach(function (b) {
      b.addEventListener("click", function () {
        chipy.forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
        risovat();
      });
    });
    sroki.forEach(function (b) {
      b.addEventListener("click", function () { st.srok = b.getAttribute("data-sbp-s") === "mes" ? "mes" : "god"; risovat(); });
    });
    risovat();
  }

  var api = { summa: summa, nazv: nazv, rub: rub, zapusk: zapusk };
  root.DeloskopSBPTarify = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { zapusk(document); });
    else zapusk(document);
  }
})(typeof window !== "undefined" ? window : globalThis);
