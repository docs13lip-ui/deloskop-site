/* vozrast-segodnya-v1: возраст компании на карточке — на сегодня.
   Сборка пишет число на свой день по Москве: <span class="vozr" data-s="ГГГГ-ММ-ДД">24&nbsp;года</span>.
   Здесь — пересчёт на сегодняшний день по Москве, только вперёд и не больше чем на 2 года
   (сбитые часы посетителя не должны «состарить» или «омолодить» компанию). */
(function (koren) {
  'use strict';

  function slovo(n) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return 'лет';
    if (b > 1 && b < 5) return 'года';
    if (b === 1) return 'год';
    return 'лет';
  }

  function segodnyaMsk(ms) {
    var d = new Date(ms + 3 * 3600e3);
    return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
  }

  function let_(s, na) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    var g = +m[1], mm = +m[2], dd = +m[3];
    var n = na[0] - g - ((na[1] < mm || (na[1] === mm && na[2] < dd)) ? 1 : 0);
    return n >= 0 ? n : null;
  }

  function obnovit(el, ms) {
    var bylo = parseInt(el.textContent, 10);
    var n = let_(el.getAttribute('data-s'), segodnyaMsk(ms));
    if (n === null || isNaN(bylo) || n <= bylo || n > bylo + 2) return false;
    el.textContent = n + ' ' + slovo(n);
    return true;
  }

  function vse(doc, ms) {
    var spisok = doc.querySelectorAll('span.vozr[data-s]'), k = 0;
    for (var i = 0; i < spisok.length; i++) if (obnovit(spisok[i], ms)) k++;
    return k;
  }

  var api = { slovo: slovo, segodnyaMsk: segodnyaMsk, let_: let_, obnovit: obnovit, vse: vse };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  koren.DlkVozrast = api;
  function start() { try { vse(document, Date.now()); } catch (e) { /* возраст из сборки остаётся */ } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof window !== 'undefined' ? window : this);
