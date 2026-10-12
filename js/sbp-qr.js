/* Делоскоп — оплата по QR СБП (Альфа-Банк, «СБП QR на оплату»). sbp-qr-v1, 12.10.2026.
   Оплата по QR — сразу, чеки — следующим шагом (решение команды 12.10).
   Статический QR: сумму вводит плательщик, номер счёта он пишет в комментарии; деньги приходят на р/с ИП в Альфа-Банке.
   SSYLKA пустая — блока нет нигде (мёртвых кнопок на сайте не держим). Ссылку даёт банк после создания QR (qr.nspk.ru/…).
   Картинку рисует js/qr-platezh.js (DeloskopQR.svg) — тот же кодировщик, что и у QR по ГОСТ на счёте.
   Тест: node --test tests/sbp_qr.test.js */
(function (root) {
  "use strict";

  var SSYLKA = "https://qr.nspk.ru/AS1A002VR3AE0FJH9QBR6JJT2S0SR4L6";

  function ssylka() {
    var s = (root.DELOSKOP_SBP_SSYLKA != null ? root.DELOSKOP_SBP_SSYLKA : SSYLKA) || "";
    return /^https:\/\/qr\.nspk\.ru\/[A-Za-z0-9]{20,40}(\?[A-Za-z0-9=&%._-]*)?$/.test(s) ? s : "";
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function rub(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽"; }

  // o: { summa — рубли, nomer — номер счёта, kommentarij — что написать в комментарии (по умолчанию номер счёта) }.
  // Без ссылки или без кодировщика — пустая строка.
  function html(o) {
    o = o || {};
    var s = ssylka(), Q = root.DeloskopQR;
    if (!s || !Q || !Q.svg) return "";
    var kartinka = Q.svg(s, "QR-код СБП для оплаты" + (o.nomer ? " счёта № " + esc(o.nomer) : ""));
    if (!kartinka) return "";
    var kom = o.kommentarij || (o.nomer ? "номер счёта <b>" + esc(o.nomer) + "</b>" : "");
    var shagi = (o.summa > 0 ? "Введите сумму <b>" + rub(o.summa) + "</b>" : "Введите сумму") + (kom ? ", в комментарии — " + kom + "." : ".");
    return '<div class="sbp" data-sbp><div class="sbp__k">' + kartinka + '</div><div class="sbp__t">' +
      "<b>" + esc(o.zagolovok || "Оплата по СБП") + "</b>" +
      "Наведите камеру телефона на код или откройте приложение банка → «Оплата по QR». " + shagi +
      " Без комиссии, деньги приходят сразу." +
      '<a class="sbp__a" href="' + esc(s) + '" rel="noopener" data-goal="oplata_sbp">Оплатить по СБП с телефона</a></div></div>';
  }

  var api = { ssylka: ssylka, html: html, rub: rub };
  root.DeloskopSBP = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
