/* Делоскоп — service worker (pwa-v1, 12.10.2026).
   Что делает: сайт ставится на телефон как приложение и открывается без сети.
   Правила (152-ФЗ и «данные людей не храним»):
   — запросы к другим адресам (api.deloskop.ru, Метрика, банки) НЕ перехватываем и НЕ кэшируем никогда:
     ответы API с данными о компаниях, кабинете и платежах проходят мимо;
   — с deloskop.ru кэшируем только оболочку: страницы (без параметров в адресе), стили, скрипты,
     шрифты, иконки. Служебные страницы (admin) и ответы не 200 — не кэшируем;
   — страницы, стили и скрипты — сначала сеть (свежая выкладка видна сразу), кэш — только без сети;
   — без сети и без копии страницы — экран /offline.html («Нет сети — последние проверки ниже»).
   Новая версия: поменять VERSIYA — старые кэши удалятся при активации. */
'use strict';

var VERSIYA = 'pwa-v1';
var OBOLOCHKA = 'dlk-obolochka-' + VERSIYA;
var STRANICY = 'dlk-stranicy-' + VERSIYA;
var OFFLINE = '/offline.html';
var ZARANEE = [
  OFFLINE,
  '/manifest.webmanifest',
  '/ikonki/ikonka-192.png',
  '/ikonki/maskable-192.png',
  '/apple-touch-icon.png',
  '/fonts/onest-cyrillic-400.woff2',
  '/fonts/onest-cyrillic-600.woff2'
];
var MAKS_STRANIC = 40;
var NE_KESHIROVAT = /^\/(admin|tests|deploy)(\.html|\/|$)/;
var NADOLGO = /\.(?:woff2?|png|jpe?g|webp|avif|gif|ico|svg)$/i;
var OBOLOCHKA_RE = /\.(?:css|js|webmanifest)$/i;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(OBOLOCHKA).then(function (c) {
      // по одному: нет шрифта — не беда, офлайн-экран важнее
      return Promise.all(ZARANEE.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (k) {
      return Promise.all(k.filter(function (n) {
        return n.indexOf('dlk-') === 0 && n !== OBOLOCHKA && n !== STRANICY;
      }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function mozhnoKeshirovat(otv) {
  return otv && otv.ok && otv.status === 200 && otv.type === 'basic' &&
    !/no-store|private/i.test(otv.headers.get('Cache-Control') || '');
}

function obrezat(imya, maks) {
  return caches.open(imya).then(function (c) {
    return c.keys().then(function (k) {
      if (k.length <= maks) return;
      return Promise.all(k.slice(0, k.length - maks).map(function (r) { return c.delete(r); }));
    });
  });
}

// страница: сеть → копия этой страницы → офлайн-экран
function stranica(zapros, url) {
  var klyuch = url.origin + url.pathname; // без ?inn=… и #…: в кэше нет ИНН и параметров
  return fetch(zapros).then(function (otv) {
    if (mozhnoKeshirovat(otv) && !NE_KESHIROVAT.test(url.pathname)) {
      var kopiya = otv.clone();
      caches.open(STRANICY).then(function (c) {
        return c.put(klyuch, kopiya);
      }).then(function () { return obrezat(STRANICY, MAKS_STRANIC); }).catch(function () {});
    }
    return otv;
  }).catch(function () {
    return caches.match(klyuch, { cacheName: STRANICY }).then(function (s) {
      return s || caches.match(OFFLINE, { cacheName: OBOLOCHKA });
    });
  });
}

// стили и скрипты: сеть → кэш
function svezhee(zapros) {
  return fetch(zapros).then(function (otv) {
    if (mozhnoKeshirovat(otv)) {
      var kopiya = otv.clone();
      caches.open(OBOLOCHKA).then(function (c) { return c.put(zapros, kopiya); }).catch(function () {});
    }
    return otv;
  }).catch(function () {
    return caches.match(zapros, { cacheName: OBOLOCHKA }).then(function (s) {
      return s || Response.error();
    });
  });
}

// шрифты и картинки: кэш → сеть
function izKesha(zapros) {
  return caches.match(zapros, { cacheName: OBOLOCHKA }).then(function (s) {
    return s || fetch(zapros).then(function (otv) {
      if (mozhnoKeshirovat(otv)) {
        var kopiya = otv.clone();
        caches.open(OBOLOCHKA).then(function (c) { return c.put(zapros, kopiya); }).catch(function () {});
      }
      return otv;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var z = e.request;
  if (z.method !== 'GET') return;
  var url = new URL(z.url);
  if (url.origin !== self.location.origin) return; // API и чужие адреса — мимо, без кэша
  if (NE_KESHIROVAT.test(url.pathname)) return;
  if (z.mode === 'navigate') { e.respondWith(stranica(z, url)); return; }
  if (url.search) return; // запросы с параметрами — только сеть
  if (NADOLGO.test(url.pathname)) { e.respondWith(izKesha(z)); return; }
  if (OBOLOCHKA_RE.test(url.pathname)) { e.respondWith(svezhee(z)); return; }
  // остальное (json, xml, txt) — как обычно, без кэша
});
