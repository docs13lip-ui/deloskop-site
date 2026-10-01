/*!
 * Делоскоп · расчёт ступени прямо в статье «Какие документы запросить у контрагента — по сумме сделки» (Ночные 01.10 15:05, п. 181).
 * Считает тот же js/lestnica.js, что и Паспорт контрагента. В браузере, без сети и хранилищ.
 * Цель Метрики lestnica_iz_stati — один раз за визит, при первом расчёте (только если посетитель разрешил Метрику: dlkGoal сам это проверяет).
 */
(function () {
  'use strict';
  var L = window.Lestnica, f = document.getElementById('ls'), out = document.getElementById('ls-out');
  if (!L || !f || !out) return;
  f.hidden = false;
  var cel = false;
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function nb(t) { return esc(t).replace(/(\d) (?=\d{3}\b)/g, '$1&nbsp;').replace(/(\d) (₽|%|млн|млрд|тыс)/g, '$1&nbsp;$2'); }
  function gde(g) {
    return g.length ? ' <span class="gde">' + g.map(function (x) {
      return '<a href="' + esc(x.u) + '"' + (/^https?:/.test(x.u) ? ' rel="noopener" target="_blank"' : '') + '>' + esc(x.t) + '</a>';
    }).join(' · ') + '</span>' : '';
  }
  function schitat() {
    var pr = [].map.call(f.querySelectorAll('input[name=pr]:checked'), function (x) { return x.value; });
    var r = L.stupen({ summa: f.summa.value, zakupki: f.zakupki.value, priznaki: pr });
    if (!r.n) { out.innerHTML = '<p class="ls-pusto">' + esc(r.pochemu) + '</p>'; return; }
    var h = '<p class="ls-itog"><span class="ls-n">' + r.n + '<small> из ' + r.iz + '</small></span><b>' + esc(r.nazvanie) + '</b></p>' +
      '<p class="ls-poch">' + nb(r.pochemu) + '</p>';
    if (r.nalichnye) h += '<p class="nal">' + nb(r.nalichnye) + '</p>';
    var st = 0;
    h += r.spisok.map(function (x) {
      var z = x.stupen !== st ? (st ? '</ol>' : '') + '<p class="ls-st">Ступень ' + x.stupen + '</p><ol>' : '';
      st = x.stupen;
      return z + '<li>' + nb(x.t) + gde(x.gde) + '</li>';
    }).join('') + '</ol>';
    h += '<p class="ls-dal"><a class="btn" href="/pasport/kontragent/?demo=1#rs">Собрать решение о сделке в Паспорте</a></p>';
    out.innerHTML = h;
    if (!cel && typeof window.dlkGoal === 'function') { cel = true; window.dlkGoal('lestnica_iz_stati', { stupen: r.n, statya: location.pathname }); }
  }
  f.addEventListener('input', schitat);
  f.addEventListener('change', schitat);
  f.addEventListener('submit', function (e) { e.preventDefault(); schitat(); });
  schitat();
})();
