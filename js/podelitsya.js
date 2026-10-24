/* Делоскоп — «Поделиться» под статьёй и разбором (podelitsya-v1, 24.10.2026).
   Разметку ставит tests/sobrat_shapku.py (podelitsya): три простые ссылки (ВКонтакте, Telegram, Одноклассники) работают и без скриптов.
   Здесь — то, без чего можно обойтись: «Скопировать ссылку» (адрес страницы без меток) и на телефоне — системное «Ещё…»
   (navigator.share); цель Метрики share_click {kuda: vk|tg|ok|copy|sys, stranica}. Чужих скриптов и cookies нет.
   Чистые функции — для tests/podelitsya.test.js. */
(function (koren) {
  "use strict";
  var PODEL = {
    // адрес для «Скопировать»: data-url блока (canonical), без запроса и якоря — люди вставляют его в чат как есть
    adres: function (url, zapas) {
      var u = String(url || zapas || "");
      return u.replace(/[?#].*$/, "");
    },
    // какие кнопки показать: копировать — если есть буфер обмена; «Ещё…» — только на сенсорном экране с navigator.share
    pokazat: function (est_bufer, est_share, sensor) {
      return { copy: !!est_bufer, sys: !!(est_share && sensor) };
    }
  };
  if (typeof module === "object" && module.exports) { module.exports = PODEL; return; }
  var d = koren.document;
  var bloki = d.querySelectorAll(".podel");
  if (!bloki.length) return;
  var nav = koren.navigator || {};
  var sensor = !!(koren.matchMedia && koren.matchMedia("(pointer:coarse)").matches);
  var vid = PODEL.pokazat(!!(nav.clipboard && nav.clipboard.writeText) || !!d.queryCommandSupported, !!nav.share, sensor);

  function cel(kuda) {
    try { if (typeof koren.dlkGoal === "function") koren.dlkGoal("share_click", { kuda: kuda, stranica: koren.location.pathname }); } catch (e) {}
  }
  function soobshchit(b, t) {
    var s = b.querySelector(".podel__ok");
    if (!s) return;
    s.textContent = t;
    clearTimeout(s._t);
    s._t = setTimeout(function () { s.textContent = ""; }, 3000);
  }
  function zapasnoe(t) {  // старые браузеры: невидимое поле + execCommand
    var p = d.createElement("textarea");
    p.value = t; p.setAttribute("readonly", ""); p.style.position = "fixed"; p.style.opacity = "0";
    d.body.appendChild(p); p.select();
    var ok = false;
    try { ok = d.execCommand("copy"); } catch (e) {}
    d.body.removeChild(p);
    return ok;
  }
  function kopirovat(b, t) {
    var gotovo = function () { soobshchit(b, "Ссылка скопирована — вставьте её в чат или письмо"); };
    var ne = function () { soobshchit(b, zapasnoe(t) ? "Ссылка скопирована — вставьте её в чат или письмо" : "Не получилось — скопируйте адрес из строки браузера"); };
    if (nav.clipboard && nav.clipboard.writeText) nav.clipboard.writeText(t).then(gotovo, ne);
    else ne();
  }
  Array.prototype.forEach.call(bloki, function (b) {
    var url = PODEL.adres(b.getAttribute("data-url"), koren.location.href);
    var zag = b.getAttribute("data-title") || d.title;
    var kc = b.querySelector('[data-podel="copy"]'), ks = b.querySelector('[data-podel="sys"]');
    if (kc && vid.copy) kc.hidden = false;
    if (ks && vid.sys) ks.hidden = false;
    b.addEventListener("click", function (e) {
      var t = e.target && e.target.closest && e.target.closest("[data-podel]");
      if (!t || !b.contains(t)) return;
      var kuda = t.getAttribute("data-podel");
      cel(kuda);
      if (kuda === "copy") { e.preventDefault(); kopirovat(b, url); }
      else if (kuda === "sys") {
        e.preventDefault();
        try { nav.share({ title: zag, url: url }).catch(function () {}); } catch (er) {}
      }
    });
  });
})(typeof window !== "undefined" ? window : this);
