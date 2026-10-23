/* Делоскоп · пакет «yadro» — собран tests/sobrat_js.py из 6 файлов (partials/sborka.json). Правьте исходники, не этот файл. */
/* --- /js/shapka.js --- */
/* Делоскоп — поведение единой шапки (документ команды §1.4).
   Разметка — /partials/shapka.html, вставляет tests/sobrat_shapku.py. «Что нового» — /obnovleniya.js
   (окно открывается только по событию deloskop:whatsnew от кнопки в шапке). */
(function () {
  "use strict";
  // 0. Полоса «Открытая бета» (beta-v1; bez-dvusmyslennosti-v1.1 — 04.10.2026; beta-data-v1 — 09.10.2026).
  //    Дата конца беты — одно место: tarify.json → "beta_do"; сборщик пишет её в атрибут полосы data-beta-do
  //    (ТЗ [команда] 05.10, документ команды, разд. 1). Режим — data-beta-rezhim:
  //    a — дата есть (после конца дня по МСК инлайн-скрипт полосы сам ставит текст B — без выкладки в полночь);
  //    b — «Открытая бета продолжается…»; c — «Бета завершилась…», 7 дней, без крестика.
  //    Крестик прячет полосу на неделю, но в режиме a — не дольше конца беты: новость о тарифах должен увидеть каждый.
  //    Ключ «скрыть» — свой для каждой даты (dlk_beta_skryt_ГГГГ-ММ-ДД / _net): дату назначили или сменили —
  //    полосу снова видят все ([команда] 05.10 11:10, разд. 1, условие 2). Хранилище недоступно — просто прячем.
  //    Ссылка «Цена основателя» гаснет сама, когда все места заняты (п. 3.8 оферты; [команда] 04.10 10:15,
  //    пп. 3–4 ч. 3 ст. 5 38-ФЗ): GET /api/osnovatel {vsego, zanyato}. API молчит — ссылку не трогаем:
  //    место занимает только оплата, а в бете оплат нет.
  var NEDELYA = 7 * 24 * 3600 * 1000;
  var DEN = 24 * 3600 * 1000;
  // «2026-10-13» → начало 14.10 по МСК (конец последнего бесплатного дня); нет даты или она кривая — 0
  function konecDnya(d) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ""))) return 0;
    var t = Date.parse(d + "T00:00:00+03:00");
    return isNaN(t) ? 0 : t + DEN;
  }
  // Какой текст полосы показывать сейчас: то же, что делает инлайн-скрипт полосы (partials/beta.html).
  function rezhimSejchas(rezhim, d, seichas) {
    var k = konecDnya(d);
    if (rezhim === "a") return k && seichas >= k ? "b" : (k ? "a" : "b");
    if (rezhim === "c") return k && seichas >= k + NEDELYA ? "net" : "c";
    return "b";
  }
  function klyuch(d) { return "dlk_beta_skryt_" + (konecDnya(d) ? d : "net"); }
  function srokSkrytiya(seichas, konec) {
    return konec && konec > seichas ? Math.min(seichas + NEDELYA, konec) : seichas + NEDELYA;
  }
  function nadpisKrestika(seichas, konec) {
    return konec && konec > seichas && konec - seichas < NEDELYA ? "Скрыть до конца беты" : "Скрыть на неделю";
  }
  // Сроки в текстах страниц (<span data-beta-srok="ГГГГ-ММ-ДД"> по 13 октября</span>): день прошёл — span убираем,
  // «всё бесплатно по 13 октября» становится «всё бесплатно» (текст B без даты).
  function srokiSnyat(root, seichas) {
    var n = 0;
    if (!root || !root.querySelectorAll) return 0;
    Array.prototype.slice.call(root.querySelectorAll("[data-beta-srok]")).forEach(function (el) {
      var k = konecDnya(el.getAttribute("data-beta-srok"));
      if (k && seichas >= k && el.parentNode) { el.parentNode.removeChild(el); n++; }
    });
    return n;
  }
  function osnSsylka(j) {
    if (!j || typeof j.vsego !== "number" || typeof j.zanyato !== "number") return true;
    return j.zanyato < j.vsego;
  }
  function osnProverit(bar) {
    var a = bar.querySelector("[data-beta-osn]");
    if (!a || bar.hidden || typeof fetch !== "function") return;
    var ubrat = function () { a.parentNode && a.parentNode.removeChild(a); };
    try { if (sessionStorage.getItem("dlk_osn_net") === "1") { ubrat(); return; } } catch (e) {}
    var API = location.hostname && /deloskop\.ru$/.test(location.hostname) ? "https://api.deloskop.ru" : "";
    if (!API) return;
    fetch(API + "/api/osnovatel", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (osnSsylka(j)) return;
        ubrat();
        try { sessionStorage.setItem("dlk_osn_net", "1"); } catch (e) {}
      })
      .catch(function () {});
  }
  function betaPolosa() {
    try { srokiSnyat(document, Date.now()); } catch (e) {}
    var bar = document.querySelector("[data-beta-bar]");
    if (!bar) return;
    var d = bar.getAttribute("data-beta-do") || "";
    var x = bar.querySelector("[data-beta-x]");
    if (x) {
      var konec = bar.getAttribute("data-beta-rezhim") === "a" ? konecDnya(d) : 0;
      x.setAttribute("aria-label", nadpisKrestika(Date.now(), konec));
      x.addEventListener("click", function () {
        bar.hidden = true;
        try { localStorage.setItem(klyuch(d), String(srokSkrytiya(Date.now(), konec))); } catch (e) {}
        if (window.dlkGoal) window.dlkGoal("beta_bar_close");
      });
    }
    // beta-odna-stroka-v1: телефон — короткая строка (полный текст по нажатию), широкий экран — полный текст;
    // поворот планшета / смена ширины окна — тот же выбор, что сделал скрипт полосы при загрузке
    var det = bar.querySelector("[data-beta-d]");
    if (det && window.matchMedia) {
      var mq = window.matchMedia("(max-width:640px)");
      var smena = function () { det.open = !mq.matches; };
      if (mq.addEventListener) mq.addEventListener("change", smena); else if (mq.addListener) mq.addListener(smena);
      det.addEventListener("toggle", function () { if (det.open && mq.matches && window.dlkGoal) window.dlkGoal("beta_bar_open"); });
    }
    osnProverit(bar);
  }
  window.dlkBeta = { srokSkrytiya: srokSkrytiya, nadpisKrestika: nadpisKrestika, osnSsylka: osnSsylka, klyuch: klyuch,
    konecDnya: konecDnya, rezhimSejchas: rezhimSejchas, srokiSnyat: srokiSnyat };
  // 8. Типографика: номера дел, законов и писем не рвутся на переносе строки
  //    («А67-1408/2022», «304-ЭС23-9987», «115-ФЗ», «ММ-3-06/333@»). Текст не меняется —
  //    только обёртка <span class="nw"> (white-space:nowrap): копирование и поиск по номеру работают.
  //    Слова через дефис без цифр («из-за», «Северо-Запад») не трогаем. Модули, которые рисуют
  //    текст позже (отчёт, Паспорт), могут вызвать window.dlkNerazryv.obernut(узел).
  var NW_RE = /[0-9A-Za-z\u0410-\u044f\u0401\u0451]+(?:-[0-9A-Za-z\u0410-\u044f\u0401\u0451]+)+(?:\/[0-9A-Za-z\u0410-\u044f\u0401\u0451]+)*@?/g;
  var NW_SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|CODE|PRE|KBD|SAMP|NOSCRIPT|TEMPLATE|SVG|TITLE)$/i;
  function kuski(t) {
    // → [{t: текст, nw: bool}] или null, если оборачивать нечего
    var out = [], last = 0, m, est = false;
    NW_RE.lastIndex = 0;
    while ((m = NW_RE.exec(t))) {
      var w = m[0];
      if (!/[0-9]/.test(w) || w.length > 32) continue;
      if (m.index > last) out.push({ t: t.slice(last, m.index), nw: false });
      out.push({ t: w, nw: true }); est = true;
      last = m.index + w.length;
    }
    if (!est) return null;
    if (last < t.length) out.push({ t: t.slice(last), nw: false });
    return out;
  }
  function propusk(el) {
    for (; el && el.nodeType === 1; el = el.parentNode) {
      if (NW_SKIP.test(el.nodeName) || el.isContentEditable) return true;
      if (el.classList && (el.classList.contains("nw") || el.hasAttribute("data-nw-net"))) return true;
    }
    return false;
  }
  // Родитель — flex/grid (вопрос FAQ в <summary>, кнопки): каждый кусок текста стал бы отдельной
  // колонкой — вопрос распадается на три столбца, «+» уезжает за край экрана на 390 px.
  // Тогда куски кладём в одну строчную обёртку <span class="nw-k"> — для раскладки это один элемент.
  function vFlex(el) {
    try {
      var d = window.getComputedStyle && el && el.nodeType === 1 ? window.getComputedStyle(el).display : "";
      return /(^|-)(flex|grid)$/.test(d || "");
    } catch (e) { return false; }
  }
  function obernut(root) {
    root = root || document.body;
    if (!root || !document.createTreeWalker) return 0;
    var tw = document.createTreeWalker(root, 4, null), uzly = [], n;
    while ((n = tw.nextNode())) if (n.nodeValue.indexOf("-") >= 0 && /[0-9]/.test(n.nodeValue)) uzly.push(n);
    var k = 0;
    uzly.forEach(function (u) {
      if (propusk(u.parentNode)) return;
      var ch = kuski(u.nodeValue);
      if (!ch) return;
      var fr = document.createDocumentFragment();
      ch.forEach(function (c) {
        if (!c.nw) { fr.appendChild(document.createTextNode(c.t)); return; }
        var sp = document.createElement("span"); sp.className = "nw"; sp.textContent = c.t;
        fr.appendChild(sp); k++;
      });
      if (vFlex(u.parentNode)) {
        var ob = document.createElement("span"); ob.className = "nw-k";
        ob.appendChild(fr); fr = ob;
      }
      u.parentNode.replaceChild(fr, u);
    });
    return k;
  }
  window.dlkNerazryv = { kuski: kuski, obernut: obernut, vFlex: vFlex };

  function init() {
    var h = document.querySelector("[data-shapka]");
    betaPolosa();
    try { obernut(document.querySelector("main") || document.body); } catch (e) {}
    if (!h) return;
    var path = location.pathname;
    var m = document.getElementById("mnav");

    // 1. Активный пункт: в исходнике его нет — блок одинаковый на всех страницах
    document.querySelectorAll("[data-match]").forEach(function (el) {
      try { if (new RegExp(el.getAttribute("data-match")).test(path)) el.classList.add("is-active"); } catch (e) {}
    });
    document.querySelectorAll(".shapka a[href], .mnav a[href]").forEach(function (a) {
      var href = a.getAttribute("href");
      if (href === path || (path === "/index.html" && href === "/")) a.setAttribute("aria-current", "page");
    });

    // 2. Линия снизу после прокрутки > 8 px
    function onScroll() { h.classList.toggle("is-scrolled", window.scrollY > 8); }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // 3. Выпадающие «Выписка» и «115-ФЗ» — кнопка-раскрывашка
    var dds = Array.prototype.slice.call(h.querySelectorAll(".shapka__dd"));
    var hover = window.matchMedia && matchMedia("(hover:hover) and (pointer:fine)").matches;
    function btnOf(dd) { return dd.querySelector("button"); }
    function close(dd, focus) { dd.classList.remove("is-open"); btnOf(dd).setAttribute("aria-expanded", "false"); if (focus) btnOf(dd).focus(); }
    function open(dd) { dds.forEach(function (o) { if (o !== dd) close(o); }); dd.classList.add("is-open"); btnOf(dd).setAttribute("aria-expanded", "true"); }
    dds.forEach(function (dd) {
      var b = btnOf(dd), t, byHover = false;
      b.addEventListener("click", function () {
        var isOpen = dd.classList.contains("is-open");
        if (isOpen && !byHover) close(dd); else open(dd);
        byHover = false;
      });
      b.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") { e.preventDefault(); open(dd); dd.querySelector(".shapka__menu a").focus(); }
      });
      if (hover) {
        dd.addEventListener("mouseenter", function () { clearTimeout(t); if (!dd.classList.contains("is-open")) { byHover = true; open(dd); } });
        dd.addEventListener("mouseleave", function () { t = setTimeout(function () { close(dd); byHover = false; }, 150); });
      }
      dd.addEventListener("focusout", function (e) { if (!dd.contains(e.relatedTarget)) close(dd); });
      dd.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && dd.classList.contains("is-open")) { e.stopPropagation(); close(dd, true); }
        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && e.target.closest(".shapka__menu")) {
          e.preventDefault();
          var l = Array.prototype.slice.call(dd.querySelectorAll(".shapka__menu a")), i = l.indexOf(e.target);
          l[(i + (e.key === "ArrowDown" ? 1 : -1) + l.length) % l.length].focus();
        }
      });
    });
    document.addEventListener("click", function (e) { dds.forEach(function (dd) { if (!dd.contains(e.target)) close(dd); }); });

    // 4. Мобильное меню ≤ 1024 px: <dialog> + showModal() — фон инертен, фокус внутри, Esc закрывает
    var burger = h.querySelector(".shapka__burger");
    if (m && burger && m.showModal) {
      var shut = function () { if (m.open) m.close(); };
      burger.addEventListener("click", function () {
        m.showModal(); burger.setAttribute("aria-expanded", "true"); document.documentElement.classList.add("is-locked");
      });
      m.addEventListener("close", function () {
        burger.setAttribute("aria-expanded", "false"); document.documentElement.classList.remove("is-locked"); burger.focus();
      });
      m.addEventListener("click", function (e) {
        if (e.target === m || e.target.closest("[data-close]") || e.target.closest("a")) shut();
      });
      if (window.matchMedia) {
        var mq = matchMedia("(min-width:1025px)");
        var f = function (e) { if (e.matches) shut(); };
        if (mq.addEventListener) mq.addEventListener("change", f); else if (mq.addListener) mq.addListener(f);
      }
    }

    // 5. «Что нового» — только по клику; точку, счётчик, полосу и окно ведёт /obnovleniya.js
    document.querySelectorAll("[data-whatsnew]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (m && m.open) m.close();
        window.dispatchEvent(new CustomEvent("deloskop:whatsnew", { detail: { opener: b } }));
      });
    });

    // 6. «Войти» / «Кабинет»: кабинет ставит dlk_voshel=1 после входа и снимает при выходе
    var authed = false;
    try { authed = localStorage.getItem("dlk_voshel") === "1"; } catch (e) {}
    if (authed) {
      document.querySelectorAll("[data-auth-out]").forEach(function (a) { a.hidden = true; });
      document.querySelectorAll("[data-auth-in]").forEach(function (a) { a.hidden = false; });
    }

    // 7. «Проверить» на главной — не перезагружать, а поставить фокус в поле ИНН
    document.querySelectorAll("[data-check]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        var fld = document.getElementById("inn");
        if (fld && (path === "/" || path === "/index.html")) {
          e.preventDefault();
          if (m && m.open) m.close();
          fld.focus({ preventScroll: true });
          fld.scrollIntoView({ block: "center" });
        }
      });
    });

    // 8. vizual-v3.0b: тема — «Тёмная / Светлая / Как в системе» в подвале. Строка в <head> уже поставила
    // data-theme до отрисовки; здесь — выбор, запоминание (localStorage «tema») и смена темы системы на лету.
    // с 18.10 по умолчанию — тёмная; «Как в системе» — отдельный выбор.
    tema();
  }

  function tema() {
    var root = document.documentElement, mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
    var vybor = function () { var v = null; try { v = localStorage.getItem("tema"); } catch (e) {} return v === "light" || v === "auto" ? v : "dark"; };
    var primenit = function () {
      var v = vybor(), t = v === "auto" ? (mq && mq.matches ? "dark" : "light") : v;
      root.dataset.theme = t;
      var m = document.querySelector('meta[name="theme-color"]');
      if (m) m.content = t === "dark" ? "#111113" : "#F5F5F2";
      document.querySelectorAll("[data-tema-v]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-tema-v") === v)); });
      document.querySelectorAll("[data-tema-knopka]").forEach(function (b) { b.setAttribute("aria-label", t === "dark" ? "Включить светлую тему" : "Включить тёмную тему"); });
      nebo(t);
    };
    // nebo-v1: «живое небо» — только в тёмной теме и только после load (пакет js/b/nebo.*, адрес — у кнопки темы в шапке);
    // светлая — небо гаснет и уходит со страницы (js/nebo.js)
    var neboZhdu = false;
    var nebo = function (t) {
      if (window.DlkNebo) { if (t === "dark") window.DlkNebo.vkl(); else window.DlkNebo.vykl(); return; }
      if (t !== "dark" || neboZhdu) return;
      var kn = document.querySelector("[data-nebo-src]"), src = kn && kn.getAttribute("data-nebo-src");
      if (!src) return;
      neboZhdu = true;
      var gruzit = function () { var s = document.createElement("script"); s.src = src; s.async = true; document.head.appendChild(s); };
      if (document.readyState === "complete") setTimeout(gruzit, 0); else window.addEventListener("load", function () { setTimeout(gruzit, 0); }, { once: true });
    };
    // zhivoj-v1: новая тема раскрывается кругом от нажатой кнопки (View Transitions одного документа; css — partials/shapka.css).
    // Круг растёт у снимка новой страницы, старая под ним неподвижна; 520 мс, та же кривая, что у переходов страниц.
    // «Уменьшить движение», вкладка в фоне, нет поддержки, тема не меняется (тот же выбор) — сразу, как раньше.
    var tishe = function () { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); };
    var ikonka = 0;
    var smena = function (el, v) {
      try { localStorage.setItem("tema", v); } catch (er) {}
      var budet = v === "auto" ? (mq && mq.matches ? "dark" : "light") : v;
      if (budet === root.dataset.theme) { primenit(); return; }
      // иконка солнца/луны входит поворотом — класс ставим вместе с новой темой (в снимок старой страницы он не попадает)
      var delo = function () {
        if (!tishe()) { root.classList.add("tema-ik"); clearTimeout(ikonka); ikonka = setTimeout(function () { root.classList.remove("tema-ik"); }, 600); }
        primenit();
      };
      if (!document.startViewTransition || tishe() || document.visibilityState === "hidden" || !el || !root.animate) { delo(); return; }
      var r = el.getBoundingClientRect(), x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
      var R = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)));
      var konec = function () { root.classList.remove("tema-vt"); };
      root.classList.add("tema-vt");
      var vt;
      try { vt = document.startViewTransition(delo); } catch (er) { konec(); delo(); return; }
      vt.ready.then(function () {
        root.animate({ clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + R + "px at " + x + "px " + y + "px)"] },
          { duration: 520, easing: "cubic-bezier(.2,.7,.2,1)", pseudoElement: "::view-transition-new(root)" });
      }).catch(function () {});
      vt.finished.then(konec, konec);
    };
    // кнопка в шапке: тёмная ↔ светлая одним нажатием (выбор запоминается, как и в подвале)
    document.querySelectorAll("[data-tema-knopka]").forEach(function (b) {
      b.addEventListener("click", function () {
        smena(b, root.dataset.theme === "dark" ? "light" : "dark");
      });
    });
    document.querySelectorAll("[data-tema]").forEach(function (blok) {
      blok.hidden = false;
      blok.addEventListener("click", function (e) {
        var b = e.target.closest("[data-tema-v]"); if (!b) return;
        smena(b, b.getAttribute("data-tema-v"));
      });
    });
    if (mq) { var sl = function () { if (vybor() === "auto") primenit(); }; if (mq.addEventListener) mq.addEventListener("change", sl); else if (mq.addListener) mq.addListener(sl); }
    window.addEventListener("storage", function (e) { if (e.key === "tema") primenit(); });
    primenit();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

/* §9. vizual-v3.1b (г): переходы между страницами — какой заголовок с каким связать (css: partials/shapka.css).
   CSS даёт заголовку <h1> новой страницы имя dlk-zag; здесь, на уходящей странице, решаем, что переедет на его место:
   — список → карточка, раздел → статья: видимая на экране ссылка, по которой ушли (название переезжает в заголовок);
   — статья → статья, карточка → карточка: заголовок старой страницы;
   — с витрины главной (vitrina-v1): ссылка экспоната с data-vt, по которой нажали, — его название переезжает в заголовок
     страницы продукта;
   — всё прочее: ничего — новая страница просто проявляется. Нет поддержки — событий нет, всё как раньше. */
(function () {
  "use strict";
  function semya(p) {
    if (/^\/company\//.test(p)) return "company";
    if (/^\/(115-fz|nalogi|praktika)\//.test(p)) return "statya";
    return "";
  }
  // list(p) — раздел или список (у него нет «своего» заголовка, который стоит переносить)
  function spisok(p) {
    return /^\/(?:115-fz|nalogi|praktika|praktika\/115-fz|praktika\/nalogi)\/$/.test(p) || (/^\/company\//.test(p) && !/^\/company\/\d{10}(?:\d{2})?-[^/]+\/$/.test(p));
  }
  function para(s, n) {
    var a = semya(s);
    if (!a || a !== semya(n) || s === n || spisok(n)) return "";
    return spisok(s) ? "ssylka" : "zagolovok";
  }
  function ssylkaNa(url) {
    var vse = document.querySelectorAll("a[href]"), h = innerHeight || 0;
    for (var i = 0; i < vse.length; i++) {
      var a = vse[i];
      if (a.href.split("#")[0] !== url) continue;
      var r = a.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < h) return a;
    }
    return null;
  }
  var nazvannye = [], nazhata = null;
  // ссылка витрины, по которой ушли (pageswap не знает, по чему нажали)
  if (typeof addEventListener === "function") addEventListener("click", function (e) {
    var t = e.target;
    nazhata = t && t.closest ? t.closest("a[data-vt]") : null;
  }, true);
  function vidna(a) {
    var r = a.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < (innerHeight || 0);
  }
  function snyat() { nazvannye.forEach(function (e) { e.style.viewTransitionName = ""; }); nazvannye = []; }
  function imya(e, v) { e.style.viewTransitionName = v; nazvannye.push(e); }
  if (typeof module === "object" && module.exports) module.exports = { para: para, semya: semya, spisok: spisok };
  if (typeof addEventListener !== "function") return;
  addEventListener("pageswap", function (e) {
    snyat();
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    var kuda;
    try { kuda = new URL(e.activation.entry.url); } catch (er) { return; }
    if (kuda.origin !== location.origin) return;
    var vid = para(location.pathname, kuda.pathname), h1 = document.querySelectorAll("h1"), a = null;
    if (vid === "ssylka") a = ssylkaNa(kuda.href.split("#")[0]);
    else if (!vid && nazhata && nazhata.href.split("#")[0] === kuda.href.split("#")[0] && vidna(nazhata)) a = nazhata;
    nazhata = null;
    // заголовок старой страницы остаётся с именем, только если он и переезжает (и он один)
    for (var i = 0; i < h1.length; i++) if (!(vid === "zagolovok" && i === 0)) imya(h1[i], "none");
    if (a) imya(a, "dlk-zag");
  });
  // страница вернулась из кэша «Назад» — имена, поставленные перед уходом, снимаем
  addEventListener("pageshow", function (e) { if (e.persisted) snyat(); });
})();

/* §10. zhivoj-v1: кнопки отвечают на нажатие — чуть вдавливаются под пальцем и мягко возвращаются (с лёгким «отскоком»).
   Только свойство scale через Web Animations: не трогает transform и transition страниц (магнит кнопки, переворот, сцены),
   работает поверх них. Крупные блоки (шире 480 px или выше 120 px) не вдавливаем. «Уменьшить движение», нет поддержки — как было. */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined" || !window.Element || !Element.prototype.animate || !window.matchMedia || !CSS.supports || !CSS.supports("scale", "1")) return;
  var tiho = matchMedia("(prefers-reduced-motion: reduce)");
  var SEL = "button,.btn,a.shapka__btn,a.vit-btn,[role=tab],[role=button]";
  var ease = "cubic-bezier(.2,.7,.2,1)";
  var el = null, nazh = null;
  function otpusk() {
    if (!el) return;
    var e = el; el = null;
    if (nazh) { nazh.cancel(); nazh = null; }
    e.animate([{ scale: 0.96 }, { scale: 1.015, offset: 0.55 }, { scale: 1 }], { duration: 280, easing: ease });
  }
  document.addEventListener("pointerdown", function (ev) {
    if (tiho.matches || ev.button > 0 || !ev.isPrimary) return;
    var t = ev.target && ev.target.closest ? ev.target.closest(SEL) : null;
    if (!t || t.disabled || t.getAttribute("aria-disabled") === "true" || t.closest("[data-bez-nazhatiya]")) return;
    var r = t.getBoundingClientRect();
    if (r.width > 480 || r.height > 120 || !r.width) return;
    otpusk();
    el = t;
    nazh = t.animate([{ scale: 1 }, { scale: 0.96 }], { duration: 110, easing: ease, fill: "forwards" });
  }, { passive: true });
  ["pointerup", "pointercancel", "dragstart"].forEach(function (n) { document.addEventListener(n, otpusk, { passive: true }); });
  document.addEventListener("pointerout", function (ev) { if (el && ev.target === el && !el.contains(ev.relatedTarget)) otpusk(); }, { passive: true });
})();
;
/* --- /js/metrika.js --- */
/* Делоскоп — Яндекс Метрика ТОЛЬКО с согласия (документ команды, раздел 6).
   Счётчик 113083788, Вебвизор выключен. Код Метрики не загружается, пока человек не нажал «Принять»
   в баннере cookies; «Только необходимые» — не загружается. Выбор хранится в браузере 12 месяцев.
   Цели: window.dlkGoal("check_started" | "report_opened" | "invoice_created" | "registration" |
   "article_to_tool" | "whatsnew_open" | "pkg_view" | "pkg_cta" | "praktika_cta" |
   "entry_pay" | "entry_watch" | "entry_bank" | "shchit_start" | "shchit_sled" |
   "schet_zapros" | "schet_buhgalteru" | "schet_oplachen", {параметры}) — без согласия ничего не отправляет.
   События дублируются в параметры визита `sobytie` — копятся и без заведённой цели (справка Метрики, visit-params-data).
   Ключи параметров — только из KLYUCHI; значения с 10+ цифрами подряд или «@» и значения из полей ввода не передаём.
   Просмотр отправляется вручную (init с defer: true + hit — справка Метрики «SPA-сайты»): в адресе и referer
   остаются только рекламные метки utm_*, yclid, ysclid, значения остальных параметров заменены на *.
   Если в адресе страницы 12 или 15 цифр подряд (ИНН ИП, ОГРНИП) — счётчик на этой странице не загружается вовсе:
   данные ИП в Метрику не уходят (152-ФЗ; документ команды). */
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
    slug: 1, ocenka: 1, n: 1, kod: 1, inn_dlina: 1, beta: 1, otrasl: 1, tarif: 1, stupen: 1, tema: 1 };
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
    d.innerHTML = '<div class="ck-bar__in"><p class="ck-bar__t"><span class="ck-bar__dl">Мы используем необходимые cookies для работы сайта и, с\u00a0вашего согласия, Яндекс Метрику, чтобы понимать, что улучшить. Подробнее\u00a0— в\u00a0<a href="/cookies/">Политике cookies</a>.</span><span class="ck-bar__kr">Cookies\u00a0— для работы сайта, Метрика\u00a0— только с\u00a0вашего согласия. <a href="/cookies/">Подробнее</a></span></p>' +
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
  function zapusk() {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
  // vizual-v3.0a: страницу, которую браузер открыл заранее (Speculation Rules, prerender), человек ещё не видел —
  // ни баннера, ни Метрики, пока она не показана (событие prerenderingchange); иначе просмотр без посетителя
  if (document.prerendering) document.addEventListener("prerenderingchange", zapusk, { once: true });
  else zapusk();
})();
;
/* --- /js/kopiya.js --- */
/* Делоскоп — подпись-источник при копировании текста (kopiya-v1, решение команды 01.10.2026).
   Человек копирует со страницы длинный кусок статьи, разбора или карточки → в буфер, кроме самого текста,
   ложится строка «Источник: <адрес страницы> — Делоскоп, deloskop.ru · делоскоп.рф» (и в HTML — две ссылки).
   Копирование НЕ мешаем: ничего не блокируем, выделение не трогаем, только добавляем подпись.
   Без подписи: меньше MIN знаков; поля ввода и формы; кабинет, админка, счёт и акт;
   готовые документы человека (договор Делописи, письмо Скорой); блоки .no-src / [data-no-src];
   кнопки «Копировать» ([data-copy], [data-copy2]); реквизиты (ИНН, КПП, БИК, р/с — их копируют, чтобы платить).
   Адрес — из <link rel="canonical"> (без ?inn= и меток), иначе адрес страницы без запроса и якоря.
   Подключает tests/sobrat_shapku.py на всех страницах (<head>, defer). Чистые функции — для tests/kopiya.test.js. */
(function (koren) {
  "use strict";
  var MIN = 120;
  var DOMEN_RF = "делоскоп.рф";
  var URL_RF = "https://делоскоп.рф";
  // кабинет, админка, счёт и акт (/schet/…) — служебное и платёжное, подпись там не нужна
  var ISKL_PUTI = /^\/(cabinet|admin|schet)(\.html)?(\/|$)/;
  // Готовые документы человека — договор Делописи (#dp-doc, #dp-out) и письмо в банк Скорой (.letter):
  // их вставляют в свой договор или письмо, чужая строка там лишняя
  var ISKL_BLOKI = "input, textarea, select, [contenteditable=''], [contenteditable='true'], form, .no-src, [data-no-src], " +
    "[data-copy], [data-copy2], button, #dp-doc, #dp-out, .letter";

  function dlina(t) { return String(t || "").replace(/\s+/g, " ").trim().length; }

  // Реквизиты: два и больше признаков — это платёжные данные, а не текст статьи
  function rekvizity(t) {
    var s = String(t || ""), n = 0;
    if (/ИНН\s*:?\s*\d{10,12}/i.test(s)) n++;
    if (/КПП\s*:?\s*\d{9}/i.test(s)) n++;
    if (/БИК\s*:?\s*\d{9}/i.test(s)) n++;
    if (/ОГРН(ИП)?\s*:?\s*\d{13,15}/i.test(s)) n++;
    if (/(р\/с|расч[её]тный сч[её]т|к\/с|корр?\.?\s*сч[её]т)[^\d]{0,20}\d{20}/i.test(s) || /\b\d{20}\b/.test(s)) n++;
    return n >= 2;
  }

  // kontekst: { put, vIsklyuchenii }  → true, если подпись нужна
  function nuzhnaPodpis(tekst, kontekst) {
    var k = kontekst || {};
    if (k.put && ISKL_PUTI.test(k.put)) return false;
    if (k.vIsklyuchenii) return false;
    if (dlina(tekst) < MIN) return false;
    if (rekvizity(tekst)) return false;
    return true;
  }

  function ekran(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function adres(kanon, href) {
    var u = kanon || href || "https://deloskop.ru/";
    return String(u).replace(/[?#].*$/, "");
  }

  function podpis(url) {
    var u = adres(url);
    return {
      text: "\n\nИсточник: " + u + " — Делоскоп, deloskop.ru · " + DOMEN_RF,
      html: '<p>Источник: <a href="' + ekran(u) + '">deloskop.ru</a> · <a href="' + URL_RF + '">' + DOMEN_RF + "</a></p>"
    };
  }

  function sobrat(tekst, htmlKusok, url) {
    var p = podpis(url);
    var h = htmlKusok != null && htmlKusok !== "" ? htmlKusok : ekran(tekst).replace(/\n/g, "<br>");
    return { text: String(tekst) + p.text, html: "<div>" + h + "</div>" + p.html };
  }

  var api = { MIN: MIN, nuzhnaPodpis: nuzhnaPodpis, rekvizity: rekvizity, podpis: podpis, sobrat: sobrat, adres: adres, ISKL_BLOKI: ISKL_BLOKI };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }
  koren.dlkKopiya = api;

  // ——— браузер ———
  function blizhajshij(uzel, sel) {
    var el = uzel && (uzel.nodeType === 1 ? uzel : uzel.parentElement);
    return !!(el && el.closest && el.closest(sel));
  }
  function naCopy(e) {
    try {
      if (e.defaultPrevented || !e.clipboardData) return;
      var vyd = window.getSelection && window.getSelection();
      if (!vyd || vyd.isCollapsed || !vyd.rangeCount) return;
      // выделение в поле ввода (фокус) или начало/конец выделения внутри исключённого блока.
      // Кнопку в фокусе (нажали «Собрать договор», потом выделили статью) не считаем — смотрим само выделение
      var akt = document.activeElement;
      var vIskl = !!(akt && /^(INPUT|TEXTAREA|SELECT)$/.test(akt.tagName)) || !!(akt && akt.isContentEditable) ||
        blizhajshij(vyd.anchorNode, ISKL_BLOKI) || blizhajshij(vyd.focusNode, ISKL_BLOKI);
      var tekst = vyd.toString();
      if (!nuzhnaPodpis(tekst, { put: location.pathname, vIsklyuchenii: vIskl })) return;
      var div = document.createElement("div");
      for (var i = 0; i < vyd.rangeCount; i++) div.appendChild(vyd.getRangeAt(i).cloneContents());
      // ссылки внутри кусков — полными адресами: «/nalogi/» в чужом письме никуда не ведёт
      var ss = div.querySelectorAll ? div.querySelectorAll("a[href]") : [];
      for (var j = 0; j < ss.length; j++) { try { ss[j].setAttribute("href", new URL(ss[j].getAttribute("href"), location.href).href); } catch (_) {} }
      var kan = document.querySelector('link[rel="canonical"]');
      var itog = sobrat(tekst, div.innerHTML, adres(kan && kan.href, location.origin + location.pathname));
      e.clipboardData.setData("text/plain", itog.text);
      e.clipboardData.setData("text/html", itog.html);
      e.preventDefault(); // иначе браузер перезапишет буфер исходным выделением — само копирование уже сделано выше
    } catch (_) { /* что-то пошло не так — браузер скопирует как обычно */ }
  }
  document.addEventListener("copy", naCopy);
})(this);
;
/* --- /js/pwa.js --- */
/* Делоскоп — приложение на телефоне (pwa-v1, 12.10.2026).
   1) Регистрирует /sw.js (оболочка и экран «Нет сети»; ответы API не кэшируются — см. sw.js).
   2) Тихая подсказка «Установить» (Android, Chrome/Яндекс Браузер — событие beforeinstallprompt)
      и «На экран Домой» (iPhone/iPad, Safari). Правила: не на первой странице визита, не раньше 5 секунд,
      не в установленном приложении, не в админке, не чаще раза в 14 дней (после «Не сейчас» или показа).
   Цели Метрики (только с согласия — js/metrika.js): pwa_pokaz, pwa_ustanovit, pwa_ustanovleno, {vid}. */
(function (w, d) {
  'use strict';
  var KEY = 'dlk_pwa';           // {t: время последнего показа, ok: установлено}
  var SCHET = 'dlk_pwa_str';     // просмотры страниц в этом визите
  var PAUZA = 14 * 864e5;
  var n = w.navigator;

  if ('serviceWorker' in n && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    w.addEventListener('load', function () { n.serviceWorker.register('/sw.js').catch(function () {}); });
  }

  function chitat() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function zapisat(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function cel(imya, vid) { try { if (w.dlkGoal) w.dlkGoal(imya, { vid: vid }); } catch (e) {} }

  // pwa-v1.1: внутри приложения Делоскопа для Android/iPhone (User-Agent «DeloskopApp/…» или мост Capacitor) — подсказки нет
  var vPrilozhenii = /DeloskopApp\//.test(n.userAgent || '') || !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform());
  if (vPrilozhenii) { try { d.documentElement.setAttribute('data-prilozhenie', '1'); } catch (e) {} }
  var ustanovleno = vPrilozhenii || (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) || n.standalone === true;
  if (ustanovleno || /^\/admin/.test(location.pathname)) return;

  var str = 0;
  try { str = (+sessionStorage.getItem(SCHET) || 0) + 1; sessionStorage.setItem(SCHET, String(str)); } catch (e) {}

  function mozhno() {
    var s = chitat();
    if (s.ok) return false;
    if (s.t && Date.now() - s.t < PAUZA) return false;
    if (str < 2) return false;
    var ck = d.querySelector('.ck-bar'); // сначала человек отвечает про cookies — две плашки разом не показываем
    return !(ck && !ck.hidden && ck.offsetParent !== null);
  }

  var ua = n.userAgent || '';
  var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && n.maxTouchPoints > 1);
  var safari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|YaBrowser|OPiOS/.test(ua);
  var otlozhennoe = null;

  function stil() {
    if (d.getElementById('pwa-stil')) return;
    var s = d.createElement('style');
    s.id = 'pwa-stil';
    s.textContent =
      '.pwa{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:900;max-width:480px;margin:0 auto;' +
      'display:flex;gap:14px;align-items:flex-start;padding:16px 16px 16px 18px;background:var(--surface,#fff);color:var(--ink,#1D1D1F);' +
      'border-radius:28px;box-shadow:0 1px 2px rgba(29,29,31,.04),0 12px 32px rgba(29,29,31,.12);font:400 15px/1.45 var(--font,Onest,-apple-system,Roboto,Arial,sans-serif);' +
      'transform:translateY(16px);opacity:0;transition:transform 240ms cubic-bezier(.2,.7,.2,1),opacity 240ms}' +
      '.pwa--on{transform:none;opacity:1}' +
      '.pwa__ik{flex:none;width:44px;height:44px;border-radius:10px}' +
      '.pwa__t{flex:1;min-width:0}.pwa__t b{display:block;font-weight:600;font-size:17px;margin-bottom:2px}' +
      '.pwa__t p{margin:0;color:var(--ink-2,#48484C)}' +
      '.pwa__kn{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}' +
      '.pwa__da{min-height:44px;padding:0 18px;border:0;border-radius:999px;background:var(--accent,#0B63E5);color:#fff;font-weight:600;font-size:15px;line-height:1;font-family:inherit;cursor:pointer}' +
      '.pwa__da:hover{background:var(--accent-hover,#084BB0)}' +
      '.pwa__net{min-height:44px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:var(--accent,#0B63E5);font-weight:600;font-size:15px;line-height:1;font-family:inherit;cursor:pointer}' +
      '.pwa__x{flex:none;width:44px;height:44px;margin:-10px -10px 0 0;border:0;border-radius:50%;background:transparent;color:var(--muted,#6B6B70);cursor:pointer;display:grid;place-items:center}' +
      '.pwa__sh{display:inline-block;width:16px;height:16px;vertical-align:-2px;margin:0 2px}' +
      '@media (prefers-reduced-motion:reduce){.pwa{transition:none}}';
    d.head.appendChild(s);
  }

  var SHARE = '<svg class="pwa__sh" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function pokazat(vid) {
    if (d.querySelector('.pwa')) return;
    stil();
    var el = d.createElement('div');
    el.className = 'pwa';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Делоскоп на экране телефона');
    var tekst = vid === 'ios'
      ? '<b>Делоскоп на экране «Домой»</b><p>Нажмите ' + SHARE + '«Поделиться» внизу Safari, затем «На экран „Домой“». Проверка по&nbsp;ИНН&nbsp;— в&nbsp;одно касание.</p>'
      : '<b>Делоскоп на экране телефона</b><p>Проверка по&nbsp;ИНН в&nbsp;одно касание, работает и&nbsp;при плохой сети.</p>' +
        '<div class="pwa__kn"><button class="pwa__da" type="button">Установить</button><button class="pwa__net" type="button">Не сейчас</button></div>';
    el.innerHTML = '<img class="pwa__ik" src="/apple-touch-icon.png" alt="" width="44" height="44"><div class="pwa__t">' + tekst + '</div>' +
      (vid !== 'ios' ? '' : '<button class="pwa__x" type="button" aria-label="Скрыть на 14 дней"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>');
    d.body.appendChild(el);
    zapisat({ t: Date.now() });
    cel('pwa_pokaz', vid);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('pwa--on'); }); });

    function ubrat() { el.classList.remove('pwa--on'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260); }
    var x = el.querySelector('.pwa__x');
    if (x) x.onclick = ubrat;
    var net = el.querySelector('.pwa__net');
    if (net) net.onclick = ubrat;
    var da = el.querySelector('.pwa__da');
    if (da) da.onclick = function () {
      cel('pwa_ustanovit', vid);
      ubrat();
      if (!otlozhennoe) return;
      otlozhennoe.prompt();
      otlozhennoe.userChoice.then(function (r) { if (r && r.outcome === 'accepted') zapisat({ t: Date.now(), ok: 1 }); }).catch(function () {});
      otlozhennoe = null;
    };
    d.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { ubrat(); d.removeEventListener('keydown', esc); } });
  }

  function pozzhe(vid) { setTimeout(function () { if (mozhno()) pokazat(vid); }, 5000); }

  w.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); // своя тихая подсказка вместо системной полосы
    otlozhennoe = e;
    var grubyj = w.matchMedia && w.matchMedia('(pointer: coarse)').matches;
    if (grubyj) pozzhe('android');
  });
  w.addEventListener('appinstalled', function () {
    zapisat({ t: Date.now(), ok: 1 });
    cel('pwa_ustanovleno', ios ? 'ios' : 'android');
    var el = d.querySelector('.pwa');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });
  if (safari) {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { pozzhe('ios'); });
    else pozzhe('ios');
  }
  w.DlkPwa = { pokazat: pokazat, mozhno: mozhno }; // для проверок
})(window, document);
;
/* --- /obnovleniya.js --- */
/* Делоскоп — лента «Что нового» (документ команды).
   Окно САМО НЕ ОТКРЫВАЕТСЯ (решение команды 26.09): оно закрывало поле ИНН у клиентов.
   Вместо него: синяя точка и счётчик у пункта «Что нового» в шапке + тонкая полоса под шапкой.
   Окно — только по кнопке в шапке (событие deloskop:whatsnew) или по ссылке с ?obnovleniya.
   Прочитанным считается последнее обновление, которое человек открыл или скрыл. Данные: /obnovleniya.json */
(function () {
  "use strict";
  var KEY = "deloskop_obnovlenie_videl";
  var NA_LENTE = location.pathname.indexOf("/obnovleniya") === 0;
  var list = [];

  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Типографика ленты — как tests/tipograf_statej.py (tekst): короткие слова, числа, тире, «115-ФЗ». Без (?<!) — старые iOS.
  function tipo(s){var B=/[0-9A-Za-zЀ-ӿ_&#-]/,P=/[0-9A-Za-zЀ-ӿ_-]/;
    function pered(re){return function(m,w,o,x){return o&&re.test(x.charAt(o-1))?m:w+"\u00a0";};}
    return String(s).replace(/(\d) (?=\d{3}(?![0-9A-Za-zЀ-ӿ_]))/g,"$1\u00a0")
      .replace(/(\d) (?=₽|%|млн|млрд|тыс|рабоч|дн|месяц|год|лет|час|минут)/g,"$1\u00a0")
      .replace(/ (?=—)/g,"\u00a0")
      .replace(/(пп?\.|ст\.|ч\.|№) /g,pered(P))
      .replace(/(в|и|а|к|с|у|о|я|по|на|не|до|от|за|из|ни|но|же|ли|без|для|под|над|при|про|со|об|во|мы|вы|он|её|ее|их|ей|им) /gi,pered(B))
      .replace(/(\d)-(?=ФЗ(?![0-9A-Za-zЀ-ӿ_]))/g,"$1\u2011");}
  // detali-v1: та же типографика для текста, который рисуют скрипты (например, «Условия сделки» в отчёте):
  // DlkTipo.uzly(el) проходит текстовые узлы внутри el (кроме полей ввода, кода и скриптов).
  window.DlkTipo = { tekst: tipo, uzly: function (el) {
    if (!el || !document.createTreeWalker) return;
    var w = document.createTreeWalker(el, 4), n, ne = /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE|OPTION)$/;
    while ((n = w.nextNode())) { if (n.parentNode && !ne.test(n.parentNode.nodeName) && / /.test(n.nodeValue)) { var v = tipo(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } }
  } };
  var MES = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  function denMes(u) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(u.id || "");
    return m ? (+m[3]) + " " + MES[+m[2] - 1] : esc(u.data);
  }
  // сколько записей новее прочитанной (новые — сверху); первый визит — одна, последняя
  function neprochitano() {
    if (!list.length) return 0;
    var s = get();
    if (!s) return 1;
    for (var i = 0; i < list.length; i++) if (list[i].id === s) return i;
    return 1;
  }
  function prochital() {
    if (list[0]) set(list[0].id);
    obnovit();
  }

  function obnovit() {
    var n = neprochitano();
    document.querySelectorAll("[data-whatsnew-dot]").forEach(function (d) {
      var estSchet = d.parentNode && d.parentNode.querySelector("[data-whatsnew-count]");
      d.hidden = !(n === 1 || (n > 1 && !estSchet));
    });
    document.querySelectorAll("[data-whatsnew-count]").forEach(function (c) {
      c.hidden = !(n > 1);
      c.textContent = n > 9 ? "9+" : String(n);
    });
    document.querySelectorAll("[data-whatsnew]").forEach(function (b) {
      b.setAttribute("aria-label", n ? "Что нового — непрочитанных: " + n : "Что нового");
    });
    var bar = document.querySelector(".wn-bar");
    if (!n && bar) bar.remove();
  }

  // полоса под шапкой: не поверх контента и не липкая
  function polosa() {
    if (NA_LENTE || !neprochitano() || document.querySelector(".wn-bar")) return;
    // под шапкой — одна полоса ([команда] 30.09 §4): пока видна «Открытая бета», «Новое» не показываем — точка у «Что нового» остаётся
    var beta = document.querySelector("[data-beta-bar]");
    if (beta && !beta.hidden) return;
    var u = list[0], h = document.querySelector("[data-shapka]");
    if (!h) return;
    var d = document.createElement("div");
    d.className = "wn-bar";
    d.setAttribute("role", "region");
    d.setAttribute("aria-label", "Новое на сайте");
    d.innerHTML = '<div class="wn-bar__in"><p class="wn-bar__t"><b>Новое ' + denMes(u) + ":</b> " + tipo(esc(u.zagolovok)) +
      ' · <a href="/obnovleniya/#' + esc(u.id) + '">Что проверить →</a></p>' +
      '<button class="wn-bar__x" type="button" aria-label="Скрыть"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>';
    d.querySelector("a").addEventListener("click", function () { set(u.id); });
    d.querySelector("button").addEventListener("click", function () { prochital(); });
    h.parentNode.insertBefore(d, h.nextSibling);
  }

  function kogda(u) {
    var t = esc(u.data || "") + (u.vremya ? ", " + esc(u.vremya) + " МСК" : "");
    var m = /^(\d{4}-\d{2}-\d{2})/.exec(u.id || "");
    return m && u.vremya ? '<time datetime="' + m[1] + "T" + esc(u.vremya) + '+03:00">' + t + "</time>" : t;
  }
  function okno(opener) {
    var u = list[0];
    if (window.dlkGoal) window.dlkGoal("whatsnew_open");
    if (!u) { location.href = "/obnovleniya/"; return; }
    var dlg = document.createElement("dialog");
    dlg.className = "dlo";
    dlg.setAttribute("aria-labelledby", "dlo-h");
    var h = '<span class="dlo-tag">Обновление · ' + kogda(u) + '</span><h2 id="dlo-h">' + tipo(esc(u.zagolovok)) + "</h2>";
    if (u.chto_novogo && u.chto_novogo.length) {
      h += '<h3>Что нового</h3><ul class="dlo-n">' + u.chto_novogo.map(function (t) { return "<li>" + tipo(esc(t)) + "</li>"; }).join("") + "</ul>";
    }
    if (u.chto_proverit && u.chto_proverit.length) {
      h += '<h3>Что проверить</h3><ul class="dlo-p">' + u.chto_proverit.map(function (p) {
        return "<li>" + (p.ssylka ? '<a href="' + esc(p.ssylka) + '">' + tipo(esc(p.tekst)) + " →</a>" : tipo(esc(p.tekst))) + "</li>";
      }).join("") + "</ul>";
    }
    if (u.kuda_pisat) h += '<p class="dlo-note">' + tipo(esc(u.kuda_pisat)) + "</p>";
    h += '<div class="dlo-btns"><button class="dlo-ok" type="button">Понятно</button>' +
      '<a class="dlo-all" href="/obnovleniya/">Все обновления и что проверить →</a></div>';
    dlg.innerHTML = h;
    document.body.appendChild(dlg);
    dlg.addEventListener("close", function () {
      prochital();
      dlg.remove();
      if (opener && opener.focus && opener.offsetParent !== null) opener.focus();
    });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    dlg.querySelector(".dlo-ok").addEventListener("click", function () { dlg.close(); });
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    dlg.querySelector(".dlo-ok").focus({ preventScroll: true });
    dlg.scrollTop = 0;
  }

  var zhdet = null; // клик по «Что нового» до загрузки ленты
  window.addEventListener("deloskop:whatsnew", function (e) {
    var o = e.detail && e.detail.opener;
    if (list.length) okno(o); else zhdet = o || true;
  });

  function start() {
    fetch("/obnovleniya.json", { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        list = (d && d.obnovleniya) || [];
        if (!list.length) return;
        if (NA_LENTE) set(list[0].id); // открыл ленту — всё прочитано
        obnovit();
        polosa();
        if (zhdet || new URLSearchParams(location.search).has("obnovleniya")) okno(zhdet && zhdet !== true ? zhdet : null);
      })
      .catch(function () { if (zhdet) location.href = "/obnovleniya/"; });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
;
/* --- /js/schetchik.js --- */
/* Делоскоп — свой счёт просмотров страниц (pult-v2, сервер — POST https://api.deloskop.ru/api/ping {p, r}).
   Текст для людей — /politika/, цель 8 (тексты юристов 19.10.2026): без cookie, без хранилища браузера, без ИНН.
   С браузера уходит только:
     p — путь страницы без адресной строки после «?» (из меток — только utm_source, чтобы пост во ВК
         или в Дзене попал в свой источник); 12 и 15 цифр подряд (ИНН ИП, ОГРНИП) → «*»;
     r — откуда пришли: только адрес сайта (https://yandex.ru), без пути и запроса.
   Не отправляем: «Не отслеживать» (DNT) и Global Privacy Control, роботы автоматизации, кабинет, админка,
   не наш домен (локальная копия, предпросмотр). Страница из prerender — только после показа.
   Сервер считает, только когда включён SCHETCHIK=1; выключенный отвечает 204 и ничего не пишет. */
(function (koren) {
  "use strict";
  var NASH = /(^|\.)deloskop\.ru$/;
  var NE_SCHITAEM = /^\/(cabinet|admin)(\.html|\/|$)/;

  function put(pathname, search) {
    var p = String(pathname || "/").replace(/\d{12,}/g, function (c) { return c.length === 12 || c.length === 15 ? "*" : c; });
    p = p.replace(/[^\w\-\/.*~%]/g, "").slice(0, 200) || "/";
    var m = /[?&]utm_source=([^&#]*)/i.exec(String(search || ""));
    if (m) {
      var v = "";
      try { v = decodeURIComponent(m[1]); } catch (e) {}
      v = v.toLowerCase().replace(/[^a-z0-9_\-.]/g, "").slice(0, 32);
      if (v && !/\d{10,}/.test(v)) p += "?utm_source=" + v;
    }
    return p;
  }

  function otkuda(referrer) {
    var s = String(referrer || "");
    var m = /^(https?:\/\/[^\/?#]+)/i.exec(s);
    return m ? m[1].toLowerCase() : "";
  }

  // okr: { host, pathname, search, referrer, dnt, gpc, webdriver } → тело запроса или null
  function telo(okr) {
    if (!okr || !NASH.test(String(okr.host || ""))) return null;
    if (okr.dnt === "1" || okr.dnt === "yes" || okr.gpc === true || okr.webdriver === true) return null;
    if (NE_SCHITAEM.test(String(okr.pathname || ""))) return null;
    return { p: put(okr.pathname, okr.search), r: otkuda(okr.referrer) };
  }

  var api = { put: put, otkuda: otkuda, telo: telo };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (!koren || !koren.document || !koren.location) return;

  var d = koren.document, n = koren.navigator || {}, l = koren.location;
  function otpravit() {
    try {
      var b = telo({ host: l.hostname, pathname: l.pathname, search: l.search, referrer: d.referrer,
        dnt: n.doNotTrack || koren.doNotTrack, gpc: n.globalPrivacyControl, webdriver: n.webdriver });
      if (!b || typeof koren.fetch !== "function") return;
      koren.fetch("https://api.deloskop.ru/api/ping", { method: "POST", mode: "cors", credentials: "omit",
        keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
        .catch(function () {});
    } catch (e) {}
  }
  function pozzhe() {
    // после загрузки и в простое — счёт не спорит со страницей за сеть
    var go = function () { (koren.requestIdleCallback || function (f) { setTimeout(f, 1); })(otpravit, { timeout: 3000 }); };
    if (d.readyState === "complete") go(); else koren.addEventListener("load", go, { once: true });
  }
  if (d.prerendering) d.addEventListener("prerenderingchange", pozzhe, { once: true }); else pozzhe();
  // вернулись «Назад» из кэша страниц — это новый просмотр
  koren.addEventListener("pageshow", function (e) { if (e && e.persisted) otpravit(); });
})(typeof window !== "undefined" ? window : null);
;
