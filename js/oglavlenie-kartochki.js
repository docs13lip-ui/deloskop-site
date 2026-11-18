/* oglavlenie-kartochki-v1: подсветка текущего раздела в оглавлении карточки /company/.
   Сборка печатает два списка — сбоку на компьютере (.co-og) и строкой под шапкой на телефоне (.co-ogm); без скрипта
   это обычные ссылки на разделы. Скрипт ставит aria-current пункту раздела, который сейчас под шапкой, и в строке
   телефона прокручивает её вбок так, чтобы пункт был виден. Сети нет, целей нет.
   aktivnyj(verhi, porog) — чистая функция, её проверяет tests/oglavlenie_kartochki.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkOglavlenieKartochki = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // verhi — верх каждого раздела относительно окна (по порядку страницы); текущий — последний, чей верх выше порога.
  // До первого раздела — -1 (ничего не подсвечиваем).
  function aktivnyj(verhi, porog) {
    var a = -1;
    for (var i = 0; i < (verhi || []).length; i++) {
      if (typeof verhi[i] === 'number' && verhi[i] <= porog) a = i;
    }
    return a;
  }

  function zapusk(doc, win) {
    var nav = doc.querySelector('.co-og') || doc.querySelector('.co-ogm');
    if (!nav) return;
    var ids = Array.prototype.map.call(nav.querySelectorAll('a[data-og]'), function (a) { return a.getAttribute('data-og'); });
    var sek = ids.map(function (id) {
      var h = doc.getElementById(id);
      return h ? (h.closest('section') || h) : null;
    });
    var ssylki = Array.prototype.slice.call(doc.querySelectorAll('.co-og a[data-og], .co-ogm a[data-og]'));
    var stroka = doc.querySelector('.co-ogm__l');
    var tek = null, zhdu = false;
    function porog() {
      var sh = parseFloat(win.getComputedStyle(doc.documentElement).getPropertyValue('--header-h')) || 64;
      var m = doc.querySelector('.co-ogm');
      var mh = m && m.offsetParent !== null ? m.offsetHeight : 0;
      return sh + mh + 24;
    }
    function obnovit() {
      zhdu = false;
      var i = aktivnyj(sek.map(function (s) { return s ? s.getBoundingClientRect().top : null; }), porog());
      var id = i >= 0 ? ids[i] : null;
      if (id === tek) return;
      tek = id;
      ssylki.forEach(function (a) {
        if (a.getAttribute('data-og') === id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
      if (stroka && id && stroka.offsetParent !== null) {
        var a = stroka.querySelector('a[data-og="' + id + '"]');
        if (a) {
          var li = a.parentNode, x = li.offsetLeft - (stroka.clientWidth - li.offsetWidth) / 2;
          try { stroka.scrollTo({ left: Math.max(0, x), behavior: 'smooth' }); } catch (e) { stroka.scrollLeft = Math.max(0, x); }
        }
      }
    }
    function nado() { if (!zhdu) { zhdu = true; (win.requestAnimationFrame || setTimeout)(obnovit); } }
    win.addEventListener('scroll', nado, { passive: true });
    win.addEventListener('resize', nado);
    obnovit();
  }

  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { zapusk(document, window); });
    else zapusk(document, window);
  }

  return { aktivnyj: aktivnyj };
});
