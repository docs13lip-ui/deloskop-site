/* Делоскоп — кнопки «Написать в MAX / ВКонтакте / Telegram» (kanaly-v1, [Ночные-3] 10.10.2026).
 * Ссылки — только из /data/kanaly.json. Пустая ссылка — кнопка остаётся скрытой: пока бот не прошёл модерацию,
 * на сайте нет кнопки, которая ведёт в никуда. [data-kanal="max|vk|tg"] — кнопка; [data-kanaly-blok] — обёртка,
 * показывается, если есть хоть одна ссылка; [data-kanaly-net] — текст «ссылка появится здесь», прячется, когда ссылки есть.
 * Чистая функция ssylki() проверяет адрес (https, нужный домен) — её зовёт tests/kanaly_sait.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkKanaly = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DOMENY = { max: /^https:\/\/max\.ru\/[A-Za-z0-9_.\-\/?=&]+$/, vk: /^https:\/\/vk\.me\/[A-Za-z0-9_.\-]+$/, tg: /^https:\/\/t\.me\/[A-Za-z0-9_]+$/ };

  function ssylki(d) {
    var out = {};
    Object.keys(DOMENY).forEach(function (k) {
      var u = d && typeof d[k] === 'string' ? d[k].trim() : '';
      if (u && DOMENY[k].test(u)) out[k] = u;
    });
    return out;
  }

  function primenit(doc, s) {
    var est = false;
    Array.prototype.forEach.call(doc.querySelectorAll('[data-kanal]'), function (a) {
      var u = s[a.getAttribute('data-kanal')];
      if (u) { a.href = u + (u.indexOf('?') < 0 ? '?' : '&') + 'start=sait'; a.hidden = false; a.rel = 'noopener'; est = true; }
      else a.hidden = true;
    });
    Array.prototype.forEach.call(doc.querySelectorAll('[data-kanaly-blok]'), function (b) { b.hidden = !est; });
    Array.prototype.forEach.call(doc.querySelectorAll('[data-kanaly-net]'), function (b) { b.hidden = est; });
    return est;
  }

  if (typeof document !== 'undefined' && typeof fetch === 'function') {
    var go = function () {
      fetch('/data/kanaly.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (d) { primenit(document, ssylki(d)); }).catch(function () {});
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }
  return { ssylki: ssylki, primenit: primenit, DOMENY: DOMENY };
});
