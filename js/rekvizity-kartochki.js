/* rekvizity-kartochki-v1: кнопка «Скопировать реквизиты» на карточке /company/.
   Сборка печатает блок «Реквизиты» (<section class="co-rekv">) и кнопку с hidden: без скрипта кнопки нет,
   строки выделяются вручную. Текст для буфера — из строк самой страницы («Подпись: значение»), строка
   «Руководитель и участники» (data-rk-bez) не копируется; в конце — источник и дата. Сети нет.
   tekst(dl, istochnik) — чистая функция, её проверяет tests/rekvizity_kartochki.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkRekvKartochki = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function chist(s) { return String(s == null ? '' : s).replace(/[\s ]+/g, ' ').trim(); }

  // stroki: [[подпись, значение, bez]] — bez = true у строк, которые не копируем
  function tekst(stroki, istochnik) {
    var t = (stroki || []).filter(function (x) { return x && !x[2] && chist(x[0]) && chist(x[1]); })
      .map(function (x) { return chist(x[0]) + ': ' + chist(x[1]); });
    if (!t.length) return '';
    var ist = chist(istochnik);
    return t.join('\n') + '\nИсточник: ' + (ist ? ist.replace(' · сведения на ', ', сведения на ') : 'ЕГРЮЛ') + ' (deloskop.ru)';
  }

  function zapusk(doc) {
    var sek = doc.querySelector('.co-rekv'), k = sek && sek.querySelector('[data-rk-kop]');
    if (!k) return;
    var ok = sek.querySelector('.co-rekv__ok'), src = sek.querySelector('.co-src');
    var stroki = Array.prototype.map.call(sek.querySelectorAll('.co-rekv__s'), function (s) {
      var dt = s.querySelector('dt'), dd = s.querySelector('dd');
      return [dt ? dt.textContent : '', dd ? dd.textContent : '', s.hasAttribute('data-rk-bez')];
    });
    var txt = tekst(stroki, src ? src.textContent : '');
    if (!txt) return;
    k.hidden = false;
    var skazat = function (s) { if (ok) { ok.textContent = s; setTimeout(function () { ok.textContent = ''; }, 2500); } };
    var ruchnoj = function () {
      try {
        var a = doc.createElement('textarea'); a.value = txt; a.setAttribute('readonly', ''); a.style.position = 'fixed'; a.style.opacity = '0';
        doc.body.appendChild(a); a.select(); var y = doc.execCommand('copy'); doc.body.removeChild(a);
        skazat(y ? 'Скопировано' : 'Не удалось скопировать — выделите строки вручную');
      } catch (e) { skazat('Не удалось скопировать — выделите строки вручную'); }
    };
    k.addEventListener('click', function () {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { skazat('Скопировано'); }, ruchnoj);
        else ruchnoj();
      } catch (e) { ruchnoj(); }
      try { if (self.dlkGoal) self.dlkGoal('kartochka_rekv_kopiya'); } catch (e) {}
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { zapusk(document); });
    else zapusk(document);
  }

  return { tekst: tekst };
});
