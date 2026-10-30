/* Делоскоп — «Соберите компанию сами»: ползунок возраста и строка «когда Индекс станет другим» (28.10.2026).
 * Возраст в методике — четыре ступени (до 6 мес. −12, 6–12 мес. −8, 1–3 года −2, больше 10 лет +3; 3–10 лет — без вклада).
 * Ползунок ставит ровно одну галочку возраста (раньше можно было отметить две сразу) и считает, когда компания
 * перейдёт на следующую ступень и каким станет Индекс, если остальные факты не изменятся.
 * Расчёт — тем же DeloskopIndeks.rasschitat (indeks.js), ступени — как в js/indeks-otvet.js (месяцы от регистрации).
 * Чистые функции (stupen, porog, plusMes, prognoz, tekst) — без DOM, их проверяет tests/indeks_vozrast.test.js.
 * Отдельный файл, а не правка indeks.js: indeks.js входит в пакет отчёта (js/b/otchet.*), его хеш не трогаем. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.DeloskopVozrast = api; api.zapustit(root); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = ' ';
  var VSE = ['vozrast_do_6m', 'vozrast_6_12m', 'vozrast_1_3g', 'vozrast_10g'];
  var POROGI = [6, 12, 36, 120];
  var IMYA = { 6: 'полгода', 12: 'год', 36: '3' + NB + 'года', 120: '10' + NB + 'лет' };
  var MAX = 132, PO_UMOLCHANIYU = 60;
  // шкала ползунка неравномерная: первый год — по месяцу, дальше крупнее; ступени 6, 12, 36, 120 не слипаются на 390 px
  var SHKALA = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 21, 24, 27, 30, 33, 36, 42, 48, 60, 72, 84, 96, 108, 120, 132];
  function poziciya(mes) { var i = 0; while (i < SHKALA.length - 1 && SHKALA[i] < mes) i++; return i; }
  var SERED = { vozrast_do_6m: 3, vozrast_6_12m: 8, vozrast_1_3g: 18, vozrast_10g: MAX };
  var MES = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  function stupen(mes) {
    if (mes < 6) return 'vozrast_do_6m';
    if (mes < 12) return 'vozrast_6_12m';
    if (mes < 36) return 'vozrast_1_3g';
    if (mes < 120) return null;
    return 'vozrast_10g';
  }
  function porog(mes) {
    for (var i = 0; i < POROGI.length; i++) if (POROGI[i] > mes) return POROGI[i];
    return null;
  }
  // день (UTC-полночь) + n месяцев; 31 января + 1 мес. = 28/29 февраля
  function plusMes(den, n) {
    var d = new Date(den), g = d.getUTCFullYear(), m = d.getUTCMonth() + n, c = d.getUTCDate();
    var posl = new Date(Date.UTC(g, m + 1, 0)).getUTCDate();
    return Date.UTC(g, m, Math.min(c, posl));
  }
  function segodnyaMsk(t) {
    var d = new Date((t == null ? Date.now() : t) + 3 * 3600 * 1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  function sFaktom(fakty, id) {
    var f = {}, k;
    for (k in fakty) f[k] = fakty[k];
    VSE.forEach(function (v) { f[v] = false; });
    if (id) f[id] = true;
    return f;
  }

  /* m — методика, fakty — галочки без учёта возраста, mes — возраст сегодня, den — сегодня (UTC-полночь), schet — rasschitat.
     → null (больше 10 лет: ступеней дальше нет) | { porog, dnej, data, sejchas, potom } */
  function prognoz(m, fakty, mes, den, schet) {
    var vse = {}, k;
    for (k in m.istochniki) vse[k] = true;
    var p = porog(mes);
    var sejchas = schet(m, sFaktom(fakty, stupen(mes)), vse);
    if (p == null) return { porog: null, sejchas: sejchas };
    var data = plusMes(den, p - mes);
    return { porog: p, mesSejchas: mes, dnej: Math.round((data - den) / 864e5), data: data, sejchas: sejchas,
             potom: schet(m, sFaktom(fakty, stupen(p)), vse) };
  }

  function chislo(n, f1, f2, f5) {
    var a = Math.abs(n) % 100, b = a % 10;
    return n + NB + (a > 10 && a < 20 ? f5 : b === 1 ? f1 : b > 1 && b < 5 ? f2 : f5);
  }
  function vozrastTekst(mes) {
    if (mes >= MAX) return 'больше 10' + NB + 'лет';
    if (mes < 1) return 'меньше месяца';
    var g = Math.floor(mes / 12), r = mes % 12, s = [];
    if (g) s.push(chislo(g, 'год', 'года', 'лет'));
    if (r) s.push(r + NB + 'мес.');
    return s.join(' ');
  }
  function dataTekst(t) { var d = new Date(t); return d.getUTCDate() + NB + MES[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }

  function tekst(p) {
    if (!p || p.sejchas.indeks == null) return '';
    if (p.porog == null)
      return 'Больше 10' + NB + 'лет — время уже засчитано (+3). Дальше Индекс меняют только поступки компании: отчётность, налоги, люди, долги.';
    var raz = p.porog - (p.mesSejchas == null ? p.porog : p.mesSejchas);
    var kogda = 'Через ' + (raz > 12 ? vozrastTekst(raz) : chislo(p.dnej, 'день', 'дня', 'дней')) + ', ' + dataTekst(p.data) + ', компании исполнится ' + IMYA[p.porog];
    if (p.potom.indeks == null || p.potom.indeks === p.sejchas.indeks)
      return kogda + ', но Индекс останется ' + p.sejchas.indeks + ': его держат другие сигналы, календарь их не снимет.';
    var s = kogda + ' — при тех же остальных фактах Индекс станет ' + p.potom.indeks;
    if (p.potom.uroven && p.sejchas.uroven && p.potom.uroven.id !== p.sejchas.uroven.id) s += ', «' + p.potom.uroven.nazvanie + '»';
    return s + '.';
  }

  function zapustit(w) {
    var doc = w && w.document;
    if (!doc) return;
    function start() {
      var el = doc.getElementById('kalk'), mt = doc.getElementById('metodika');
      var polz = doc.getElementById('k-vozrast'), znach = doc.querySelector('[data-k=vozrast]'), cherez = doc.querySelector('[data-k=cherez]');
      if (!el || !mt || !polz || !w.DeloskopIndeks) return;
      var m = JSON.parse(mt.textContent), box = {}, tiho = false;
      VSE.forEach(function (v) { box[v] = el.querySelector('input[value=' + v + ']'); });

      function fakty() {
        var f = {};
        el.querySelectorAll('input[type=checkbox]').forEach(function (b) { f[b.value] = b.checked; });
        return f;
      }
      function pokazat() {
        var mes = SHKALA[+polz.value];
        znach.textContent = vozrastTekst(mes);
        polz.setAttribute('aria-valuetext', vozrastTekst(mes));
        cherez.textContent = tekst(prognoz(m, fakty(), mes, segodnyaMsk(), w.DeloskopIndeks.rasschitat));
      }
      function postavit(id, istochnik) {
        var bylo = false;
        VSE.forEach(function (v) {
          if (!box[v]) return;
          var nado = v === id;
          if (box[v].checked !== nado) { box[v].checked = nado; bylo = true; }
        });
        if (bylo || istochnik) { tiho = true; (box[id] || istochnik || box.vozrast_1_3g).dispatchEvent(new w.Event('change', { bubbles: true })); tiho = false; }
      }
      polz.addEventListener('input', function () { postavit(stupen(SHKALA[+polz.value])); pokazat(); });
      VSE.forEach(function (v) {
        if (!box[v]) return;
        box[v].addEventListener('change', function () {
          if (tiho) return;
          var id = box[v].checked ? v : null;
          polz.value = poziciya(id ? SERED[v] : PO_UMOLCHANIYU);
          postavit(id, box[v]);
          pokazat();
        });
      });
      el.querySelectorAll('input[type=checkbox]').forEach(function (b) {
        if (VSE.indexOf(b.value) < 0) b.addEventListener('change', pokazat);
      });
      el.querySelectorAll('[data-preset]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = null;
          VSE.forEach(function (v) { if (box[v] && box[v].checked) id = v; });
          polz.value = poziciya(id ? SERED[id] : PO_UMOLCHANIYU);
          pokazat();
        });
      });
      pokazat();
    }
    if (doc.readyState !== 'loading') start(); else doc.addEventListener('DOMContentLoaded', start);
  }

  return { stupen: stupen, porog: porog, plusMes: plusMes, segodnyaMsk: segodnyaMsk, prognoz: prognoz, tekst: tekst,
           vozrastTekst: vozrastTekst, zapustit: zapustit, MAX: MAX, SHKALA: SHKALA, poziciya: poziciya };
});
