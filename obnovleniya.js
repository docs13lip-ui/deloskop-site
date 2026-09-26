/* Делоскоп — лента «Что нового» (claude/Дизайн_что_нового_для_проверяющих.md).
   Окно САМО НЕ ОТКРЫВАЕТСЯ (решение владельца 26.09): оно закрывало поле ИНН у клиентов.
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
    var u = list[0], h = document.querySelector("[data-shapka]");
    if (!h) return;
    var d = document.createElement("div");
    d.className = "wn-bar";
    d.setAttribute("role", "region");
    d.setAttribute("aria-label", "Новое на сайте");
    d.innerHTML = '<div class="wn-bar__in"><p class="wn-bar__t"><b>Новое ' + denMes(u) + ":</b> " + esc(u.zagolovok) +
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
    var h = '<span class="dlo-tag">Обновление · ' + kogda(u) + '</span><h2 id="dlo-h">' + esc(u.zagolovok) + "</h2>";
    if (u.chto_novogo && u.chto_novogo.length) {
      h += '<h3>Что нового</h3><ul class="dlo-n">' + u.chto_novogo.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ul>";
    }
    if (u.chto_proverit && u.chto_proverit.length) {
      h += '<h3>Что проверить</h3><ul class="dlo-p">' + u.chto_proverit.map(function (p) {
        return "<li>" + (p.ssylka ? '<a href="' + esc(p.ssylka) + '">' + esc(p.tekst) + " →</a>" : esc(p.tekst)) + "</li>";
      }).join("") + "</ul>";
    }
    if (u.kuda_pisat) h += '<p class="dlo-note">' + esc(u.kuda_pisat) + "</p>";
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
