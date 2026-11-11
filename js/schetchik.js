/* Делоскоп — свой счёт просмотров страниц (pult-v2, сервер — POST https://api.deloskop.ru/api/ping {p, r}).
   Текст для людей — /politika/, цель 8 (тексты юристов 19.10.2026): без cookie, без хранилища браузера, без ИНН.
   С браузера уходит только:
     p — путь страницы без адресной строки после «?» (из меток — только utm_source, чтобы пост во ВК
         или в Дзене попал в свой источник); 12 и 15 цифр подряд (ИНН ИП, ОГРНИП) → «*»;
     r — откуда пришли: только адрес сайта (https://yandex.ru), без пути и запроса.
   Не отправляем: «Не отслеживать» (DNT) и Global Privacy Control, роботы автоматизации, кабинет, админка,
   не наш домен (локальная копия, предпросмотр). Страница из prerender — только после показа.
   Сервер считает, только когда включён SCHETCHIK=1; выключенный отвечает 204 и ничего не пишет.
   sobytiya-v1: нажатия кнопок отчёта — {sobytie: вид}, только общее число за день по виду (ниже, VIDY).
   pamyat-proverok-v1: первую и повторную проверку отличает память на устройстве в js/nedavnie.js; сюда приходит
   только готовый вид события (proverka_novaya, perepoverka_7_60, vozvrat_3_30). */
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

  // sobytiya-v1 (п. 439; правовые условия 01.11 — 5 пунктов): счёт нажатий кнопок отчёта для метрик M1–M2.
  // На сервер — только вид события: ни пути, ни ИНН, ни номера проверки, ни времени точнее дня (его ставит сервер).
  // Те же отказы, что у просмотров: чужой домен, «Не отслеживать», GPC, роботы, кабинет и админка.
  // Перепроверку в окне 7–60 дней считает сам браузер (js/nedavnie.js) и шлёт готовый вид — сервер две проверки не связывает.
  var VIDY = { deystvie_dokumenty: 1, deystvie_dosje: 1, deystvie_slezhenie: 1, deystvie_pervoe: 1, perepoverka_7_60: 1,
    proverka_novaya: 1, vozvrat_3_30: 1 };
  // Эти виды шлются по разу на компанию или на день (это решает память), а не по разу за показ страницы.
  var MNOGO = { proverka_novaya: 1, perepoverka_7_60: 1 };
  // Включается одной строкой после выкладки API (приём {sobytie} в /api/ping — ТЗ в КАК_ВЫЛОЖИТЬ_sobytiya-v1).
  var VKL = false;
  function teloSobytiya(vid, okr) {
    if (VIDY[vid] !== 1 || !telo(okr)) return null;
    return { sobytie: vid };
  }
  // Какая кнопка нажата: «Запросить документы», «В досье», «Следить» — в экране «4 вопроса», полосе отчёта и разборах.
  var Q4 = { docs: "deystvie_dokumenty", dosje: "deystvie_dosje", slezh: "deystvie_slezhenie" };
  var CEL = { otchet_sled: "deystvie_slezhenie", shchit_sled: "deystvie_slezhenie", otchet_pasport: "deystvie_dosje" };
  function vidKlika(el) {
    if (!el || !el.closest) return null;
    var b = el.closest("[data-q4-act]");
    if (b) return Q4[b.getAttribute("data-q4-act")] || null;
    b = el.closest("[data-cel]");
    if (b) return CEL[b.getAttribute("data-cel")] || null;
    return el.closest("[data-slezh-knopka]") ? "deystvie_slezhenie" : null;
  }

  var api = { put: put, otkuda: otkuda, telo: telo, teloSobytiya: teloSobytiya, vidKlika: vidKlika, VIDY: VIDY };
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
  // sobytiya-v1: одно событие каждого вида за показ страницы (повтор клика — не новое действие) + «первое действие»
  var poslano = {};
  function sobytie(vid) {
    try {
      if (!VKL || (poslano[vid] && !MNOGO[vid])) return;
      var b = teloSobytiya(vid, { host: l.hostname, pathname: l.pathname, search: l.search, referrer: "",
        dnt: n.doNotTrack || koren.doNotTrack, gpc: n.globalPrivacyControl, webdriver: n.webdriver });
      if (!b || typeof koren.fetch !== "function") return;
      poslano[vid] = 1;
      koren.fetch("https://api.deloskop.ru/api/ping", { method: "POST", mode: "cors", credentials: "omit",
        keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
        .catch(function () {});
    } catch (e) {}
  }
  koren.dlkSobytie = sobytie;
  // pamyat-proverok-v1: память проверок живёт в js/nedavnie.js (там же, где «Недавние»); счётчик хранилища не трогает.
  // Память пишется, только когда события и правда уходят: VKL, наш домен, нет DNT/GPC, не робот.
  koren.dlkSchitaem = function () {
    try {
      return VKL && !!teloSobytiya("vozvrat_3_30", { host: l.hostname, pathname: l.pathname, search: "", referrer: "",
        dnt: n.doNotTrack || koren.doNotTrack, gpc: n.globalPrivacyControl, webdriver: n.webdriver });
    } catch (e) { return false; }
  };
  if (d.addEventListener) d.addEventListener("click", function (e) {
    var v = vidKlika(e && e.target);
    if (!v) return;
    if (VKL && !poslano.deystvie_pervoe) sobytie("deystvie_pervoe");
    sobytie(v);
  }, true);
  if (d.prerendering) d.addEventListener("prerenderingchange", pozzhe, { once: true }); else pozzhe();
  // вернулись «Назад» из кэша страниц — это новый просмотр
  koren.addEventListener("pageshow", function (e) { if (e && e.persisted) otpravit(); });
})(typeof window !== "undefined" ? window : null);
