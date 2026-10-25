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

// inn-pole-v1 >>> (24.10.2026): поле ИНН в формах «Проверить» (29 статей, /tarify/, НДС на УСН).
//   У полей стоит pattern «10 или 12 цифр», а браузер не чистит ввод: ИНН, скопированный из договора или счёта
//   с пробелом («7707083893 », «7707 083 893», «ИНН 7707083893»), отклонялся с общим «Введите данные в указанном
//   формате» — форма молча не уходила. Теперь: вставка — берём из текста первый ИНН (10 или 12 цифр подряд,
//   пробелы и дефисы внутри числа не мешают; «ИНН/КПП 7707083893/770701001» → 7707083893), ввод — только цифры,
//   отказ — понятной фразой. Длину не обрезаем: 12 цифр в поле «только организации» должны получить отказ, а не
//   превратиться в чужой ИНН из 10 (браузер сам обрезает вставку по maxlength — поэтому длинную вставку
//   кладём целиком сами). Контрольную цифру проверяет главная (js/inn.js) — здесь только длина.
(function () {
  "use strict";
  var SEL = 'input[name="inn"][inputmode="numeric"]', NB = " ";
  function pole(t) { return t && t.matches && t.matches(SEL) ? t : null; }
  function cifry(s) { return String(s == null ? "" : s).replace(/\D/g, ""); }
  function izTeksta(s) {
    var g = String(s || "").match(/\d(?:[\s \-]*\d)*/g) || [], i, d;
    for (i = 0; i < g.length; i++) {
      d = cifry(g[i]); if (d.length === 10 || d.length === 12) return d;
      // inn-tekst-v1: «7707083893 770701001» — ИНН и КПП через пробел склеились в 19 цифр; берём слово из 10/12
      var t = g[i].split(/[\s\u00a0]+/), j; for (j = 0; j < t.length; j++) { d = cifry(t[j]); if (d.length === 10 || d.length === 12) return d; }
    }
    return cifry(s);
  }
  function tolkoOrg(p) { return p.getAttribute("maxlength") === "10"; }
  function otkaz(p) {
    var n = cifry(p.value).length;
    if (tolkoOrg(p)) {
      if (!n) return "Введите ИНН организации —" + NB + "10" + NB + "цифр.";
      if (n === 12) return "Здесь нужен ИНН организации —" + NB + "10" + NB + "цифр. Из" + NB + "12" + NB + "цифр — ИНН" + NB + "ИП или человека.";
      return "ИНН организации —" + NB + "10" + NB + "цифр. Сейчас цифр:" + NB + n + ".";
    }
    if (!n) return "Введите ИНН —" + NB + "10" + NB + "цифр у" + NB + "компании или" + NB + "12" + NB + "у" + NB + "ИП.";
    return "ИНН компании —" + NB + "10" + NB + "цифр, ИНН" + NB + "ИП —" + NB + "12. Сейчас цифр:" + NB + n + ".";
  }
  function izmeneno(p) {
    try { p.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) { /* старый браузер — без события */ }
  }
  document.addEventListener("paste", function (ev) {
    var p = pole(ev.target), cb = ev.clipboardData;
    if (!p || !cb) return;
    var s = cb.getData("text") || cb.getData("text/plain") || "", d = izTeksta(s);
    var dl = +p.getAttribute("maxlength") || 0;
    if (!d || (d === s && !(dl && d.length > dl))) return;  // чистый ИНН по длине — вставит сам браузер
    ev.preventDefault();
    var v = p.value, a = p.selectionStart, b = p.selectionEnd;
    if (a == null || b == null) { a = 0; b = v.length; }
    p.value = (d.length === 10 || d.length === 12) && a === 0 && b === v.length ? d : cifry(v.slice(0, a) + d + v.slice(b));
    izmeneno(p);
  });
  document.addEventListener("input", function (ev) {
    var p = pole(ev.target);
    if (!p) return;
    var d = cifry(p.value);
    if (d !== p.value) p.value = d;
    p.setCustomValidity("");
  });
  document.addEventListener("invalid", function (ev) {
    var p = pole(ev.target);
    if (p) p.setCustomValidity(otkaz(p));
  }, true);
})();
// <<< inn-pole-v1

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


/* §11. dostupnost-v1 (25.10): широкая таблица на телефоне листается вбок внутри .tw — без мыши до неё
   не добраться. Пока таблица шире своей рамки, рамка — область «Таблица: <заголовок>» и принимает фокус
   (стрелки листают её), поместилась — снова обычный блок без лишней остановки Tab. Заголовок — подпись таблицы
   (<caption>) или ближайший заголовок выше; иначе — «Таблица». */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined" || !document.querySelectorAll || !window.addEventListener) return;
  function imya(w) {
    var c = w.querySelector("caption");
    var t = c && c.textContent;
    if (!t) {
      for (var e = w.previousElementSibling, i = 0; e && i < 6 && !t; e = e.previousElementSibling, i++)
        if (/^H[2-4]$/.test(e.tagName)) t = e.textContent;
    }
    t = (t || "").replace(/\s+/g, " ").trim();
    return t ? "Таблица: " + (t.length > 80 ? t.slice(0, 79) + "…" : t) : "Таблица";
  }
  function otmetit() {
    var ws = document.querySelectorAll(".tw");
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i], shire = w.scrollWidth > w.clientWidth + 1;
      if (shire && !w.hasAttribute("data-tw-fokus")) {
        w.setAttribute("data-tw-fokus", "");
        w.setAttribute("tabindex", "0");
        w.setAttribute("role", "region");
        w.setAttribute("aria-label", imya(w));
      } else if (!shire && w.hasAttribute("data-tw-fokus")) {
        ["data-tw-fokus", "tabindex", "role", "aria-label"].forEach(function (a) { w.removeAttribute(a); });
      }
    }
  }
  var tajmer = 0;
  function pozzhe() { clearTimeout(tajmer); tajmer = setTimeout(otmetit, 150); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", otmetit); else otmetit();
  window.addEventListener("load", otmetit);
  window.addEventListener("resize", pozzhe, { passive: true });
  if (typeof module === "object" && module.exports) module.exports.tablicy = { otmetit: otmetit, imya: imya };
})();
