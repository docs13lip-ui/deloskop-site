/* Делоскоп — поведение единой шапки (claude/Дизайн_шапка_логотип_и_Скорая_v2.md §1.4).
   Разметка — /partials/shapka.html, вставляет tests/sobrat_shapku.py. «Что нового» — /obnovleniya.js
   (окно открывается только по событию deloskop:whatsnew от кнопки в шапке). */
(function () {
  "use strict";
  function init() {
    var h = document.querySelector("[data-shapka]");
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
