/* Делоскоп — вторая кнопка «Следить за …» в блоке действия статьи (slezh-knopka-v1, [Ночные запуски] 04.10.2026).
 *
 * Зачем: кредитору, чей должник может попасть под исключение из ЕГРЮЛ, важна не разовая проверка, а слежение:
 * на возражение — 3 месяца (6 — по сведениям Банка России) со дня публикации (ст. 21.1, 21.3 129-ФЗ).
 * Честность (ТЗ [Продукт] 03.10 19:40 разд. 3; [Право] 03.10 20:07 разд. 2.4–2.5): пока «Слежение» не пишет писем
 * (tarify.json → slezhenie_pisma: false), кнопки нет вовсе — ни в HTML, ни скрытым текстом (фильтры поисковиков:
 * скрытого текста на страницах нет). Флаг включили — кнопка появляется на всех статьях сразу, без пересборки.
 * Где: <section class="dl" data-slezh="Текст кнопки" data-slezh-url="/cabinet.html#watch" data-slezh-cel="цель Метрики">
 * (ставит tests/sobrat_praktika.py из поля knopka.slezh в praktika/dela.json). Цель — общий обработчик a[data-goal].
 * Чистые функции — для автотестов (node): tests/slezh_knopka.test.js. */
(function (root) {
  "use strict";
  var TARIFY_URL = "/tarify/tarify.json";

  // показывать ли кнопку: только явное true в tarify.json (нет файла, ошибка, строка "true" — нет)
  function pokazat(tarify) { return !!(tarify && tarify.slezhenie_pisma === true); }
  // адрес — только свой сайт: путь от корня, без протокола и «//»
  function svoj(url) { return typeof url === "string" && /^\/(?!\/)[^\s"'<>]*$/.test(url); }

  // Вставить кнопку после главной в узле секции; повторный вызов ничего не дублирует. → вставленная ссылка | null
  function postavit(doc, sec) {
    if (!sec || sec.querySelector("a[data-slezh-knopka]")) return null;
    var t = sec.getAttribute("data-slezh"), u = sec.getAttribute("data-slezh-url"), cel = sec.getAttribute("data-slezh-cel");
    if (!t || !svoj(u)) return null;
    var a = doc.createElement("a");
    a.className = "btn btn--vtor";
    a.href = u;
    a.textContent = t;
    a.setAttribute("data-slezh-knopka", "");
    if (cel && /^[a-z0-9_]{1,40}$/.test(cel)) a.setAttribute("data-goal", cel);
    var glav = sec.querySelector("a.btn");
    if (glav && glav.parentNode === sec) sec.insertBefore(a, glav.nextSibling); else sec.appendChild(a);
    return a;
  }

  function zapusk(doc, fetchFn) {
    var sekcii = doc.querySelectorAll("[data-slezh]");
    if (!sekcii.length || !fetchFn) return Promise.resolve(0);
    return fetchFn(TARIFY_URL, { credentials: "same-origin" })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (j) {
        if (!pokazat(j)) return 0;
        var n = 0;
        for (var i = 0; i < sekcii.length; i++) if (postavit(doc, sekcii[i])) n++;
        return n;
      })
      .catch(function () { return 0; });
  }

  var api = { pokazat: pokazat, svoj: svoj, postavit: postavit, zapusk: zapusk, TARIFY_URL: TARIFY_URL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    root.dlkSlezhKnopka = api;
    var go = function () { zapusk(document, root.fetch && root.fetch.bind(root)); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
  }
})(typeof window !== "undefined" ? window : this);
