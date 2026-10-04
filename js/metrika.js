/* Делоскоп — Яндекс Метрика ТОЛЬКО с согласия (claude/ИП_правовой_пакет_v1.md, раздел 6).
   Счётчик 113083788, Вебвизор выключен. Код Метрики не загружается, пока человек не нажал «Принять»
   в баннере cookies; «Только необходимые» — не загружается. Выбор хранится в браузере 12 месяцев.
   Цели: window.dlkGoal("check_started" | "report_opened" | "invoice_created" | "registration" |
   "article_to_tool" | "whatsnew_open" | "pkg_view" | "pkg_cta" | "praktika_cta" |
   "entry_pay" | "entry_watch" | "entry_bank" | "shchit_start" | "shchit_sled", {параметры}) — без согласия ничего не отправляет.
   События дублируются в параметры визита `sobytie` — копятся и без заведённой цели (справка Метрики, visit-params-data).
   Ключи параметров — только из KLYUCHI; значения с 10+ цифрами подряд или «@» и значения из полей ввода не передаём.
   Просмотр отправляется вручную (init с defer: true + hit — справка Метрики «SPA-сайты»): в адресе и referer
   остаются только рекламные метки utm_*, yclid, ysclid, значения остальных параметров заменены на *.
   Если в адресе страницы 12 или 15 цифр подряд (ИНН ИП, ОГРНИП) — счётчик на этой странице не загружается вовсе:
   данные ИП в Метрику не уходят (152-ФЗ; claude/Продукт_metrika-v1.2_адрес_белый_список_МСП_04.10.md). */
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

  // Только служебные метки событий. Значения из полей ввода не передаём.
  var KLYUCHI = { kuda: 1, produkt: 1, statya: 1, sposob: 1, sost: 1, otkuda: 1, mesto: 1, vid: 1, stranica: 1,
    slug: 1, ocenka: 1, n: 1, kod: 1, inn_dlina: 1, beta: 1, otrasl: 1, tarif: 1, stupen: 1 };
  var PLOHO = /\d{10,}|@/; // ИНН, ОГРН(ИП), почта — в любом месте строки
  function chistye(p) {
    var o = {}, k, v;
    for (k in p) if (KLYUCHI[k] === 1 && Object.prototype.hasOwnProperty.call(p, k)) {
      v = p[k];
      if (typeof v === "number" || typeof v === "boolean") v = String(+v);
      if (typeof v !== "string") continue;
      v = v.split(/[?#]/)[0]; // у адресов — только путь
      if (PLOHO.test(v)) continue;
      o[k] = v.slice(0, 120);
    }
    return o;
  }

  // Адрес для Метрики: белый список рекламных меток, остальные значения → *; 12 и 15 цифр в пути → *
  var METKI = /^(utm_[a-z0-9_]+|yclid|ysclid)$/i;
  function adres(u) {
    var s = String(u || "").split("#")[0], i = s.indexOf("?");
    var put = (i < 0 ? s : s.slice(0, i)).replace(/\/(\d{12}|\d{15})(?=\/|$)/g, "/*");
    if (i < 0) return put;
    return put + "?" + s.slice(i + 1).split("&").map(function (p) {
      if (!p) return p;
      var j = p.indexOf("="), k = j < 0 ? p : p.slice(0, j);
      if (METKI.test(k) && !(/^utm_/i.test(k) && PLOHO.test(p.slice(j + 1)))) return p;
      return j < 0 ? "*" : k + "=*";
    }).join("&");
  }
  // ИНН ИП (12 цифр) или ОГРНИП (15 цифр) где-либо в адресе, кроме yclid/ysclid: цели и клики Метрика
  // подписывает адресом страницы, поэтому на такой странице счётчик не грузим совсем
  function lichnoe(u) {
    var s = String(u || "").replace(/([?&])(yclid|ysclid)=[^&#]*/gi, "$1");
    return /(^|\D)(\d{12}|\d{15})(?!\d)/.test(s);
  }

  function zagruzit() {
    if (zagruzhen) return;
    if (lichnoe(location.href) || lichnoe(document.referrer)) return;
    zagruzhen = true;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
    window.ym(ID, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false, defer: true });
    window.ym(ID, "hit", adres(location.href), { referer: adres(document.referrer), title: document.title });
  }

  window.dlkGoal = function (cel, params) {
    if (chitat() !== "all" || !zagruzhen || typeof window.ym !== "function") return;
    var p = chistye(params || {});
    try { window.ym(ID, "reachGoal", cel, p); } catch (e) {}
    try { var s = {}; s[cel] = Object.keys(p).length ? p : 1; window.ym(ID, "params", { sobytie: s }); } catch (e) {}
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
    d.innerHTML = '<div class="ck-bar__in"><p class="ck-bar__t"><span class="ck-bar__dl">Мы используем необходимые cookies для работы сайта и, с вашего согласия, Яндекс Метрику, чтобы понимать, что улучшить. Подробнее — в <a href="/cookies/">Политике cookies</a>.</span><span class="ck-bar__kr">Cookies — для работы сайта, Метрика — только с вашего согласия. <a href="/cookies/">Подробнее</a></span></p>' +
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

  // «Разбор дела» → одно действие: клик по кнопке тёмного блока .dl на /praktika/<раздел>/<slug>/ (SEO-обвязка [Маркетинга] 30.09)
  function izRazbora(e) {
    // главная → блок «Как решают суды» (glavnaya-v2): карточка разбора или «Все разборы»
    var g = location.pathname === "/" && e.target.closest && e.target.closest("#praktika a[href]");
    if (g) { window.dlkGoal("praktika_cta", { otkuda: "glavnaya", kuda: g.getAttribute("href") }); return; }
    var a = e.target.closest && e.target.closest(".pr .dl a[href]");
    var m = /^\/praktika\/[^/]+\/([^/]+)\//.exec(location.pathname);
    if (a && m) window.dlkGoal("praktika_cta", { slug: m[1], kuda: a.getAttribute("href") });
  }

  function start() {
    var v = chitat();
    if (v === "all") zagruzit();
    else if (!v) banner();
    document.addEventListener("click", izStati, true);
    document.addEventListener("click", izRazbora, true);
    // ссылка-кнопка с data-goal (например, главная кнопка статьи «ЗСК контрагента» → Паспорт): своя цель
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest && e.target.closest("a[data-goal]");
      if (a) window.dlkGoal(a.getAttribute("data-goal"), { statya: location.pathname, kuda: a.getAttribute("href") || "" });
    }, true);
    // форма с data-goal (например, проверка по ИНН под калькулятором) — цель с параметром otkuda
    document.addEventListener("submit", function (e) {
      var f = e.target && e.target.closest && e.target.closest("form[data-goal]");
      if (f) window.dlkGoal(f.getAttribute("data-goal"), { otkuda: f.getAttribute("data-otkuda") || "", statya: location.pathname, kuda: "/" });
    }, true);
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
