/* Делоскоп — /oplata/gotovo/: итог оплаты картой или по СБП (oplata-alfa-v1, 12.10.2026).
   Банк возвращает сюда посетителя с ?zakaz=K-…; страница спрашивает API, а API — сам банк (на слово ссылке
   не верим: «оплачено» показываем только после ответа банка). Пока банк думает — спрашиваем каждые 2 с, до 30 с.
   Чистые функции — для автотеста tests/oplata_kartoj.test.js. */
(function (root) {
  "use strict";

  var ZAKAZ_RE = /^[A-Za-z0-9-]{4,32}$/;
  function rub(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽"; }

  // Что показать по ответу API. sost: zhdem | oplachen | otkaz | proverka | net
  function ekran(o, popytok) {
    var st = o && o.status;
    if (o && o.otkaz && !o.oshibka && st !== "oplachen") st = st === "zaregistrirovan" || !st ? "otklonen" : st;
    if (st === "oplachen") return {
      sost: "oplachen", h: "Оплата прошла",
      t: "Доступ открыт — войдите в кабинет с той же почтой. Кассовый чек банк пришлёт на e-mail.",
      knopki: [["btn", "/cabinet.html", "Открыть кабинет"], ["vtor", "/", "Проверить компанию"]]
    };
    if (st === "otklonen" || st === "otmenen") return {
      sost: "otkaz", h: "Оплата не прошла",
      t: "Деньги не списаны. Попробуйте ещё раз, другой картой или по СБП — или получите счёт для оплаты с расчётного счёта.",
      knopki: [["btn", "/tarify/", "Вернуться к тарифам"], ["vtor", "/schet/", "Получить счёт"]]
    };
    if (st === "rashozhdenie") return {
      sost: "proverka", h: "Платёж на проверке",
      t: "Сумма платежа не совпала с заказом, поэтому доступ сам не открылся. Разберёмся и напишем на почту в течение рабочего дня.",
      knopki: [["vtor", "mailto:help@deloskop.ru?subject=" + encodeURIComponent("Оплата " + (o.zakaz || "")), "Написать нам"]]
    };
    if (st === "vozvrat") return {
      sost: "otkaz", h: "Деньги возвращены",
      t: "По этому заказу оформлен возврат. Деньги придут на карту в срок, который назначит ваш банк.",
      knopki: [["vtor", "/tarify/", "Тарифы"]]
    };
    if (!o || o.oshibka === "net") return {
      sost: "net", h: "Не нашли заказ",
      t: "Ссылка неполная или заказ создан давно. Если деньги списались — напишите нам номер заказа из письма банка, разберёмся.",
      knopki: [["vtor", "mailto:help@deloskop.ru", "Написать нам"]]
    };
    if (popytok >= 15) return {
      sost: "zhdem", h: "Банк ещё не подтвердил",
      t: "Если деньги списались, доступ откроется сам, как только банк пришлёт подтверждение, — придёт письмо. Обновите страницу через минуту.",
      knopki: [["vtor", "", "Обновить"]], stop: true
    };
    return { sost: "zhdem", h: "Проверяем оплату", t: "Банк подтверждает платёж — обычно это несколько секунд.", knopki: [] };
  }

  var api = { ekran: ekran, rub: rub, ZAKAZ_RE: ZAKAZ_RE };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  if (typeof document === "undefined") return;
  root.DeloskopOplataGotovo = api;

  var API = location.hostname.endsWith("deloskop.ru") ? "https://api.deloskop.ru" : "";
  var q = new URLSearchParams(location.search);
  var zakaz = q.get("zakaz") || "", otkaz = q.get("otkaz") === "1";
  var box = document.querySelector("[data-itog]");
  if (!box) return;
  var $ = function (s) { return box.querySelector(s); };
  var ZN = {
    oplachen: '<svg width="28" height="28" viewBox="0 0 20 20" fill="none"><path d="M4.5 10.5L8 14L15.5 6.5" stroke="#16723F" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    otkaz: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7 7 17" stroke="#B3261E" stroke-width="2.4" stroke-linecap="round"/></svg>',
    proverka: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 7v6M12 16.5v.5" stroke="#9A5B00" stroke-width="2.4" stroke-linecap="round"/></svg>'
  };
  ZN.net = ZN.otkaz;
  var bylo = null;

  function pokazat(e, o) {
    box.setAttribute("data-sost", e.sost);
    $("[data-zn]").innerHTML = ZN[e.sost] || '<span class="spin"></span>';
    $("[data-h]").textContent = e.h;
    $("[data-t]").textContent = e.t;
    $("[data-chto]").textContent = o && o.opisanie ? o.opisanie + (o.summa ? " · " + rub(o.summa) : "") : "";
    var k = $("[data-knopki]");
    k.innerHTML = "";
    e.knopki.forEach(function (b) {
      var el;
      if (b[1]) { el = document.createElement("a"); el.href = b[1]; } else { el = document.createElement("button"); el.type = "button"; el.onclick = function () { location.reload(); }; }
      el.className = b[0]; el.textContent = b[2]; k.appendChild(el);
    });
    document.title = e.h + " — Делоскоп";
    if (bylo !== e.sost) { bylo = e.sost; if (e.sost !== "zhdem") { try { $("[data-h]").focus(); } catch (x) {} } }
    if (e.sost === "oplachen" && window.dlkGoal) window.dlkGoal("oplata_karta_ok", {});
  }

  if (!ZAKAZ_RE.test(zakaz)) { pokazat(ekran(null, 0), null); return; }
  $("[data-nomer]").textContent = zakaz;
  var popytok = 0;
  function sprosit() {
    popytok++;
    fetch(API + "/api/oplata/alfa/status?zakaz=" + encodeURIComponent(zakaz), { cache: "no-store" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { r: r, j: j }; }); })
      .then(function (x) {
        var o = x.r.status === 404 ? { oshibka: "net" } : x.j;
        o.otkaz = otkaz;
        var e = ekran(o, popytok);
        pokazat(e, o);
        if (e.sost === "zhdem" && !e.stop) setTimeout(sprosit, 2000);
      })
      .catch(function () { var e = ekran({ status: "zaregistrirovan" }, popytok); pokazat(e, null); if (!e.stop) setTimeout(sprosit, 2000); });
  }
  sprosit();
})(typeof window !== "undefined" ? window : this);
