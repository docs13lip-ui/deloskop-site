/* Делоскоп — «Ответ помог?» под выводом отчёта (pomoglo-v1, 13.11.2026).
 *
 * Один вопрос и две равные кнопки «Да» / «Нет» — под ответом живой проверки на главной (колонка вывода .ot-vt).
 * Нажатие → свой счёт событий js/schetchik.js: POST /api/ping {sobytie: "otvet_pomog_da" | "otvet_pomog_net"}.
 * Больше ничего: ни текста, ни ИНН, ни номера проверки, ни пути, ни cookie, ни хранилища браузера; Метрику не зовём.
 * Один ответ на один показ отчёта: после нажатия блок говорит «Спасибо» и больше не спрашивает.
 * Счёт выключен (DNT, GPC, робот, не наш домен — правила js/schetchik.js) — вопрос не показываем: ответ всё равно не дойдёт.
 * Своя компания («глазами банка») и пример на главной — без вопроса: считаем ответ о контрагенте, как proverka_dovedena.
 * Выключатель — VKL ниже (одна строка). Чистые функции — для автотестов: tests/pomoglo.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.DlkPomoglo = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  var VKL = true;
  var T = { vopros: "Ответ помог?", da: "Да", net: "Нет", spasibo: "Спасибо" };
  var VID = { da: "otvet_pomog_da", net: "otvet_pomog_net" };

  function vidSobytiya(otvet) { return VID[otvet] || null; }

  function html() {
    return '<p class="pmg__q" id="pmg-q">' + T.vopros + "</p>" +
      '<div class="pmg__r" role="group" aria-labelledby="pmg-q">' +
      '<button type="button" class="pmg__b" data-pmg="da">' + T.da + "</button>" +
      '<button type="button" class="pmg__b" data-pmg="net">' + T.net + "</button></div>";
  }

  // куда ставить: под выводом (колонка .ot-vt после js/otchet.js); лист не разложен — после блока вывода [data-usl]/.usl/.verdict
  function mesto(report) {
    if (!report || !report.querySelector) return null;
    var vt = report.querySelector(".ot-vt");
    if (vt) return { v: vt, posle: null };
    var u = report.querySelector(".usl") || report.querySelector(".verdict");
    return u && u.parentNode ? { v: u.parentNode, posle: u } : null;
  }

  // o: { svoj, primer } — своя компания и пример не спрашиваем; w — окно (для тестов)
  function mount(report, r, o, w) {
    o = o || {}; w = w || (typeof window !== "undefined" ? window : null);
    if (!VKL || !w || !report || o.svoj) return null;
    var inn = String(r && r.company && r.company.inn || "");
    if (!/^\d{10}(\d{2})?$/.test(inn) || /^0+$/.test(inn)) return null;
    // счёт событий не уйдёт (DNT, GPC, робот, чужой домен) — не задаём вопрос впустую
    try { if (typeof w.dlkSobytie !== "function" || (w.dlkSchitaem && !w.dlkSchitaem())) return null; } catch (e) { return null; }
    if (report.querySelector("[data-pomoglo]")) return null;
    var m = mesto(report);
    if (!m) return null;
    var doc = report.ownerDocument || w.document;
    var b = doc.createElement("div");
    b.className = "pmg"; b.setAttribute("data-pomoglo", "");
    b.innerHTML = html();
    if (m.posle) m.v.insertBefore(b, m.posle.nextSibling); else m.v.appendChild(b);
    var otvecheno = false;
    Array.prototype.forEach.call(b.querySelectorAll("[data-pmg]"), function (k) {
      k.addEventListener("click", function () {
        if (otvecheno) return;
        otvecheno = true;
        var v = vidSobytiya(k.getAttribute("data-pmg"));
        try { if (v) w.dlkSobytie(v); } catch (e) {}
        b.classList.add("pmg--ok");
        b.innerHTML = '<p class="pmg__s" role="status" tabindex="-1">' + T.spasibo + "</p>";
        try { b.firstChild.focus({ preventScroll: true }); } catch (e) {}
      });
    });
    return b;
  }

  return { VKL: VKL, T: T, VID: VID, vidSobytiya: vidSobytiya, html: html, mesto: mesto, mount: mount };
});
