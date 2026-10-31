/* Делоскоп — складные блоки на телефоне (dover-skladnoj-v1, 31.10.2026).
   Зачем: на 390 px таблица «Откуда данные и чего мы не проверяем» на главной — 1 750 px (два экрана)
   при цели схемы А «главная ≤ 9 экранов». На телефоне сверху остаётся строка состояния
   («Сейчас: 3 работают · 4 не обновляются · 1 не подключён» — честный итог виден сразу),
   все 8 источников и ссылки «Проверить самим» — по касанию.
   Разметка: <details data-skl open><summary>…</summary>…</details>. Без JS и шире 640 px блок открыт
   (с мышью строка состояния скрыта стилями — таблица как была). Текст остаётся в разметке: поиск по
   странице и роботы его видят. Сторож — tests/dover_skladnoj.test.js. */
(function () {
  "use strict";
  if (typeof document === "undefined") return;
  var MQ = window.matchMedia ? window.matchMedia("(max-width:640px)") : null;
  function primenit() {
    var tel = !!(MQ && MQ.matches);
    var D = document.querySelectorAll("details[data-skl]");
    for (var i = 0; i < D.length; i++) D[i].open = !tel;
  }
  function start() {
    primenit();
    if (MQ) {
      if (MQ.addEventListener) MQ.addEventListener("change", primenit);
      else if (MQ.addListener) MQ.addListener(primenit);
    }
    // пришли по ссылке на источник внутри блока (#doverie открывать не нужно — строка состояния на виду)
    window.addEventListener("hashchange", function () {
      var id = (location.hash || "").slice(1);
      var el = id && document.getElementById(id);
      var d = el && el.closest ? el.closest("details[data-skl]") : null;
      if (d && d !== el) d.open = true;
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
