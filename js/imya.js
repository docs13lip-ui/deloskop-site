/* Делоскоп — названия компаний с типографскими кавычками (kavychki-v1, [Ночные-3] 10.10.2026).
 * ЕГРЮЛ отдаёт названия с прямыми кавычками: ПАО "РОССЕТИ ЮГ", АО "АВИАКОМПАНИЯ "СИБИРЬ" (вложенная часто без закрывающей).
 * На экране проверки, в PDF-досье и в Паспорте показываем: ПАО «РОССЕТИ ЮГ», АО «АВИАКОМПАНИЯ „СИБИРЬ“».
 * Меняем ТОЛЬКО кавычки: буквы, регистр и порядок слов — как в реестре (это документ для дела сделки,
 * название должно совпадать с выпиской ЕГРЮЛ буква в букву). Регистр «как пишет сама компания» — только
 * на карточках /company/ (tests/kartochka_render.py, imya()), там своё правило и словарь.
 * Правило: внешние кавычки — «ёлочки», вложенные — „лапки“; незакрытые закрываем в конце; повторный вызов
 * ничего не меняет. Апостроф и обратный апостроф (О`КЕЙ) не трогаем.
 * Чистые функции, без DOM и сети — их проверяет tests/imya.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkImya = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KAV = /["\u201C\u201D\u201E\u00AB\u00BB]/; // " “ ” „ « »
  var PROBEL = /[\s\u00A0(\[\/]/;

  function kavychki(s) {
    if (s == null) return s;
    s = String(s);
    if (!KAV.test(s)) return s;
    var out = '', glub = 0, predOtkr = false; // predOtkr — предыдущий знак был открывающей кавычкой
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (!KAV.test(ch)) { out += ch; predOtkr = false; continue; }
      var pred = i > 0 ? s.charAt(i - 1) : '', sled = i + 1 < s.length ? s.charAt(i + 1) : '';
      var otkr;
      if (ch === '\u00AB' || ch === '\u201E') otkr = true;          // « „ — всегда открывают
      else if (ch === '\u00BB') otkr = false;                       // » — всегда закрывает
      else if (glub === 0) otkr = true;                             // снаружи любая прямая — открывающая
      else otkr = (pred === '' || PROBEL.test(pred) || predOtkr) && sled !== '' && !/\s/.test(sled);
      if (otkr) { out += glub === 0 ? '\u00AB' : '\u201E'; glub++; }
      else if (glub > 0) { glub--; out += glub === 0 ? '\u00BB' : '\u201C'; }
      predOtkr = otkr;
      // лишняя закрывающая без пары — выбрасываем
    }
    while (glub > 0) { glub--; out += glub === 0 ? '\u00BB' : '\u201C'; }
    return out;
  }

  // Ответ /api/check или /api/report/{id}: название в company и строки «…наименование» в разделах досье.
  // Меняет объект на месте и возвращает его же; чужие поля не трогает.
  function ispravitOtvet(r) {
    if (!r || typeof r !== 'object') return r;
    var c = r.company;
    if (c && typeof c === 'object') {
      if (typeof c.name_short === 'string') c.name_short = kavychki(c.name_short);
      if (typeof c.name_full === 'string') c.name_full = kavychki(c.name_full);
    }
    var sek = r.dossier && r.dossier.sections;
    if (Array.isArray(sek)) sek.forEach(function (x) {
      (x && Array.isArray(x.rows) ? x.rows : []).forEach(function (row) {
        if (Array.isArray(row) && typeof row[0] === 'string' && typeof row[1] === 'string' && /наименовани/i.test(row[0])) row[1] = kavychki(row[1]);
      });
    });
    return r;
  }

  return { kavychki: kavychki, ispravitOtvet: ispravitOtvet };
});
