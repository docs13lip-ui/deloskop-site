/*
 * Делоскоп — «Переслать тому, кто платит» (pereslat-v1, 21.11.2026; ТЗ 17.11).
 * Бухгалтер проверил компанию — директору, который подписывает платёж, уходит короткая строка:
 *   «Проверка перед оплатой: ООО «Пример», ИНН 7700000000. Сведения на 21.11.2026. https://deloskop.ru/…»
 * В строке — только название, ИНН, дата сведений и адрес: ни вывода, ни плюсов и минусов, ни Индекса
 * (текст уходит третьему лицу — шаг 2 с выводом только после слов юристов). Только организации (ИНН из 10 цифр).
 *
 * Куда ведёт адрес (лучшее из трёх, по порядку):
 *   1) тот же отчёт по номеру проверки — /report.html?id=… : директор видит ровно то, что видел бухгалтер, на ту же дату,
 *      что в строке; сервер отдаёт сохранённый отчёт (/api/report/{id}), новой проверки и лимита 10 в день нет;
 *   2) нет номера — карточка /company/… из карты сайта (если опубликована): статичная страница, тоже без запроса к API;
 *   3) иначе — главная /?inn=… : новая проверка (у получателя — из его 10 бесплатных в день).
 * Метки: utm_source=pereslali&utm_medium=ssylka. Счёт: событие pereslal (успешно отправили или скопировали) —
 * js/schetchik.js, без ИНН; приход по ссылке (prishel_po_peresylke) считает тот же schetchik.js по метке в адресе.
 * Чистые функции — для tests/pereslat.test.js; DOM — mount(knopka, r).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Pereslat = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SAJT = 'https://deloskop.ru';
  var METKI = 'utm_source=pereslali&utm_medium=ssylka';
  var NADPIS = 'Переслать тому, кто платит';
  var GOTOVO = 'Скопировано — вставьте в чат';
  var NE_VYSHLO = 'Не получилось скопировать';

  function inn10(r) {
    var c = r && r.company;
    if (!c || c.kind === 'INDIVIDUAL') return '';
    var i = String(c.inn == null ? '' : c.inn);
    return /^\d{10}$/.test(i) ? i : '';
  }
  // Ссылка — только у организации и не у своей компании (Щит)
  function mozhno(r, svoj) { return !svoj && !!inn10(r); }

  // Дата сведений — дата проверки по Москве (checked_at: «2026-11-21» или «2026-11-21T04:07:51+03:00»)
  function data(s) {
    s = String(s == null ? '' : s).trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return m[3] + '.' + m[2] + '.' + m[1];
    var t = Date.parse(s);
    if (!isFinite(t)) return '';
    var d = new Date(t + 3 * 3600 * 1000);
    var z = function (n) { return (n < 10 ? '0' : '') + n; };
    return z(d.getUTCDate()) + '.' + z(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
  }

  // Название: короткое, кавычки — ёлочками («ООО "Ромашка"» → «ООО «Ромашка»»)
  function nazvanie(r, imya) {
    var c = (r && r.company) || {};
    var n = String(c.name_short || c.name_full || '').replace(/\s+/g, ' ').trim();
    if (!n) return '';
    if (imya && typeof imya.kavychki === 'function') { try { return imya.kavychki(n); } catch (e) { /* ниже — запасной путь */ } }
    return n.replace(/"([^"]+)"/g, '«$1»');
  }

  // Адрес для получателя (см. шапку файла); kartochki — {ИНН: '/company/…/'} из карты сайта
  function adres(r, kartochki) {
    var i = inn10(r);
    if (!i) return '';
    var id = String((r && r.report_id) || '');
    if (/^[A-Za-z0-9_-]{8,24}$/.test(id)) return SAJT + '/report.html?id=' + encodeURIComponent(id) + '&' + METKI;
    var k = kartochki && kartochki[i];
    if (k && /^\/company\/\d{10}-[a-z0-9-]+\/$/.test(k)) return SAJT + k + '?' + METKI;
    return SAJT + '/?inn=' + i + '&' + METKI;
  }

  // Строка без адреса (для navigator.share адрес идёт отдельным полем) и полная — для копирования
  function stroka(r, imya) {
    var i = inn10(r);
    if (!i) return '';
    var n = nazvanie(r, imya), d = data(r && r.checked_at);
    return 'Проверка перед оплатой: ' + (n ? n + ', ' : '') + 'ИНН ' + i + '.' + (d ? ' Сведения на ' + d + '.' : '');
  }
  function tekst(r, kartochki, imya) {
    var s = stroka(r, imya);
    return s ? s + ' ' + adres(r, kartochki) : '';
  }

  // Как отправить: на сенсорном экране с navigator.share — системное «Поделиться», иначе копирование
  function sposob(est_share, sensor, est_bufer) {
    if (est_share && sensor) return 'share';
    return est_bufer ? 'copy' : 'zapas';
  }

  function html() {
    return '<button class="ot-lnk ot-lnk--knopka" type="button" data-pereslat>' + NADPIS + '</button>';
  }

  function mount(knopka, r, o) {
    o = o || {};
    if (!knopka || !mozhno(r)) return false;
    var doc = knopka.ownerDocument, win = doc && doc.defaultView;
    if (!win) return false;
    var nav = win.navigator || {}, kart = null;
    var U = win.Usloviya;
    // карта карточек — заранее, чтобы нажатие сразу ушло в «Поделиться» (браузер разрешает его только в ответ на нажатие)
    if (U && typeof U.kartochki === 'function') { try { U.kartochki(win, function (m) { kart = m; }); } catch (e) { /* без карты — главная */ } }
    var t0 = null;
    function soobshchit(t) {
      if (!knopka.isConnected) return;
      knopka.textContent = t;
      clearTimeout(t0);
      t0 = setTimeout(function () { knopka.textContent = NADPIS; }, 3000);
    }
    function uchest() {
      try { if (typeof win.dlkSobytie === 'function') win.dlkSobytie('pereslal'); } catch (e) {}
      try { if (typeof win.dlkGoal === 'function') win.dlkGoal('pereslal'); } catch (e) {}
    }
    function zapas(t) { // старые браузеры: невидимое поле + execCommand
      try {
        var p = doc.createElement('textarea');
        p.value = t; p.setAttribute('readonly', ''); p.style.position = 'fixed'; p.style.opacity = '0';
        doc.body.appendChild(p); p.select();
        var ok = doc.execCommand && doc.execCommand('copy');
        doc.body.removeChild(p);
        return !!ok;
      } catch (e) { return false; }
    }
    knopka.setAttribute('aria-live', 'polite');
    knopka.addEventListener('click', function () {
      var imya = win.DlkImya, s = stroka(r, imya), url = adres(r, kart), vse = s + ' ' + url;
      var sensor = !!(win.matchMedia && win.matchMedia('(pointer:coarse)').matches);
      var kak = o.sposob || sposob(!!nav.share, sensor, !!(nav.clipboard && nav.clipboard.writeText));
      if (kak === 'share') {
        nav.share({ title: 'Проверка перед оплатой', text: s, url: url }).then(uchest, function () { /* закрыли окно — не считаем */ });
        return;
      }
      if (kak === 'copy') {
        nav.clipboard.writeText(vse).then(function () { soobshchit(GOTOVO); uchest(); },
          function () { if (zapas(vse)) { soobshchit(GOTOVO); uchest(); } else soobshchit(NE_VYSHLO); });
        return;
      }
      if (zapas(vse)) { soobshchit(GOTOVO); uchest(); } else soobshchit(NE_VYSHLO);
    });
    return true;
  }

  return { SAJT: SAJT, METKI: METKI, NADPIS: NADPIS, GOTOVO: GOTOVO, mozhno: mozhno, data: data, nazvanie: nazvanie,
    adres: adres, stroka: stroka, tekst: tekst, sposob: sposob, html: html, mount: mount };
});
