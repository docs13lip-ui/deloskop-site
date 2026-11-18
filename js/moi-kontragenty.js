/* Делоскоп — значок «Ваши контрагенты» в шапке на всех страницах (план 18.11, разд. 6 Н1, хвост).
 * Число — сколько разных компаний проверено в ЭТОМ браузере: те же два ключа, что у списка на главной (js/portfel.js) —
 * снимки dlk_snimki (js/dinamika.js) и «Недавние проверки» dlk_nedavnie (js/nedavnie.js). В сеть — ничего.
 * Нет проверок — значка нет (новому посетителю шапка не говорит о пустом списке). Ведёт на /#portfel.
 * Чистая функция schet — без DOM, её проверяет tests/moi_kontragenty.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkMoiKontragenty = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var K_SNIMKI = 'dlk_snimki', K_NEDAVNIE = 'dlk_nedavnie';
  var INN_RE = /^\d{10}(\d{2})?$/;
  var NB = ' ';

  function mn(n, f1, f2, f5) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f5;
    if (b > 1 && b < 5) return f2;
    if (b === 1) return f1;
    return f5;
  }

  // Те же правила, что Portfel.sobrat: ИНН из 10 или 12 цифр, не нули, с временем проверки; один ИНН — один раз.
  function schet(snimkiStr, nedavnieStr) {
    var po = {};
    function vzyat(inn, t) {
      inn = String(inn || '');
      if (!INN_RE.test(inn) || /^0+$/.test(inn) || !isFinite(t) || t <= 0) return;
      po[inn] = 1;
    }
    var s = null, n = null;
    try { s = JSON.parse(snimkiStr || '{}'); } catch (e) {}
    try { n = JSON.parse(nedavnieStr || '[]'); } catch (e) {}
    if (s && typeof s === 'object' && !Array.isArray(s)) {
      Object.keys(s).forEach(function (inn) {
        (Array.isArray(s[inn]) ? s[inn] : []).forEach(function (x) { if (x && String(x.inn) === inn) vzyat(inn, Number(x.t)); });
      });
    }
    (Array.isArray(n) ? n : []).forEach(function (x) { if (x) vzyat(x.inn, Number(x.t)); });
    return Object.keys(po).length;
  }

  // «Ваши контрагенты: 3 компании — проверки в этом браузере»
  function podpis(n) {
    return 'Ваши контрагенты: ' + n + NB + mn(n, 'компания', 'компании', 'компаний') + ' — проверки в' + NB + 'этом браузере';
  }
  function chislo(n) { return n > 99 ? '99+' : String(n); }

  function obnovit() {
    if (typeof document === 'undefined') return 0;
    var n = 0;
    try { n = schet(localStorage.getItem(K_SNIMKI), localStorage.getItem(K_NEDAVNIE)); } catch (e) { n = 0; }
    Array.prototype.forEach.call(document.querySelectorAll('[data-moi]'), function (el) {
      el.hidden = !n;
      if (!n) return;
      if (el.hasAttribute('data-moi-podpis')) { el.setAttribute('aria-label', podpis(n)); el.setAttribute('title', podpis(n)); }
      Array.prototype.forEach.call(el.querySelectorAll('[data-moi-n]'), function (c) { c.textContent = chislo(n); });
    });
    return n;
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    var start = function () {
      obnovit();
      Array.prototype.forEach.call(document.querySelectorAll('[data-moi]'), function (el) {
        el.addEventListener('click', function () {
          try { if (window.dlkGoal) window.dlkGoal('shapka_kontragenty', { gde: el.hasAttribute('data-moi-podpis') ? 'shapka' : 'menyu' }); } catch (e) {}
        });
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    // список поменялся: на главной (убрали, очистили), в другой вкладке, после новой проверки (запись в «Недавние» — через 1,5 с)
    window.addEventListener('deloskop:kontragenty', obnovit);
    window.addEventListener('storage', function (e) { if (!e.key || e.key === K_SNIMKI || e.key === K_NEDAVNIE) obnovit(); });
    window.addEventListener('deloskop:otvet', function () { setTimeout(obnovit, 2000); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) obnovit(); });
  }

  return { schet: schet, podpis: podpis, chislo: chislo, obnovit: obnovit, K_SNIMKI: K_SNIMKI, K_NEDAVNIE: K_NEDAVNIE };
});
