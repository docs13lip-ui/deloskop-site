/* Делоскоп — подпись «изменение за год» под показателями PDF-досье (report.html, блок KPI).
 * kpi-izm-v1 [команда] 11.10. Живой ответ /api/check (11.10, крупная компания): «Чистая прибыль за 2025» —
 * 11,3 млрд ₽ после убытка 1,08 трлн ₽ в 2024, а в досье стояло «▲ +101 % за год»: процент от убытка к прибыли
 * ничего не значит. Здесь — честная подпись по ряду ГИР БО (dossier.charts.profit): «из убытка в прибыль»,
 * «из прибыли в убыток», «убыток больше / меньше на N %». Типографика: настоящий минус «−», неразрывный пробел перед «%».
 * Значение убыточного года — словом «убыток …», как в таблице «Динамика» на экране проверки (js/dinamika.js).
 * Чистые функции, без DOM и сети — их проверяет tests/kpi_izm.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KpiIzm = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NB = '\u00a0', MINUS = '\u2212';

  function chislo(v) { var n = Number(v); return v != null && v !== '' && isFinite(n) ? n : null; }
  function god(label) { var m = /за (\d{4})$/.exec(String(label || '')); return m ? +m[1] : null; }
  function zaGod(ryad, g) {
    var x = (Array.isArray(ryad) ? ryad : []).filter(function (t) { return t && +t.year === g; })[0];
    return x ? chislo(x.value) : null;
  }
  function eto_pribyl(label) { return /^Чистая прибыль/i.test(String(label || '')); }
  function proc(n) { return Math.round(Math.abs(n)) + NB + '%'; }

  // x — элемент dossier.kpi { label, value, delta, good_up }, ch — dossier.charts.
  // → { tekst, ton: 'up' | 'down' | '' } | null (null — подписи нет).
  function izm(x, ch) {
    if (!x) return null;
    var d = chislo(x.delta);
    if (eto_pribyl(x.label)) {
      var g = god(x.label), pr = ch && ch.profit;
      var cur = g != null ? zaGod(pr, g) : null, prev = g != null ? zaGod(pr, g - 1) : null;
      if (cur == null) cur = chislo(x.value);
      if (cur == null) return null;
      if (prev == null) {
        // ряда нет — процент от прибыли к прибыли ещё имеет смысл, при убытке — нет
        if (d == null || cur < 0) return null;
      } else {
        if (prev < 0 && cur >= 0) return { tekst: '▲' + NB + 'из убытка в' + NB + 'прибыль', ton: 'up' };
        if (prev >= 0 && cur < 0) return { tekst: '▼' + NB + 'из прибыли в' + NB + 'убыток', ton: 'down' };
        if (prev < 0 && cur < 0) {
          if (cur === prev) return null;
          var n = (Math.abs(cur) - Math.abs(prev)) / Math.abs(prev) * 100;
          if (Math.round(n) === 0) return null;
          return n > 0 ? { tekst: '▼' + NB + 'убыток больше на' + NB + proc(n), ton: 'down' }
                       : { tekst: '▲' + NB + 'убыток меньше на' + NB + proc(n), ton: 'up' };
        }
        if (prev === 0) return null;
        d = (cur - prev) / prev * 100;
      }
    }
    if (d == null) return null;
    var r = Math.round(d);
    if (r === 0) return { tekst: 'без изменений за' + NB + 'год', ton: '' };
    var up = r > 0, good = up === (x.good_up !== false);
    return { tekst: (up ? '▲' + NB + '+' : '▼' + NB + MINUS) + proc(r) + ' за' + NB + 'год', ton: good ? 'up' : 'down' };
  }

  // Текст значения: убыток — словом, как на экране проверки. money — форматер страницы.
  function znachenie(x, money) {
    if (!x) return '—';
    if (x.text) return String(x.text);
    var v = chislo(x.value);
    if (v != null && v < 0 && eto_pribyl(x.label)) return 'убыток ' + money(-v);
    return money(x.value);
  }

  return { izm: izm, znachenie: znachenie };
});
