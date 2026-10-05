/* Делоскоп — «Сколько платить вперёд: открытая формула» на /indeks/#predoplata (ТЗ [Продукт] 02.10, разд. 3).
 * Мини-расчёт считает ТЕМ ЖЕ кодом, что и отчёт: Usloviya.prepayCap из /js/usloviya.js — своей арифметики здесь нет,
 * поэтому страница и отчёт не разойдутся. Чистая функция raschet() — без DOM, её проверяет tests/predoplata_formula.test.js. */
(function (root, factory) {
  var U = typeof module === 'object' && module.exports ? require('../js/usloviya.js') : root.Usloviya;
  var api = factory(U);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Predoplata = api;
})(typeof self !== 'undefined' ? self : this, function (U) {
  'use strict';

  var NB = '\u00a0';
  // возраст — диапазоном, как в формуле; месяцы — середина диапазона (потолок от неё не зависит)
  var VOZRAST = { do6: { m: 3, t: 'до 6 месяцев' }, do12: { m: 9, t: 'до года' }, do36: { m: 24, t: 'от года до 3 лет' },
    starshe: { m: 60, t: 'старше 3 лет' }, net: { m: null, t: 'неизвестен' } };
  var VYVOD = { go: 'Можно работать', cap: 'Можно с пределом', post: 'Только по факту' };

  function rub(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽'; }

  // vvod: { vyruchka: число или null, vozrast: ключ VOZRAST, vyvod: ключ VYVOD, nol: отчёт сдан, выручки нет }
  // → { itog, shagi: [строки «как посчитали»] }
  function raschet(vvod) {
    var v = vvod || {}, voz = VOZRAST[v.vozrast] || VOZRAST.net, t = VYVOD[v.vyvod] ? v.vyvod : 'go';
    var vyr = Number(v.vyruchka) > 0 ? Number(v.vyruchka) : null;
    // галочка «Отчёт за год сдан, но выручки в нём нет» ([Данные] 05.10) — то же правило vyruchkaNol, что в отчёте
    var nol = !vyr && !!v.nol;
    var pc = U.prepayCap({ revenue: vyr, ageMonths: voz.m, vyruchkaNol: nol }, t);
    var R = pc.raschet || {}, shagi = [];
    if (t === 'post') return { itog: 0, shagi: ['Вывод «Только по факту» — вперёд не платить: оплата после поставки или акта.'] };
    if (R.base === 'nol') return { itog: 0, nol: true, shagi: ['Отчёт за год сдан, а выручки в нём нет — выручку считаем нулевой.', '0' + NB + '₽ — советуем платить по факту поставки.'] };
    if (R.base === 'revenue') {
      shagi.push('Две недели выручки: ' + rub(R.revenue) + ' ÷ ' + U.METODIKA.DELITEL + ' = ' + rub(R.dveNedeli) + '.');
      if (R.ageCapped) shagi.push('Компании меньше года — не выше потолка для её возраста: ' + rub(R.byAge) + '.');
    } else if (R.base === 'age') {
      shagi.push('Выручки нет — потолок по возрасту (' + voz.t + '): ' + rub(R.byAge) + '.');
    } else {
      shagi.push('Выручка и возраст неизвестны — осторожный потолок: ' + rub(R.byAge) + '.');
    }
    if (R.half) shagi.push('Вывод «Можно с пределом» — половина: ' + rub(R.doPolovinu / 2) + '.');
    if (R.malo) shagi.push('Меньше ' + rub(U.METODIKA.MINIMUM) + ' — ориентир не ставим: советуем платить по факту.');
    else shagi.push('Округлили вниз: ' + rub(R.itog) + '.');
    return { itog: R.itog, shagi: shagi };
  }

  function chislo(s) {
    var t = String(s || '').replace(/[\s\u00a0₽]/g, '').replace(',', '.').toLowerCase();
    var k = /млн/.test(t) ? 1e6 : /тыс/.test(t) ? 1e3 : 1;
    var n = parseFloat(t.replace(/[^\d.]/g, ''));
    return isFinite(n) && n > 0 ? n * k : null;
  }

  function mount(doc) {
    var f = doc && doc.getElementById('pk');
    if (!f || !U) return;
    var out = f.querySelector('[data-pk=itog]'), kak = f.querySelector('[data-pk=kak]');
    var nolBox = f.querySelector('[data-pk=nol]');
    function draw() {
      var vyr = chislo(f.elements.vyruchka.value);
      if (nolBox) nolBox.hidden = !!vyr;                  // галочка — только когда выручка пустая или 0
      var r = raschet({ vyruchka: vyr, vozrast: f.elements.vozrast.value, vyvod: f.elements.vyvod.value, nol: !vyr && f.elements.nol && f.elements.nol.checked });
      out.textContent = r.itog ? rub(r.itog) : '0' + NB + '₽';
      kak.innerHTML = '';
      r.shagi.forEach(function (s) { var li = doc.createElement('li'); li.textContent = s; kak.appendChild(li); });
    }
    f.addEventListener('input', draw);
    f.addEventListener('change', draw);
    f.addEventListener('submit', function (e) { e.preventDefault(); draw(); });
    draw();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(document); });
    else mount(document);
  }
  return { raschet: raschet, chislo: chislo, VOZRAST: VOZRAST, VYVOD: VYVOD };
});
