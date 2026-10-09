/* Делоскоп — поведение единой шапки (claude/Дизайн_шапка_логотип_и_Скорая_v2.md §1.4).
   Разметка — /partials/shapka.html, вставляет tests/sobrat_shapku.py. «Что нового» — /obnovleniya.js
   (окно открывается только по событию deloskop:whatsnew от кнопки в шапке). */
(function () {
  "use strict";
  // 0. Полоса «Открытая бета» (beta-v1; bez-dvusmyslennosti-v1.1 — 04.10.2026; beta-data-v1 — 09.10.2026).
  //    Дата конца беты — одно место: tarify.json → "beta_do"; сборщик пишет её в атрибут полосы data-beta-do
  //    (ТЗ [Продукт] 05.10, claude/Продукт_14.10_без_ворот_бета_не_врёт_05.10.md, разд. 1). Режим — data-beta-rezhim:
  //    a — дата есть (после конца дня по МСК инлайн-скрипт полосы сам ставит текст B — без выкладки в полночь);
  //    b — «Открытая бета продолжается…»; c — «Бета завершилась…», 7 дней, без крестика.
  //    Крестик прячет полосу на неделю, но в режиме a — не дольше конца беты: новость о тарифах должен увидеть каждый.
  //    Ключ «скрыть» — свой для каждой даты (dlk_beta_skryt_ГГГГ-ММ-ДД / _net): дату назначили или сменили —
  //    полосу снова видят все ([Право] 05.10 11:10, разд. 1, условие 2). Хранилище недоступно — просто прячем.
  //    Ссылка «Цена основателя» гаснет сама, когда все места заняты (п. 3.8 оферты; [Право] 04.10 10:15,
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
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
