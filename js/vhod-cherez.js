/* Делоскоп — вход через Яндекс ID и VK ID (vhody-v2-sait).
   Кнопки появляются, только когда сервер сам говорит, что ключи провайдера вставлены:
   GET /api/auth/vhody → {"yandex": true, "vk": false}. Нет ответа, 404, false — кнопок нет,
   экран входа такой же, как сейчас (вход по коду на почту). Иначе кнопка вела бы в ошибку .
   Никаких скриптов и cookies площадок: кнопка — обычная ссылка на наш API, он сам уводит к провайдеру
   и возвращает на сайт с ?vhod=ok|oshibka&cherez=yandex|vk[&novyj=1][&prichina=…].
   Цели Метрики (только с согласия — dlkGoal сам проверяет): vhod_cherez {vid: yandex|vk} по нажатию,
   registration {vid} при новом аккаунте (ключ vid — из белого списка KLYUCHI в js/metrika.js). */
(function (w) {
  "use strict";
  var PROVAJDERY = [
    { id: "yandex", imya: "Яндекс ID", put: "/api/auth/yandex" },
    { id: "vk", imya: "VK ID", put: "/api/auth/vk" }
  ];
  var PRICHINY = {
    otmena: "Вход через {p} отменён. Можно войти по коду на почту.",
    pochta: "{p} не передал адрес почты — без него мы не найдём ваш кабинет. Разрешите доступ к почте или войдите по коду.",
    ustarela: "Ссылка входа устарела. Нажмите «{p}» ещё раз.",
    zanyato: "Этот профиль {p} уже привязан к другому кабинету Делоскопа. Войдите по коду на почту того кабинета.",
    oshibka: "Не получилось войти через {p}. Попробуйте ещё раз или войдите по коду на почту."
  };

  // короткие слова не висят в конце строки — те же правила, что у типографа статей (tests/tipograf_statej.py)
  function nb(t) {
    return String(t).replace(/(^|[\s\u00a0(«])(в|и|а|к|с|у|о|я|по|на|не|до|от|за|из|ни|но|без|для|при|мы|вы|его|её|ID|VK) /g, "$1$2\u00a0")
      .replace(/(^|[\s\u00a0(«])(в|и|а|к|с|у|о|я|по|на|не|до|от|за|из|ни|но|без|для|при|мы|вы|его|её|ID|VK) /g, "$1$2\u00a0")
      .replace(/ —/g, "\u00a0—");
  }

  function imya(id) {
    for (var i = 0; i < PROVAJDERY.length; i++) if (PROVAJDERY[i].id === id) return PROVAJDERY[i].imya;
    return null;
  }

  // только свой адрес: «/путь», без «//» и схем — иначе вход превращается в открытый редирект
  function svoj(next) {
    next = String(next || "");
    return /^\/(?![\/\\])[^\s]*$/.test(next) ? next : "/cabinet.html";
  }

  function ssylka(api, p, next) {
    return api + p.put + "?next=" + encodeURIComponent(svoj(next));
  }

  // итог возврата с сервера: {ok, cherez, novyj, tekst} или null; адресную строку чистим от меток
  function itog(loc, hist) {
    loc = loc || w.location;
    var q = loc.search || "";
    var m = /[?&]vhod=(ok|oshibka)(?:&|$)/.exec(q);
    if (!m) return null;
    var c = (/[?&]cherez=([a-z]+)/.exec(q) || [])[1];
    var p = imya(c);
    if (!p) return null;
    var pr = (/[?&]prichina=([a-z]+)/.exec(q) || [])[1];
    var ok = m[1] === "ok";
    var r = {
      ok: ok,
      cherez: c,
      novyj: ok && /[?&]novyj=1(?:&|$)/.test(q),
      tekst: ok ? "" : nb((PRICHINY[pr] || PRICHINY.oshibka).replace(/\{p\}/g, p))
    };
    hist = hist || w.history;
    try {
      var ost = q.replace(/^\?/, "").split("&").filter(function (s) {
        return s && !/^(vhod|cherez|novyj|prichina)=/.test(s);
      }).join("&");
      hist.replaceState(null, "", loc.pathname + (ost ? "?" + ost : "") + (loc.hash || ""));
    } catch (e) {}
    return r;
  }

  function knopki(doc, api, vkl, next) {
    var spisok = PROVAJDERY.filter(function (p) { return vkl && vkl[p.id] === true; });
    if (!spisok.length) return null;
    var box = doc.createElement("div");
    box.className = "cherez";
    var ili = doc.createElement("p");
    ili.className = "cherez__ili";
    ili.textContent = "или";
    box.appendChild(ili);
    var ryad = doc.createElement("div");
    ryad.className = "cherez__ryad";
    spisok.forEach(function (p) {
      var a = doc.createElement("a");
      a.className = "btn cherez__btn";
      a.href = ssylka(api, p, next);
      a.setAttribute("data-cherez", p.id);
      a.textContent = "Войти с " + p.imya;
      ryad.appendChild(a);
    });
    box.appendChild(ryad);
    var pr = doc.createElement("p");
    pr.className = "cherez__pro";
    pr.textContent = "Пароль от " + spisok.map(function (p) { return p.imya; }).join(" и ") +
      " мы не видим: нам придут только имя и почта. По почте найдём ваш кабинет или создадим новый.";
    box.appendChild(pr);
    box.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("[data-cherez]") : null;
      if (a && typeof w.dlkGoal === "function") w.dlkGoal("vhod_cherez", { vid: a.getAttribute("data-cherez") });
    });
    return box;
  }

  // mount(контейнер, {api, next, fetch}) → Promise<число показанных кнопок>
  function mount(el, o) {
    o = o || {};
    var f = o.fetch || w.fetch;
    if (!el || !o.api || typeof f !== "function") return Promise.resolve(0);
    return f(o.api + "/api/auth/vhody", { credentials: "omit" })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (j) {
        var b = knopki(el.ownerDocument || document, o.api, j, o.next || "/cabinet.html");
        if (!b) { el.hidden = true; return 0; }
        el.textContent = "";
        el.appendChild(b);
        el.hidden = false;
        return b.querySelectorAll("[data-cherez]").length;
      });
  }

  var api = { nb: nb, mount: mount, itog: itog, svoj: svoj, ssylka: ssylka, PROVAJDERY: PROVAJDERY, PRICHINY: PRICHINY };
  if (typeof module === "object" && module.exports) module.exports = api;
  w.DlkVhodCherez = api;
})(typeof window !== "undefined" ? window : globalThis);
