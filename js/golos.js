/* Делоскоп — «Голос клиента» (golos-klienta-v1, решение команды 12.10.2026 ~18:40, разд. 2 пп. 1 и 3).
 *
 * Два места, оба — только для вошедших:
 *   1) кабинет — карточка «Чего не хватает в Делоскопе?»: темы-кнопки + строка своими словами, одно действие «Отправить»;
 *   2) под отчётом проверки — одна строка «Что добавить в отчёт?»: после 3-й разной компании на этом устройстве
 *      и не чаще раза в 30 дней (закрыли «Не сейчас» — тоже 30 дней тишины).
 * Отправка — тот же POST https://api.deloskop.ru/api/otzyv, что у «Полезно?» (js/otzyv.js), с cookie входа
 * (связь с аккаунтом — только на сервере, по id сессии; почту и имя сайт не отправляет):
 *   {id, stranica, vid: "kabinet" | "otchet", ocenka: "golos", tema: "sudy,bank" | "", tekst?, rezhim: "rabota"}
 * В тексте до отправки вырезаем почту, телефоны и 10–20-значные числа (ИНН предпринимателя — персональные данные) —
 * та же чистка, что в otzyv.js (тест сверяет). Сервер не принял ответ (до выкладки API — 422) — отзыв не теряется:
 * предлагаем письмо на help@ с уже подставленным текстом.
 * На устройстве храним только счётчик разных компаний, отпечаток последней (не ИНН) и дату последнего вопроса.
 * Чистые функции — для автотестов (node): tests/golos.test.js. */
(function (root) {
  "use strict";
  var MAX = 500;
  var DEN = 864e5, PAUZA_DNEJ = 30, POSLE_KOMPANIJ = 3;
  // порядок — из решения команды 12.10; ключи уходят на сервер, подписи — только на экран
  var TEMY = [
    { k: "sudy", t: "Суды и банкротства" },
    { k: "bank", t: "Отчёт для банка" },
    { k: "1s", t: "Выписка из 1С целиком" },
    { k: "slezhenie", t: "Слежение за контрагентами" },
    { k: "api", t: "API и выгрузка" },
    { k: "drugoe", t: "Другое" }
  ];
  var KLYUCHI = TEMY.reduce(function (o, x) { o[x.k] = 1; return o; }, {});
  var T = {
    kabZag: "Чего не хватает в Делоскопе?",
    kabPod: "Отметьте, что пригодилось бы в вашей работе, — по этим ответам решаем, что делать первым.",
    pole: "Своими словами — необязательно",
    chistka: "Телефоны, почту и номера уберём из текста ещё до отправки. Ответ читает только команда Делоскопа.",
    otpravit: "Отправить",
    spasibo: "Спасибо, получили.",
    spasiboPod: "Что сделаем по таким просьбам, появится в «Что нового».",
    ne: "Сайт не принял ответ.",
    nePod: "Отправьте его письмом — текст уже подставлен:",
    pismo: "Написать на help@deloskop.ru",
    otchZag: "Что добавить в отчёт?",
    otchPod: "Одной строкой — читаем каждую.",
    otchPole: "Например, суды за пять лет",
    nesejchas: "Не сейчас"
  };

  function chistyj(t) {
    return String(t || "")
      .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[почта]")
      .replace(/(\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g, "[телефон]")
      .replace(/\b\d{10,20}\b/g, "[номер]")
      .replace(/\s+/g, " ").trim().slice(0, MAX);
  }
  // только известные ключи, без повторов, в порядке списка
  function tema(vybrano) {
    var s = {};
    (vybrano || []).forEach(function (k) { if (KLYUCHI[k]) s[k] = 1; });
    return TEMY.filter(function (x) { return s[x.k]; }).map(function (x) { return x.k; }).join(",");
  }
  function novyjId() {
    var a = new Uint8Array(8);
    try { (root.crypto || require("crypto").webcrypto).getRandomValues(a); } catch (e) { for (var i = 0; i < 8; i++) a[i] = Math.random() * 256; }
    return Array.prototype.map.call(a, function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("");
  }
  // vid: kabinet | otchet; пустой ответ (ни темы, ни текста) — null: отправлять нечего
  function telo(vid, vybrano, tekst, id) {
    var b = { id: /^[0-9a-f]{16}$/.test(id || "") ? id : novyjId(), stranica: vid === "kabinet" ? "/cabinet.html" : "/",
      vid: vid === "kabinet" ? "kabinet" : "otchet", ocenka: "golos", tema: tema(vybrano), rezhim: "rabota" };
    var t = chistyj(tekst);
    if (t) b.tekst = t;
    return b.tema || b.tekst ? b : null;
  }
  // письмо вместо формы, если сервер не принял: тема письма и текст — уже очищенные
  function mailto(b) {
    var podpisi = (b.tema ? b.tema.split(",") : []).map(function (k) { for (var i = 0; i < TEMY.length; i++) if (TEMY[i].k === k) return TEMY[i].t; return k; });
    var telo = (b.vid === "kabinet" ? "Чего не хватает: " : "Что добавить в отчёт: ") +
      (podpisi.length ? podpisi.join(", ") : "") + (podpisi.length && b.tekst ? ". " : "") + (b.tekst || "");
    return "mailto:help@deloskop.ru?subject=" + encodeURIComponent(b.vid === "kabinet" ? "Чего не хватает в Делоскопе" : "Что добавить в отчёт") +
      "&body=" + encodeURIComponent(telo);
  }
  // отпечаток ИНН — короткий, по нему ИНН не восстановить (нужен только «та же компания или другая»)
  function otpechatok(inn) {
    var s = String(inn || ""), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return (h % 4096).toString(36);
  }
  // состояние устройства {n, p, t}: n — разных компаний подряд, p — отпечаток последней, t — когда последний раз спрашивали
  function uchest(sost, inn) {
    var s = { n: +(sost && sost.n) || 0, p: (sost && sost.p) || "", t: +(sost && sost.t) || 0 };
    var o = otpechatok(inn);
    if (inn && o !== s.p) { s.n += 1; s.p = o; }
    return s;
  }
  function pokazat(sost, voshel, seichas) {
    if (!voshel || !sost) return false;
    if ((+sost.n || 0) < POSLE_KOMPANIJ) return false;
    return !sost.t || (seichas - sost.t) >= PAUZA_DNEJ * DEN;
  }

  var api = { TEMY: TEMY, T: T, MAX: MAX, PAUZA_DNEJ: PAUZA_DNEJ, POSLE_KOMPANIJ: POSLE_KOMPANIJ,
    chistyj: chistyj, tema: tema, telo: telo, mailto: mailto, otpechatok: otpechatok, uchest: uchest, pokazat: pokazat, novyjId: novyjId };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  if (typeof document === "undefined") return;
  root.DlkGolos = api;

  var KLYUCH = "dlk_golos";
  function prochest() { try { return JSON.parse(localStorage.getItem(KLYUCH) || "null") || {}; } catch (e) { return {}; } }
  function zapisat(s) { try { localStorage.setItem(KLYUCH, JSON.stringify(s)); } catch (e) {} }
  function voshel() { try { return localStorage.getItem("dlk_voshel") === "1"; } catch (e) { return false; } }
  function cel(c, p) { try { if (window.dlkGoal) window.dlkGoal(c, p); } catch (e) {} }
  function apiUrl(o) { return (o && o.api != null) ? String(o.api) : (/(^|\.)deloskop\.ru$/.test(location.hostname) ? "https://api.deloskop.ru" : ""); }
  function otpravit(u, b) {
    if (!u) return Promise.reject(new Error("net api"));
    return fetch(u + "/api/otzyv", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r; });
  }

  var CSS = ".golos__temy{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0;padding:0;list-style:none}" +
    ".golos__t{min-height:40px;padding:0 16px;border:1px solid #D9D9D4;border-radius:999px;background:#fff;color:#1D1D1F;font:inherit;font-size:14px;font-weight:500;cursor:pointer}" +
    ".golos__t:hover{border-color:#0B63E5}.golos__t[aria-pressed=true]{background:#EAF1FD;border-color:#0B63E5;color:#0B63E5}" +
    ".golos__t[aria-pressed=true]::before{content:\"✓\\00a0\"}" +
    ".golos textarea,.golos__in{width:100%;margin:12px 0 0;padding:12px 14px;border:1px solid #D9D9D4;border-radius:12px;font:inherit;font-size:16px;color:#1D1D1F;background:#fff;box-sizing:border-box}" +
    ".golos textarea{min-height:76px;resize:vertical}" +
    ".golos textarea:focus,.golos__in:focus{outline:2px solid #0B63E5;outline-offset:1px;border-color:#0B63E5}" +
    ".golos__m{margin:8px 0 0;font-size:13px;line-height:1.45;color:#6B6B70}" +
    ".golos__r{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:14px}" +
    ".golos__ok{margin:0;font-weight:600}.golos__ok span{display:block;font-weight:400;font-size:14px;color:#48484C}" +
    ".golos :focus-visible{outline:3px solid #0B63E5;outline-offset:2px}" +
    ".golos--otchet{margin:20px 0 0;padding:18px 20px;border-radius:18px;background:#F5F5F2}" +
    ".golos--otchet .golos__z{margin:0;font-weight:600;font-size:16px}.golos--otchet .golos__z span{display:block;font-weight:400;font-size:14px;color:#6B6B70}" +
    ".golos__b{min-height:44px;padding:0 18px;border:0;border-radius:12px;background:#0B63E5;color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer}" +
    ".golos__b:disabled{opacity:.45;cursor:default}.golos__b--tiho{background:none;color:#48484C;box-shadow:inset 0 0 0 1px #D9D9D4}" +
    "@media print{.golos{display:none}}";
  function stil() {
    if (document.querySelector("style[data-golos]")) return;
    var s = document.createElement("style"); s.setAttribute("data-golos", ""); s.textContent = CSS; document.head.appendChild(s);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function itog(box, ok, b) {
    box.innerHTML = ok
      ? '<p class="golos__ok" tabindex="-1">' + T.spasibo + "<span>" + T.spasiboPod + "</span></p>"
      : '<p class="golos__ok" tabindex="-1">' + T.ne + "<span>" + T.nePod + ' <a href="' + esc(mailto(b)) + '">' + T.pismo + "</a></span></p>";
    try { box.querySelector(".golos__ok").focus(); } catch (e) {}
  }

  // 1) кабинет: el — пустой <section class="card" id="golos">
  function kabinet(el, o) {
    if (!el || el.getAttribute("data-golos-gotov")) return;
    el.setAttribute("data-golos-gotov", ""); stil();
    el.classList.add("golos");
    el.innerHTML = '<h2 id="golos-z">' + T.kabZag + '</h2><p class="sub" style="margin:0">' + T.kabPod + "</p>" +
      '<div class="golos__box"><ul class="golos__temy" role="group" aria-labelledby="golos-z">' +
      TEMY.map(function (x) { return '<li><button type="button" class="golos__t" aria-pressed="false" data-tema="' + x.k + '">' + x.t + "</button></li>"; }).join("") + "</ul>" +
      '<label class="vh" for="golos-t">' + T.pole + '</label><textarea id="golos-t" maxlength="' + MAX + '" placeholder="' + T.pole + '"></textarea>' +
      '<p class="golos__m">' + T.chistka + "</p>" +
      '<div class="golos__r"><button type="button" class="btn primary" data-golos-go disabled>' + T.otpravit + "</button></div></div>";
    el.hidden = false;
    var box = el.querySelector(".golos__box"), ta = el.querySelector("textarea"), go = el.querySelector("[data-golos-go]");
    function vybrano() { return Array.prototype.map.call(el.querySelectorAll('[aria-pressed="true"]'), function (b) { return b.getAttribute("data-tema"); }); }
    function obnovit() { go.disabled = !telo("kabinet", vybrano(), ta.value); }
    el.querySelectorAll("[data-tema]").forEach(function (b) {
      b.addEventListener("click", function () { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); obnovit(); });
    });
    ta.addEventListener("input", obnovit);
    go.addEventListener("click", function () {
      var b = telo("kabinet", vybrano(), ta.value);
      if (!b) return;
      go.disabled = true;
      cel("golos_otpravlen", { vid: "kabinet", tema: b.tema || "tekst" });
      otpravit(apiUrl(o), b).then(function () { itog(box, true, b); }, function () { itog(box, false, b); });
    });
  }

  // 2) под отчётом: report — контейнер отчёта, r — ответ /api/check. Возвращает true, если строку показали.
  function posleProverki(report, r, o) {
    o = o || {};
    if (!report || !r) return false;
    var inn = r.company && r.company.inn;
    var s = uchest(prochest(), inn);
    var seichas = o.seichas || Date.now();
    var vsh = o.voshel != null ? !!o.voshel : voshel();
    var nado = pokazat(s, vsh, seichas);
    if (nado) s.t = seichas; // спросили — следующие 30 дней молчим, ответят или нет
    zapisat(s);
    if (!nado || report.querySelector("[data-golos-otchet]")) return false;
    stil();
    var d = document.createElement("section");
    d.className = "golos golos--otchet"; d.setAttribute("data-golos-otchet", ""); d.setAttribute("aria-label", T.otchZag);
    d.innerHTML = '<div class="golos__box"><p class="golos__z">' + T.otchZag + "<span>" + T.otchPod + "</span></p>" +
      '<label class="vh" for="golos-o">' + T.otchZag + '</label><input class="golos__in" id="golos-o" type="text" maxlength="' + MAX + '" placeholder="' + T.otchPole + '" autocomplete="off">' +
      '<div class="golos__r"><button type="button" class="golos__b" data-golos-go disabled>' + T.otpravit + '</button><button type="button" class="golos__b golos__b--tiho" data-golos-net>' + T.nesejchas + "</button></div></div>";
    report.appendChild(d);
    var box = d.querySelector(".golos__box"), inp = d.querySelector("input"), go = d.querySelector("[data-golos-go]");
    inp.addEventListener("input", function () { go.disabled = !chistyj(inp.value); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter" && !go.disabled) { e.preventDefault(); go.click(); } });
    d.querySelector("[data-golos-net]").addEventListener("click", function () { cel("golos_nesejchas", { vid: "otchet" }); d.remove(); });
    go.addEventListener("click", function () {
      var b = telo("otchet", [], inp.value);
      if (!b) return;
      go.disabled = true;
      cel("golos_otpravlen", { vid: "otchet", tema: "tekst" });
      otpravit(apiUrl(o), b).then(function () { itog(box, true, b); }, function () { itog(box, false, b); });
    });
    cel("golos_pokaz", { vid: "otchet" });
    return true;
  }
  api.kabinet = kabinet;
  api.posleProverki = posleProverki;
})(typeof window !== "undefined" ? window : this);
