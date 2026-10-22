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
