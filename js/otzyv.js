/* Делоскоп — «Полезно / Не понял» (beta-v1, решение владельца 29.09.2026: обратная связь — главный продукт беты).
 *
 * Один клик — оценка страницы; потом, по желанию, одна строка «что было непонятно». Без e-mail, имени и телефона:
 *   POST https://api.deloskop.ru/api/otzyv  {stranica, vid, ocenka, tekst?, rezhim}
 *   stranica — только путь (/report.html, /pasport/kontragent/, /company/…): строку запроса с ИНН не отправляем —
 *   ИНН предпринимателя — персональные данные. В тексте перед отправкой вырезаем почту, телефоны и 10–12-значные числа
 *   (сервер делает то же самое — вторая защита). Хранится у нас только отметка «эту страницу уже оценили».
 * Блок ставится сам — перед подвалом страницы, куда подключён этот файл (отчёт, Паспорт, карточка компании).
 * Сервер не ответил (до выкладки API beta-v1 — 404) — благодарим и предлагаем письмо: отзыв не теряется.
 * namerenie-v1 (04.10.2026, метрика беты М6 «намерение платить», ТЗ [Продукт] 04.10): сразу после «Да, полезно» или
 * «Не понял» — один вопрос «Перед следующей оплатой поставщику проверите его здесь же?» («Да» / «Пока нет»). Только в бете
 * и только на отчёте, Паспорте и карточке компании; один раз на страницу. Ответ — только цель Метрики namerenie_da /
 * namerenie_net с параметром {vid}; на наш сервер ничего не уходит.
 * Чистые функции — для автотестов (node): tests/otzyv.test.js, tests/beta.test.js. */
(function (root) {
  "use strict";
  var MAX = 500;
  var VIDY = { "/report.html": "otchet", "/pasport/kontragent/": "pasport", "/pasport/": "pasport" };

  function vid(path) {
    if (/^\/company\/\d{10}(-[a-z0-9-]*)?\/?$/.test(path || "")) return "kartochka";
    return VIDY[path] || "stranica";
  }
  // только путь: без ?inn=… и #…; карточка /company/ИНН/ — ИНН юрлица (10 цифр) оставляем, ИП (12) — нет
  function stranica(path) {
    var p = String(path || "/").split(/[?#]/)[0].slice(0, 120);
    return p.replace(/\/\d{12}(\/|$)/, "/ip$1");
  }
  function chistyj(t) {
    return String(t || "")
      .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[почта]")
      .replace(/(\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g, "[телефон]")
      .replace(/\b\d{10,20}\b/g, "[номер]")
      .replace(/\s+/g, " ").trim().slice(0, MAX);
  }
  // id — случайная метка одного ответа: оценка и строка текста к ней приходят двумя запросами, сервер склеивает их по id
  function novyjId() {
    var a = new Uint8Array(8);
    try { (root.crypto || require("crypto").webcrypto).getRandomValues(a); } catch (e) { for (var i = 0; i < 8; i++) a[i] = Math.random() * 256; }
    return Array.prototype.map.call(a, function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("");
  }
  function telo(path, ocenka, tekst, beta, id) {
    var b = { id: /^[0-9a-f]{16}$/.test(id || "") ? id : novyjId(), stranica: stranica(path), vid: vid(stranica(path)), ocenka: ocenka === "polezno" ? "polezno" : "neponyal", rezhim: beta ? "beta" : "rabota" };
    var t = chistyj(tekst);
    if (t) b.tekst = t;
    return b;
  }

  // namerenie-v1: тексты — дословно из ТЗ; обе кнопки равные (контуром) — ни одна не подсказывает ответ
  var NAMERENIE = {
    vopros: "Перед следующей оплатой поставщику проверите его здесь же?",
    da: "Да",
    net: "Пока нет",
    spasibo: "Спасибо — так мы поймём, что делать дальше."
  };
  var VIDY_NAMERENIYA = { otchet: 1, pasport: 1, kartochka: 1 };
  // вид страницы, если вопрос здесь нужен; иначе null (не бета, статья, уже ответили)
  function namerenieVid(path, beta, uzheOtvetili) {
    if (!beta || uzheOtvetili) return null;
    var v = vid(stranica(path));
    return VIDY_NAMERENIYA[v] ? v : null;
  }
  function namerenieCel(otvet) { return otvet === "da" ? "namerenie_da" : "namerenie_net"; }
  function namerenieParam(v) { return { vid: VIDY_NAMERENIYA[v] ? v : "stranica" }; }
  function namerenieHtml() {
    return '<p class="otz__q">' + NAMERENIE.vopros + "</p>" +
      '<div class="otz__r otz__r--n"><button type="button" class="otz__b otz__b--tiho" data-n="da">' + NAMERENIE.da + "</button>" +
      '<button type="button" class="otz__b otz__b--tiho" data-n="net">' + NAMERENIE.net + "</button></div>";
  }

  var api = { novyjId: novyjId, vid: vid, stranica: stranica, chistyj: chistyj, telo: telo, MAX: MAX,
    NAMERENIE: NAMERENIE, namerenieVid: namerenieVid, namerenieCel: namerenieCel, namerenieParam: namerenieParam, namerenieHtml: namerenieHtml };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  if (typeof document === "undefined") return;
  root.DlkOtzyv = api;

  var KLYUCH = "dlk_otzyv:";
  var API = /(^|\.)deloskop\.ru$/.test(location.hostname) ? "https://api.deloskop.ru" : "";
  var beta = !!document.querySelector('meta[name="deloskop-rezhim"][content="beta"]');
  function uzhe() { try { return !!localStorage.getItem(KLYUCH + stranica(location.pathname)); } catch (e) { return false; } }
  function zapomnit() { try { localStorage.setItem(KLYUCH + stranica(location.pathname), String(Date.now())); } catch (e) {} }
  var KLYUCH_N = "dlk_namerenie:";
  function uzheN() { try { return !!localStorage.getItem(KLYUCH_N + stranica(location.pathname)); } catch (e) { return false; } }
  function zapomnitN() { try { localStorage.setItem(KLYUCH_N + stranica(location.pathname), String(Date.now())); } catch (e) {} }
  function otpravit(b) {
    if (!API && location.protocol === "file:") return Promise.reject();
    return fetch(API + "/api/otzyv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r; });
  }
  function cel(c, p) { try { if (window.dlkGoal) window.dlkGoal(c, p); } catch (e) {} }

  var CSS = ".otz{max-width:760px;margin:48px auto 0;padding:0 clamp(16px,5vw,48px);font:400 16px/1.5 Onest,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1D1D1F}" +
    ".otz__in{display:flex;align-items:center;gap:12px 16px;flex-wrap:wrap;padding:18px 20px;border-radius:20px;background:#fff;box-shadow:0 1px 2px rgba(29,29,31,.04)}" +
    ".otz__q{flex:1 1 220px;margin:0;font-weight:600}.otz__q span{display:block;font-weight:400;font-size:14px;color:#6B6B70}" +
    ".otz__b{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border:0;border-radius:999px;background:#EAF1FD;color:#0B63E5;font-family:inherit;font-weight:600;font-size:15px;line-height:1;cursor:pointer}" +
    ".otz__b:hover{background:#DCE8FC}.otz__b--tiho{background:none;box-shadow:inset 0 0 0 1px #E6E6E1;color:#48484C}.otz__b--tiho:hover{box-shadow:inset 0 0 0 1px #1D1D1F;background:none}" +
    ".otz__f{flex:1 1 100%;display:flex;flex-direction:column;gap:8px}.otz__f textarea{width:100%;min-height:84px;padding:12px 14px;border:1px solid #E6E6E1;border-radius:14px;font:inherit;resize:vertical;box-sizing:border-box}" +
    ".otz__f textarea:focus{outline:none;border-color:#0B63E5;box-shadow:0 0 0 3px rgba(11,99,229,.18)}.otz__m{margin:0;font-size:13px;color:#6B6B70}" +
    ".otz__r{display:flex;gap:8px;flex-wrap:wrap}.otz :focus-visible{outline:3px solid #0B63E5;outline-offset:2px}" +
    ".otz__n{display:flex;align-items:center;gap:12px 16px;flex-wrap:wrap;margin-top:12px;padding:18px 20px;border-radius:20px;background:#fff;box-shadow:0 1px 2px rgba(29,29,31,.04)}" +
    ".otz__n .otz__q{font-size:16px}.otz__r--n{flex-wrap:nowrap}.otz__r--n .otz__b{min-width:96px}.otz__n .otz__s{margin:0;font-size:14px;color:#6B6B70}" +
    "@media print{.otz{display:none}}";

  function blok() {
    if (document.querySelector("[data-otzyv]")) return;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    var d = document.createElement("section");
    d.className = "otz"; d.setAttribute("data-otzyv", ""); d.setAttribute("aria-label", "Оценка страницы");
    var pod = document.querySelector(".podval");
    if (pod && pod.parentNode) pod.parentNode.insertBefore(d, pod); else document.body.appendChild(d);
    if (uzhe()) { d.innerHTML = '<div class="otz__in"><p class="otz__q">Спасибо за оценку.<span>Нашли ошибку — <a href="mailto:help@deloskop.ru">help@deloskop.ru</a>.</span></p></div>'; return; }
    d.innerHTML = '<div class="otz__in"><p class="otz__q">Полезно?<span>' + (beta ? "Идёт открытая бета — ваш ответ решает, что доделать первым." : "Ответ помогает сделать Делоскоп понятнее.") + '</span></p>' +
      '<button type="button" class="otz__b" data-o="polezno">Да, полезно</button>' +
      '<button type="button" class="otz__b otz__b--tiho" data-o="neponyal">Не понял</button></div>';
    d.querySelectorAll("[data-o]").forEach(function (b) { b.addEventListener("click", function () { ocenit(d, b.getAttribute("data-o")); }); });
  }

  function spasibo(d, ok) {
    d.querySelector(".otz__in").innerHTML = '<p class="otz__q" tabindex="-1">Спасибо! Читаем каждый ответ.' +
      (ok ? "" : '<span>Сайт не принял ответ — если не трудно, <a href="mailto:help@deloskop.ru?subject=%D0%9E%D1%82%D0%B7%D1%8B%D0%B2">напишите нам</a>.</span>') + "</p>";
    try { d.querySelector(".otz__q").focus(); } catch (e) {}
  }

  function ocenit(d, ocenka) {
    zapomnit(); cel("otzyv", { ocenka: ocenka, vid: vid(stranica(location.pathname)) });
    var id = novyjId();
    var pervyj = otpravit(telo(location.pathname, ocenka, "", beta, id));
    pervyj.catch(function () {}); // до выкладки API ответа нет — без «Uncaught (in promise)» в консоли; «Спасибо» решают обработчики ниже
    var vopros = ocenka === "polezno" ? "Что было самым полезным? Чего не хватило?" : "Что было непонятно?";
    d.querySelector(".otz__in").innerHTML = '<p class="otz__q">Спасибо!<span>' + vopros + " Одной строкой, если хотите.</span></p>" +
      '<div class="otz__f"><label class="vh" for="otz-t">' + vopros + '</label><textarea id="otz-t" maxlength="' + MAX + '" placeholder="Необязательно"></textarea>' +
      '<p class="otz__m">Без имён, телефонов и почты — ответ анонимный.</p>' +
      '<div class="otz__r"><button type="button" class="otz__b" data-go>Отправить</button><button type="button" class="otz__b otz__b--tiho" data-net>Не сейчас</button></div></div>';
    var ta = d.querySelector("textarea");
    try { ta.focus({ preventScroll: true }); } catch (e) {}
    namerenie(d);
    d.querySelector("[data-net]").addEventListener("click", function () { pervyj.then(function () { spasibo(d, true); }, function () { spasibo(d, false); }); });
    d.querySelector("[data-go]").addEventListener("click", function () {
      var t = chistyj(ta.value);
      if (!t) { pervyj.then(function () { spasibo(d, true); }, function () { spasibo(d, false); }); return; }
      otpravit(telo(location.pathname, ocenka, t, beta, id)).then(function () { spasibo(d, true); }, function () { spasibo(d, false); });
    });
  }

  // namerenie-v1: вопрос — продолжение карточки «Полезно?», ниже неё через 12 px
  function namerenie(d) {
    var v = namerenieVid(location.pathname, beta, uzheN());
    if (!v || d.querySelector("[data-namerenie]")) return;
    var n = document.createElement("div");
    n.className = "otz__n"; n.setAttribute("data-namerenie", ""); n.setAttribute("role", "group"); n.setAttribute("aria-label", "Вопрос о следующей проверке");
    n.innerHTML = namerenieHtml();
    d.appendChild(n);
    n.querySelectorAll("[data-n]").forEach(function (b) {
      b.addEventListener("click", function () {
        zapomnitN(); cel(namerenieCel(b.getAttribute("data-n")), namerenieParam(v));
        n.innerHTML = '<p class="otz__s" tabindex="-1">' + NAMERENIE.spasibo + "</p>";
        try { n.querySelector(".otz__s").focus({ preventScroll: true }); } catch (e) {}
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", blok); else blok();
})(typeof window !== "undefined" ? window : this);
