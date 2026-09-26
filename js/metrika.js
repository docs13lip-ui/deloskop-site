/* Делоскоп — Яндекс Метрика ТОЛЬКО с согласия (claude/ИП_правовой_пакет_v1.md, раздел 6).
   Счётчик 113083788, Вебвизор выключен. Код Метрики не загружается, пока человек не нажал «Принять»
   в баннере cookies; «Только необходимые» — не загружается. Выбор хранится в браузере 12 месяцев.
   Цели: window.dlkGoal("check_started" | "report_opened" | "invoice_created" | "registration" |
   "article_to_tool" | "whatsnew_open", {параметры}) — без согласия ничего не отправляет. */
(function () {
  "use strict";
  var ID = 113083788;
  var KEY = "dlk_cookies";
  var GOD = 365 * 24 * 3600 * 1000;
  var zagruzhen = false;

  function chitat() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (v && (v.v === "all" || v.v === "need") && Date.now() - v.t < GOD) return v.v;
    } catch (e) {}
    return null;
  }
  function zapisat(v) { try { localStorage.setItem(KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {} }

  function zagruzit() {
    if (zagruzhen) return;
    zagruzhen = true;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
    window.ym(ID, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
  }

  window.dlkGoal = function (cel, params) {
    if (chitat() !== "all" || typeof window.ym !== "function") return;
    try { window.ym(ID, "reachGoal", cel, params || {}); } catch (e) {}
  };

  window.dlkCookies = {
    vybor: chitat,
    prinyat: function () { zapisat("all"); ubratBanner(); zagruzit(); obnovitStranicu(); },
    tolkoNuzhnye: function () {
      var byl = chitat() === "all" && zagruzhen;
      zapisat("need"); ubratBanner(); obnovitStranicu();
      if (byl) location.reload(); // уже загруженный счётчик выгрузить можно только перезагрузкой
    }
  };

  function ubratBanner() { var b = document.querySelector(".ck-bar"); if (b) b.remove(); }

  function banner() {
    if (document.querySelector(".ck-bar")) return;
    var d = document.createElement("div");
    d.className = "ck-bar";
    d.setAttribute("role", "region");
    d.setAttribute("aria-label", "Cookies");
    d.innerHTML = '<div class="ck-bar__in"><p class="ck-bar__t">Мы используем необходимые cookies для работы сайта и, с вашего согласия, Яндекс Метрику, чтобы понимать, что улучшить. Подробнее — в <a href="/cookies/">Политике cookies</a>.</p>' +
      '<div class="ck-bar__b"><button type="button" class="ck-bar__ok" data-ck="all">Принять</button>' +
      '<button type="button" class="ck-bar__no" data-ck="need">Только необходимые</button></div></div>';
    d.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ck]");
      if (!b) return;
      if (b.getAttribute("data-ck") === "all") window.dlkCookies.prinyat(); else window.dlkCookies.tolkoNuzhnye();
    });
    document.body.appendChild(d);
  }

  // на /cookies/ — текущий выбор и кнопки его поменять
  function obnovitStranicu() {
    var s = document.querySelector("[data-ck-status]");
    if (!s) return;
    var v = chitat();
    s.textContent = v === "all" ? "Вы разрешили Яндекс Метрику." : v === "need" ? "Вы выбрали только необходимые cookies — Метрика не загружается." : "Вы ещё не сделали выбор.";
  }

  // «из статьи в сервис»: клик из разбора (/115-fz/…, /nalogi/…) на инструмент
  var INSTRUMENTY = /^\/(|index\.html|skoraya-115-fz\/|nalichnye\/|kontragenty-iz-vypiski\/|proverit-schet\/|pasport\/|delopis\/|tarify\/|indeks\/)(\?|#|$)/;
  function izStati(e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || !/^\/(115-fz|nalogi)\/[^/]+\//.test(location.pathname)) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin === location.origin && INSTRUMENTY.test(u.pathname + (u.search ? "?" : ""))) {
      window.dlkGoal("article_to_tool", { statya: location.pathname, kuda: u.pathname });
    }
  }

  function start() {
    var v = chitat();
    if (v === "all") zagruzit();
    else if (!v) banner();
    document.addEventListener("click", izStati, true);
    document.querySelectorAll("[data-ck-set]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.getAttribute("data-ck-set") === "all") window.dlkCookies.prinyat(); else window.dlkCookies.tolkoNuzhnye();
      });
    });
    obnovitStranicu();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
