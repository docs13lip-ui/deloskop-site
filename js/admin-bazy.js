/* Админка: «Базы» — светофор источников данных (pult-baz-v1, 11.10.2026).
   Вызывается из admin.html после входа:
   DlkBazy.start(call, isAdmin). Пока API без pult-baz-v1 (404) — раздел скрыт. */
(function () {
  "use strict";
  var CVET = { zelenyj: "Работает", zheltyj: "Внимание", krasnyj: "Не работает", seryj: "Не подключено" };
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function vremya(s) {
    if (!s) return "";
    try {
      var d = new Date(s), seg = new Date();
      var o = { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" };
      var t = d.toLocaleTimeString("ru-RU", o);
      var den = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" });
      var segDen = seg.toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" });
      return den === segDen ? "в " + t : den + ", " + t;
    } catch (_) { return s; }
  }
  function data(s) { if (!s) return ""; var p = String(s).slice(0, 10).split("-"); return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : s; }
  function zaglavnaya(t) { t = String(t || ""); return t.charAt(0).toUpperCase() + t.slice(1); }
  function chislo(n) { return Number(n).toLocaleString("ru-RU"); }

  function plitka(b, mozhno) {
    var fakty = [];
    if (b.poslednij_uspeh) fakty.push("успех " + vremya(b.poslednij_uspeh));
    else if (b.sostoyanie !== "seryj") fakty.push("успехов не было");
    if (b.svezhest_dannyh) fakty.push("данные на " + data(b.svezhest_dannyh));
    if (b.kvota_ostatok != null && b.kvota_vsego) fakty.push("квота " + chislo(b.kvota_ostatok) + " из " + chislo(b.kvota_vsego));
    if (b.zapisej) fakty.push(chislo(b.zapisej) + " записей");
    var prichina = b.sostoyanie === "zelenyj" ? "" :
      '<p class="bz-why">' + esc(b.sostoyanie === "seryj" && b.chto_nuzhno ? "Что нужно: " + b.chto_nuzhno : zaglavnaya(b.prichina)) + "</p>";
    var oshibka = b.sostoyanie === "krasnyj" && b.poslednyaya_oshibka ?
      '<p class="bz-err">' + esc(b.poslednyaya_oshibka.tekst) + " · " + esc(vremya(b.poslednyaya_oshibka.vremya)) + "</p>" : "";
    return '<li class="bz ' + esc(b.sostoyanie) + '">' +
      '<div class="bz-top"><span class="bz-dot" role="img" aria-label="' + esc(CVET[b.sostoyanie] || "") + '"></span>' +
      "<b>" + esc(b.nazvanie) + "</b></div>" +
      '<p class="bz-src">' + esc(b.istochnik) + "</p>" +
      (fakty.length ? '<p class="bz-fakt">' + esc(fakty.join(" · ")) + "</p>" : "") + prichina + oshibka +
      (mozhno && b.sostoyanie !== "seryj" ? '<button class="bz-run" type="button" data-baza="' + esc(b.id) + '">Проверить сейчас</button>' : "") +
      "</li>";
  }

  function risovat(j, mozhno) {
    var it = j.itog || {}, bazy = j.bazy || [];
    $("bzItog").innerHTML = esc(it.tekst || "") +
      ((it.krasnyj || 0) ? ' <span class="bz-plohie">не работает: ' + esc(it.krasnyj) + "</span>" : "");
    var poslednyaya = bazy.reduce(function (m, b) { return b.proba && (!m || b.proba > m) ? b.proba : m; }, null);
    $("bzKogda").textContent = poslednyaya ? "Последняя проба " + vremya(poslednyaya) + ". Проба идёт сама раз в час." : "Проб ещё не было.";
    $("bzGruppy").innerHTML = (j.gruppy || []).map(function (g) {
      var vg = bazy.filter(function (b) { return b.gruppa === g; });
      if (!vg.length) return "";
      return '<div class="bz-gr"><h3>' + esc(g) + '</h3><ul class="bz-list">' + vg.map(function (b) { return plitka(b, mozhno); }).join("") + "</ul></div>";
    }).join("");
  }

  function start(call, isAdmin) {
    var sek = $("bzSek");
    if (!sek) return Promise.resolve();
    var note = function (t, c) { var el = $("bzNote"); el.className = "note" + (c ? " " + c : ""); el.textContent = t || ""; };
    function zagruzit() {
      return call("/api/admin/bazy/status").then(function (j) { sek.hidden = false; risovat(j, isAdmin()); })
        .catch(function (e) { if (e.status === 404) { sek.hidden = true; return; } sek.hidden = false; note(e.message, "err"); });
    }
    function proverit(baza, knopka) {
      if (knopka) knopka.disabled = true;
      note(baza === "vse" ? "Проверяем все базы — до 30 секунд…" : "Проверяем…");
      return call("/api/admin/bazy/" + encodeURIComponent(baza) + "/proverit", { method: "POST", body: {} })
        .then(function (j) { risovat(j, isAdmin()); note("Готово.", "ok"); })
        .catch(function (e) { note(e.message, "err"); })
        .then(function () { if (knopka) knopka.disabled = false; });
    }
    $("bzVse").onclick = function () { proverit("vse", this); };
    $("bzVse").disabled = !isAdmin();
    $("bzGruppy").addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".bz-run");
      if (b) proverit(b.getAttribute("data-baza"), b);
    });
    setInterval(function () { if (!document.hidden) zagruzit(); }, 5 * 60 * 1000);
    return zagruzit();
  }

  window.DlkBazy = { start: start, _risovat: risovat };
})();
