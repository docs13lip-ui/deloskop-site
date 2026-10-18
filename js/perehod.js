/* Делоскоп — переход «пример → отчёт» на главной (vizual-v3.1a «Инструмент», 18.10.2026).
   Визуал v3 §7, волна 3.1 (а): после «Проверить» карточка-пример превращается в отчёт той же формы на том же месте —
   View Transitions одного документа. Общие элементы: кольцо Индекса, название компании, вывод и первые три факта —
   браузер сам переводит каждый из старого места в новое; остальное — мягкая смена.
   Деградация: нет document.startViewTransition или стоит «уменьшить движение» — смена мгновенная, как раньше.
   Тексты не меняются: модуль только ставит view-transition-name на время перехода и снимает его после. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkPerehod = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // пары «пример ↔ отчёт»: имя перехода → [селектор в примере, селектор в отчёте]
  var PARY = [
    ['dlk-kolco', '.zhi__kolco', '.ot-vd .zhi__kolco'],
    ['dlk-kompaniya', '.ex-hd .company', '.ot-hd .company'],
    ['dlk-vyvod', '.ex-vt', '.ot-vt']
  ];
  var FAKTOV = 3; // первые строки фактов: .ex-f .row ↔ .sut__r
  var FAKT_PRIMER = '.ex-f .row', FAKT_OTCHET = '.rows.sut .sut__r';

  function elementy(rep) {
    if (!rep || !rep.querySelectorAll) return [];
    var ex = rep.classList.contains('ex'), out = [];
    PARY.forEach(function (p) {
      var e = rep.querySelector(ex ? p[1] : p[2]);
      if (e) out.push([p[0], e]);
    });
    var f = rep.querySelectorAll(ex ? FAKT_PRIMER : FAKT_OTCHET);
    for (var i = 0; i < f.length && i < FAKTOV; i++) out.push(['dlk-fakt-' + (i + 1), f[i]]);
    return out;
  }

  function nazvat(rep) {
    var sp = elementy(rep);
    sp.forEach(function (x) { x[1].style.viewTransitionName = x[0]; });
    return sp;
  }
  function snyat(sp) { (sp || []).forEach(function (x) { x[1].style.viewTransitionName = ''; }); }

  function tiho(w) {
    try { return !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  // mozhno(doc) — будет ли настоящий переход (а не мгновенная смена)
  function mozhno(doc) {
    var w = doc && doc.defaultView;
    return !!(w && typeof doc.startViewTransition === 'function' && !tiho(w));
  }

  // smena(rep, fn) — fn() меняет содержимое rep; если можно — внутри View Transition с общими элементами.
  // Возвращает Promise: выполняется, когда новое содержимое уже в DOM (до конца анимации; без перехода — сразу).
  // Ошибка внутри fn не теряется: уходит в window.onerror, как без перехода.
  function smena(rep, fn, doc) {
    doc = doc || (rep && rep.ownerDocument);
    if (!mozhno(doc)) { fn(); return Promise.resolve(false); }
    var staroe = nazvat(rep), novoe = [];
    var vt;
    try {
      vt = doc.startViewTransition(function () {
        snyat(staroe);
        try { fn(); } catch (e) { setTimeout(function () { throw e; }, 0); }
        novoe = nazvat(rep);
      });
    } catch (e) { snyat(staroe); fn(); return Promise.resolve(false); }
    var konec = function () { snyat(novoe); snyat(staroe); };
    if (vt.finished) vt.finished.then(konec, konec);
    var gotovo = vt.updateCallbackDone || vt.finished || Promise.resolve();
    return gotovo.then(function () { return true; }, function () { return true; });
  }

  return { smena: smena, mozhno: mozhno, elementy: elementy, PARY: PARY, FAKTOV: FAKTOV };
});
