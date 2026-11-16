/* Делоскоп — «Ответ помог?» под выводом отчёта (pomoglo-v1, 13.11.2026; pomoglo-v2, 17.11.2026).
 *
 * Один вопрос и две равные кнопки «Да» / «Нет» — под ответом живой проверки на главной.
 * Нажатие → свой счёт событий js/schetchik.js: POST /api/ping {sobytie: "otvet_pomog_da" | "otvet_pomog_net"} — только вид.
 * pomoglo-v2 (✎ Штаба 16.11 п. 9): на телефоне (≤ 600 px) вопрос стоит в первом экране — сразу под строкой «Ответ»
 * (.lip-o, js/lipkaya.js), а не под выводом на 1,5 экрана ниже; на компьютере — как было, под выводом (.ot-vt).
 * После «Нет» — одна необязательная строка «Чего не хватило?»: текст уходит анонимно в тот же канал, что «Полезно?»
 * (POST /api/otzyv, js/otzyv.js) — без ИНН, номера проверки и адреса страницы с параметрами; почту, телефоны и длинные
 * числа вырезаем до отправки (сервер делает то же самое). Ни cookie, ни хранилища браузера; Метрику не зовём.
 * Один ответ на один показ отчёта. Счёт выключен (DNT, GPC, робот, не наш домен) — вопрос не показываем.
 * Своя компания («глазами банка») и пример на главной — без вопроса.
 * Выключатель — VKL ниже (одна строка). Чистые функции — для автотестов: tests/pomoglo.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.DlkPomoglo = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  var VKL = true;
  var UZKO = "(max-width: 600px)";
  var MAX = 300;
  var T = {
    vopros: "Ответ помог?", da: "Да", net: "Нет", spasibo: "Спасибо",
    chego: "Чего не хватило?", podskazka: "Необязательно", otpravit: "Отправить",
    anonimno: "Без имён, телефонов и почты — ответ анонимный.",
    ne_prinyal: "Сайт не принял ответ — если не трудно, напишите на help@deloskop.ru."
  };
  var VID = { da: "otvet_pomog_da", net: "otvet_pomog_net" };

  function vidSobytiya(otvet) { return VID[otvet] || null; }

  function html() {
    return '<p class="pmg__q" id="pmg-q">' + T.vopros + "</p>" +
      '<div class="pmg__r" role="group" aria-labelledby="pmg-q">' +
      '<button type="button" class="pmg__b" data-pmg="da">' + T.da + "</button>" +
      '<button type="button" class="pmg__b" data-pmg="net">' + T.net + "</button></div>";
  }

  // после «Нет»: одна строка (input, не textarea) и одна кнопка; пусто — просто «Спасибо»
  function htmlNet() {
    return '<form class="pmg__f" data-pmg-f novalidate>' +
      '<label class="pmg__q" for="pmg-t">' + T.chego + "</label>" +
      '<div class="pmg__st"><input id="pmg-t" class="pmg__i" type="text" maxlength="' + MAX + '" autocomplete="off" enterkeyhint="send" placeholder="' + T.podskazka + '">' +
      '<button type="submit" class="pmg__b">' + T.otpravit + "</button></div>" +
      '<p class="pmg__m">' + T.anonimno + "</p></form>";
  }

  // то же правило, что js/otzyv.js chistyj(): почта, телефоны, 10–20-значные числа (ИНН, счета) — вон
  function chistyj(t) {
    return String(t || "")
      .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[почта]")
      .replace(/(\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g, "[телефон]")
      .replace(/\b\d{10,20}\b/g, "[номер]")
      .replace(/\s+/g, " ").trim().slice(0, MAX);
  }

  // id — случайная метка одного ответа, как у «Полезно?» (js/otzyv.js novyjId)
  function novyjId(w) {
    var a = new Uint8Array(8);
    try { ((w && w.crypto) || require("crypto").webcrypto).getRandomValues(a); } catch (e) { for (var i = 0; i < 8; i++) a[i] = Math.random() * 256; }
    return Array.prototype.map.call(a, function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("");
  }

  // тело для /api/otzyv — та же форма, что у «Полезно?» (js/otzyv.js telo), новых полей сервер не ждёт:
  // страница — только путь «/» (отчёт на главной; у report.html своя «/report.html»), вид — отчёт, оценка — «не помог»
  function teloOtzyva(tekst, id) {
    var t = chistyj(tekst);
    return t ? { id: /^[0-9a-f]{16}$/.test(id || "") ? id : novyjId(), stranica: "/", vid: "otchet", ocenka: "neponyal", rezhim: "rabota", tekst: t } : null;
  }

  function uzko(w) {
    try { return !!(w && w.matchMedia && w.matchMedia(UZKO).matches); } catch (e) { return false; }
  }

  // куда ставить. Телефон: под строкой «Ответ» в шапке отчёта (первый экран). Иначе — колонка вывода .ot-vt;
  // лист не разложен — после блока вывода [.usl/.verdict]
  function mesto(report, naTelefone) {
    if (!report || !report.querySelector) return null;
    if (naTelefone) {
      var lo = report.querySelector(".lip-o");
      if (lo && !lo.hidden && lo.parentNode) return { v: lo.parentNode, posle: lo, verh: true };
    }
    var vt = report.querySelector(".ot-vt");
    if (vt) return { v: vt, posle: null };
    var u = report.querySelector(".usl") || report.querySelector(".verdict");
    return u && u.parentNode ? { v: u.parentNode, posle: u } : null;
  }

  function api(w) {
    try { return /(^|\.)deloskop\.ru$/.test(w.location.hostname) ? "https://api.deloskop.ru" : ""; } catch (e) { return ""; }
  }

  // o: { svoj, primer } — своя компания и пример не спрашиваем; w — окно (для тестов)
  function mount(report, r, o, w) {
    o = o || {}; w = w || (typeof window !== "undefined" ? window : null);
    if (!VKL || !w || !report || o.svoj) return null;
    var inn = String(r && r.company && r.company.inn || "");
    if (!/^\d{10}(\d{2})?$/.test(inn) || /^0+$/.test(inn)) return null;
    // счёт событий не уйдёт (DNT, GPC, робот, чужой домен) — не задаём вопрос впустую
    try { if (typeof w.dlkSobytie !== "function" || (w.dlkSchitaem && !w.dlkSchitaem())) return null; } catch (e) { return null; }
    if (report.querySelector("[data-pomoglo]")) return null;
    var m = mesto(report, uzko(w));
    if (!m) return null;
    var doc = report.ownerDocument || w.document;
    var b = doc.createElement("div");
    b.className = "pmg" + (m.verh ? " pmg--verh" : ""); b.setAttribute("data-pomoglo", "");
    b.innerHTML = html();
    if (m.posle) m.v.insertBefore(b, m.posle.nextSibling); else m.v.appendChild(b);

    function spasibo(ok) {
      b.classList.add("pmg--ok");
      b.innerHTML = '<p class="pmg__s" role="status" tabindex="-1">' + T.spasibo + (ok === false ? ". " + T.ne_prinyal : "") + "</p>";
      try { b.firstChild.focus({ preventScroll: true }); } catch (e) {}
    }
    function sprositChego() {
      b.innerHTML = htmlNet();
      var f = b.querySelector("[data-pmg-f]"), inp = b.querySelector(".pmg__i");
      try { inp.focus({ preventScroll: true }); } catch (e) {}
      var ushlo = false;
      f.addEventListener("submit", function (e) {
        if (e && e.preventDefault) e.preventDefault();
        if (ushlo) return;
        ushlo = true;
        var telo = teloOtzyva(inp && inp.value, novyjId(w));
        if (!telo || typeof w.fetch !== "function") { spasibo(true); return; }
        var A = api(w);
        if (!A && w.location && w.location.protocol === "file:") { spasibo(false); return; }
        w.fetch(A + "/api/otzyv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(telo) })
          .then(function (r) { spasibo(!!(r && r.ok)); }, function () { spasibo(false); });
      });
    }

    var otvecheno = false;
    Array.prototype.forEach.call(b.querySelectorAll("[data-pmg]"), function (k) {
      k.addEventListener("click", function () {
        if (otvecheno) return;
        otvecheno = true;
        var otv = k.getAttribute("data-pmg");
        var v = vidSobytiya(otv);
        try { if (v) w.dlkSobytie(v); } catch (e) {}
        if (otv === "net") sprositChego(); else spasibo(true);
      });
    });
    return b;
  }

  return { VKL: VKL, UZKO: UZKO, MAX: MAX, T: T, VID: VID, vidSobytiya: vidSobytiya, html: html, htmlNet: htmlNet,
    chistyj: chistyj, teloOtzyva: teloOtzyva, mesto: mesto, mount: mount };
});
