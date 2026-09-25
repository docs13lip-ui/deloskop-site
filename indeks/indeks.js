/* Индекс Делоскопа — калькулятор на странице методики.
   Считает по тем же правилам, что и сервер (indeks_v1.py); методика — в JSON на странице.
   Тест совпадения с Python: tests/indeks.test.mjs */
(function (root) {
  'use strict';

  function rasschitat(m, fakty, dostupno) {
    var sh = m.shkala, ist = m.istochniki, polnota = 0, k;
    for (k in ist) if (dostupno[k]) polnota += ist[k].ves_polnoty;
    for (var i = 0; i < m.polnota.minimum_dlya_rascheta.length; i++)
      if (!dostupno[m.polnota.minimum_dlya_rascheta[i]]) return { indeks: null, uroven: null, stop: null, polnota: polnota, vklady: [] };
    for (i = 0; i < m.stop.length; i++)
      if (fakty[m.stop[i].id]) return { indeks: null, uroven: { id: 'stop', nazvanie: 'Стоп', ton: 'red', tekst: m.stop[i].tekst }, stop: m.stop[i], polnota: polnota, vklady: [] };
    var vklady = [], plyusy = 0, minusy = 0, potolki = [];
    m.faktory.forEach(function (f) {
      if (!fakty[f.id] || !dostupno[f.istochnik]) return;
      vklady.push({ id: f.id, vklad: f.vklad, tekst: f.tekst, pochemu: f.pochemu, gruppa: f.gruppa });
      if (f.vklad > 0) plyusy += f.vklad; else minusy += f.vklad;
      if (f.potolok != null) potolki.push([f.potolok, f.tekst]);
    });
    var pu = Math.min(plyusy, m.plyusy_maksimum);
    var indeks = Math.max(sh.min, Math.min(sh.max, sh.baza + minusy + pu)), potolok = null;
    potolki.sort(function (a, b) { return a[0] - b[0]; });
    if (potolki.length && indeks > potolki[0][0]) { indeks = potolki[0][0]; potolok = { znachenie: indeks, prichina: potolki[0][1] }; }
    var sokr = polnota < m.polnota.porog_sokrashchennoj;
    if (sokr && indeks > m.polnota.potolok_sokrashchennoj) {
      indeks = m.polnota.potolok_sokrashchennoj;
      potolok = potolok || { znachenie: indeks, prichina: 'Оценка по сокращённым данным' };
    }
    vklady.sort(function (a, b) { return (a.vklad > 0) - (b.vklad > 0) || a.vklad - b.vklad; });
    var u = m.urovni.filter(function (x) { return x.ot <= indeks && indeks <= x.do; })[0];
    return { indeks: indeks, uroven: u, stop: null, polnota: polnota, sokrashchennaya: sokr, minusy: minusy,
             plyusy: plyusy, plyusy_uchteno: pu, potolok: potolok, vklady: vklady };
  }

  function minus(n) { return (n > 0 ? '+' : '−') + Math.abs(n); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var PRESETY = {
    zavod: ['vozrast_10g', 'shtat_10', 'likvidnost_vysokaya', 'goskontrakty', 'iski_est'],
    tehnicheskaya: ['vozrast_do_6m', 'massovyj_rukovoditel', 'shtat_0_1', 'nalogi_nol', 'nedostovernyj_adres'],
    startap: ['vozrast_6_12m', 'shtat_0_1', 'net_buhotchetnosti'],
    ustalaya: ['vozrast_10g', 'ubytok_2_goda', 'chistye_aktivy_minus', 'nedoimka', 'iski_krupnye']
  };

  function zapustit(doc) {
    var el = doc.getElementById('kalk');
    if (!el) return;
    var m = JSON.parse(doc.getElementById('metodika').textContent);
    var vse = {}; for (var k in m.istochniki) vse[k] = true;
    var box = el.querySelectorAll('input[type=checkbox]');
    var chislo = el.querySelector('[data-k=chislo]'), nazv = el.querySelector('[data-k=uroven]'),
        tekst = el.querySelector('[data-k=tekst]'), ukaz = el.querySelector('[data-k=ukazatel]'),
        raskl = el.querySelector('[data-k=rasklad]'), kart = el.querySelector('.k-itog');

    function obnovit() {
      var f = {};
      box.forEach(function (b) { f[b.value] = b.checked; });
      var r = rasschitat(m, f, vse);
      kart.setAttribute('data-ton', r.uroven.ton);
      if (r.indeks == null) {
        chislo.textContent = 'Стоп'; nazv.textContent = r.stop.tekst;
        tekst.textContent = 'Индекс не считаем: с ликвидируемой или банкротящейся компанией работать нельзя.';
        ukaz.style.left = '0%'; raskl.innerHTML = ''; return;
      }
      chislo.textContent = r.indeks; nazv.textContent = r.uroven.nazvanie; tekst.textContent = r.uroven.tekst;
      ukaz.style.left = ((r.indeks - 1) / 98 * 100) + '%';
      var h = '<li><span>База</span><b>' + m.shkala.baza + '</b></li>';
      r.vklady.forEach(function (v) { h += '<li class="' + (v.vklad < 0 ? 'm' : 'p') + '"><span>' + esc(v.tekst) + '</span><b>' + minus(v.vklad) + '</b></li>'; });
      if (r.plyusy > r.plyusy_uchteno) h += '<li class="n"><span>Плюсов больше +' + m.plyusy_maksimum + ' не засчитываем</span><b>' + minus(r.plyusy_uchteno - r.plyusy) + '</b></li>';
      if (r.potolok) h += '<li class="n"><span>Потолок: ' + esc(r.potolok.prichina.toLowerCase()) + '</span><b>≤ ' + r.potolok.znachenie + '</b></li>';
      h += '<li class="i"><span>Индекс</span><b>' + r.indeks + '</b></li>';
      raskl.innerHTML = h;
    }
    box.forEach(function (b) { b.addEventListener('change', obnovit); });
    el.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = PRESETY[btn.getAttribute('data-preset')] || [];
        box.forEach(function (b) { b.checked = p.indexOf(b.value) >= 0; });
        el.querySelectorAll('[data-preset]').forEach(function (x) { x.setAttribute('aria-pressed', x === btn ? 'true' : 'false'); });
        obnovit();
      });
    });
    obnovit();
  }

  var api = { rasschitat: rasschitat, PRESETY: PRESETY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.DeloskopIndeks = api; if (root.document) { if (document.readyState !== 'loading') zapustit(document); else document.addEventListener('DOMContentLoaded', function () { zapustit(document); }); } }
})(typeof window !== 'undefined' ? window : this);
