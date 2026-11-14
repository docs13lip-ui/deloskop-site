/* Делоскоп — знак на главной (znak-glavnaya-v1, 14.11.2026; было: poisk-v2-c «линза поиска» — два кольца, 13.11).
 *
 * Над заголовком главной — знак № 27 «лупа-галочка» (выбор владельца 14.11): короткое плечо — футляр (--ink),
 * длинное — линза (латунь), в кольце — стекло. Знак плоский, одним силуэтом, как в шапке (решение 14.11, круг 7:
 * «строгий плоский знак, объём — для рекламы и заставки»); живёт движением — тоже решение 14.11 («линза выходит
 * из футляра — на открытие сайта и на готовый ответ»):
 *  • открытие страницы — линза раскрывается из футляра (CSS, без скрипта; «уменьшить движение» — сразу открыта);
 *  • человек печатает — линза «водит» (1,6 с после последней буквы, потом замирает);
 *  • распознали ввод (ИНН с верной контрольной цифрой, счёт и БИК, реквизиты) — линза встаёт ровно, в стекле вспыхивает блик;
 *  • опечатка — линза отклоняется и берёт цвет --warn; Enter или «Проверить» — от кольца расходится волна.
 * Весь рисунок и движение — в разметке и стилях index.html (.lp); скрипт только ставит data-sost, data-pechat и класс волны.
 * Состояние берём из того же разбора, что строка (DlkPoisk.razobrat): ни текст, ни ИНН никуда не уходят.
 * Чистая функция sostoyanie() — для автотестов (node): tests/linza_poisk.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.DlkLinzaPoisk = api; if (root.document) api.start(root); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- состояние: ждёт / ввод / распознано / опечатка ----------
  // R — ответ DlkPoisk.razobrat (или null); q — текст строки. → { sost, F } — F от 0 (пусто) до 1 (распознано)
  function sostoyanie(R, q) {
    var t = String(q == null ? '' : q).replace(/\s+/g, ' ').trim();
    if (!t) return { sost: 'zhdet', F: 0 };
    // «не хватает цифр» и «цифр пока не столько» — человек ещё печатает, это не опечатка
    if (R && R.err && R.vid !== 'malo_cifr' && R.vid !== 'cifry') return { sost: 'opechatka', F: Math.min(0.85, 0.35 + t.length / 16) };
    if (R && R.exact) return { sost: 'raspoznano', F: 1 };
    return { sost: 'vvod', F: Math.min(0.9, 0.35 + t.length / 16) };
  }

  // пауза после последней буквы, после которой линза перестаёт «водить»
  var TIHO_MS = 1600;

  function start(win) {
    var doc = win.document, el = doc.querySelector('.lp');
    var input = doc.getElementById('inn'), form = doc.getElementById('check');
    if (!el || el.getAttribute('data-lp-gotovo')) return;
    el.setAttribute('data-lp-gotovo', '1');
    var tiho = 0, volna = 0;

    function obnovit(pechat) {
      var P0 = win.DlkPoisk, v = input ? input.value : '';
      var st = sostoyanie(P0 && v.trim() ? P0.razobrat(v, []) : null, v);
      if (el.getAttribute('data-sost') !== st.sost) el.setAttribute('data-sost', st.sost);
      if (pechat && st.sost === 'vvod') {
        el.setAttribute('data-pechat', '');
        win.clearTimeout(tiho);
        tiho = win.setTimeout(function () { el.removeAttribute('data-pechat'); }, TIHO_MS);
      } else if (st.sost !== 'vvod') el.removeAttribute('data-pechat');
    }
    // волна: класс снимаем и ставим заново через кадр — анимация начинается с начала при каждом нажатии
    function puls() {
      el.classList.remove('lp--puls');
      win.cancelAnimationFrame(volna);
      volna = win.requestAnimationFrame(function () { el.classList.add('lp--puls'); });
    }
    if (input) {
      input.addEventListener('input', function () { obnovit(true); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') puls(); });
    }
    if (form) form.addEventListener('submit', puls, true);
    el.addEventListener('animationend', function (e) { if (e.animationName === 'lp-volna') el.classList.remove('lp--puls'); });
    obnovit(false);
  }

  return { sostoyanie: sostoyanie, start: start, TIHO_MS: TIHO_MS };
});
