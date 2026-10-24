/* Админка: экран «Сегодня» — pult-statistika-v1 (план [Маркетинг] 24.10, разд. 3.2).
 * Один экран, который владелец смотрит каждый день: 8 плиток — Люди · Проверки по ИНН · Откуда приходят · Путь посетителя ·
 * Что читают · Посты · Поиск Яндекса · Голос клиента. Правило то же, что у «Сейчас»: цифра крупно → что это значит → что сделать.
 *
 * Данные — одной сводкой GET /api/admin/pult/segodnya (контракт — ниже), без
 * персональных данных: только счётчики по часу, ни ИНН, ни адресов, ни текстов отзывов. Свои данные сервера — всегда;
 * Метрика и Вебмастер — только при токене Яндекса, иначе плитка «Поиск» серая с подсказкой.
 * «Нет данных» (поле null или его нет) ≠ «0»: ноль — это цифра, серая плитка — «не подключено».
 * Подписи — data/pult_slova.json (правятся без кода). Обновление — каждые 60 с, «обновлено N с назад».
 * Нет связи — плитки остаются с прошлыми цифрами и строкой «нет связи с сервером Делоскопа с ЧЧ:ММ».
 *
 * Контракт сводки (все поля можно опустить — плитка станет серой):
 *  { est: true, sformirovano: ISO, chas_msk: 0–23,
 *    lyudi:    { segodnya, vchera_k_chasu, vchera, nedelya, proshlaya_nedelya, zahody_nedelya },
 *    proverki: { segodnya, gosti, voshedshie, limit, porog, vchera, nedelya },
 *    otkuda:   { poisk_yandex: n, vk: n, … }   — заходы извне за 7 дней по виду источника счётчика (vnutri не входит)
 *    voronka:  { prishli, proverka, otchet, vhod, slezhenie } — за 7 дней, null = шаг не считается
 *    chitayut: [{ put: "/nalogi/…/", n }]      — топ-10 страниц за 7 дней
 *    posty:    [{ kampaniya: "rubrika-115", n }] — переходы по utm_campaign за 7 дней; null = сервер метку не хранит
 *    poisk:    { v_poiske, pokazy, kliki, poziciya, isklyucheny } | null — только при токене Вебмастера
 *    golos:    { sutki, nedelya, temy: { sudy: n, … }, poslednij: ISO } }
 * Чистые функции — без DOM, для автотестов: tests/admin_segodnya.test.js. */
(function (root) {
  "use strict";
  var PERIOD_MS = 60 * 1000, TIK_MS = 10 * 1000, MALO = 20;
  var ZAPRET = /\b(5xx|4xx|latency|uptime|endpoint|API|HTTP|status|timeout|null|undefined|NaN)\b/;

  function chislo(n) { return Number(n || 0).toLocaleString("ru-RU").replace(/\s/g, " "); }
  function sklon(n, odin, dva, pyat) {
    n = Math.abs(Math.round(Number(n) || 0)) % 100; var d = n % 10;
    if (n > 10 && n < 20) return pyat; if (d > 1 && d < 5) return dva; if (d === 1) return odin; return pyat;
  }
  function est(x) { return x !== null && x !== undefined && x !== "" && !(typeof x === "number" && isNaN(x)); }
  function num(x) { return est(x) && isFinite(+x) ? +x : null; }
  // «{n} {n|просмотр|просмотра|просмотров}» → «1 234 просмотра»; {proc} и строки — как есть
  function fmt(s, v) {
    return String(s || "").replace(/\{(\w+)(?:\|([^|}]*)\|([^|}]*)\|([^|}]*))?\}/g, function (_, k, a, b, c) {
      var x = v[k];
      if (a !== undefined) return sklon(x, a, b, c);
      return typeof x === "number" ? chislo(x) : (x == null ? "" : String(x));
    }).replace(/(\d) (%|₽)/g, "$1\u00a0$2"); // «56 %» не рвётся на телефоне
  }
  function proc(chast, celoe) { return celoe > 0 ? Math.round(chast * 100 / celoe) : 0; }
  function seraya(zag, tekst, delat) { return { cvet: "seryj", zag: zag, cifra: "—", podpis: "", smysl: tekst, delat: delat || "", stroki: [] }; }

  /* 1. Люди */
  function plLyudi(d, S) {
    var T = S.lyudi;
    if (!d || num(d.segodnya) === null) return seraya(T.zag, T.net);
    var seg = num(d.segodnya), ned = num(d.nedelya), pr = num(d.proshlaya_nedelya);
    var p = { cvet: "ok", zag: T.zag, cifra: chislo(seg), podpis: fmt(T.podpis, { n: seg }), stroki: [], delat: T.delat_ok };
    if (ned === 0 && seg === 0) { p.cvet = "seryj"; p.smysl = T.pusto; p.delat = T.pusto_delat; return p; }
    p.smysl = fmt(T.smysl, { vchera_k_chasu: num(d.vchera_k_chasu) !== null ? +d.vchera_k_chasu : S.net_dannyh,
      nedelya: ned || 0, zahody: num(d.zahody_nedelya) || 0 });
    if (ned !== null && pr !== null && pr > 0) {
      var r = Math.round((ned - pr) * 100 / pr);
      if (r <= -40 && pr >= 50) { p.cvet = "warn"; p.smysl += " " + fmt(T.spad, { proc: -r }); p.delat = T.delat_spad; }
      else if (r >= 10) p.smysl += " " + fmt(T.rost, { proc: r });
      else if (r <= -10) p.smysl += " " + fmt(T.spad, { proc: -r });
      else p.smysl += " " + T.rovno;
    }
    p.primechanie = T.ocenka;
    return p;
  }

  /* 2. Проверки по ИНН */
  function plProverki(d, S) {
    var T = S.proverki;
    if (!d || num(d.segodnya) === null) return seraya(T.zag, T.net);
    var seg = +d.segodnya, lim = num(d.limit) || 0, porog = num(d.porog) || 10;
    var p = { cvet: "ok", zag: T.zag, cifra: chislo(seg), podpis: fmt(T.podpis, { n: seg }), stroki: [], delat: T.delat_ok };
    p.smysl = fmt(T.smysl, { gosti: num(d.gosti) || 0, voshedshie: num(d.voshedshie) || 0, vchera: num(d.vchera) || 0, nedelya: num(d.nedelya) || 0 });
    if (lim > 0) { p.cvet = "warn"; p.smysl += " " + fmt(T.limit, { limit: lim, porog: porog }); p.delat = T.limit_delat; }
    else if (seg === 0) { p.cvet = "seryj"; p.smysl = T.pusto + " " + p.smysl; p.delat = T.pusto_delat; }
    return p;
  }

  /* 3. Откуда приходят — заходы извне за 7 дней */
  function plOtkuda(d, S) {
    var T = S.otkuda;
    if (!d || typeof d !== "object") return seraya(T.zag, T.net);
    var vidy = Object.keys(d).filter(function (k) { return k !== "vnutri" && num(d[k]) !== null; });
    var vsego = vidy.reduce(function (a, k) { return a + (+d[k]); }, 0);
    var p = { cvet: "ok", zag: T.zag, cifra: chislo(vsego), podpis: fmt(T.podpis, { n: vsego }), stroki: [], delat: T.delat_ok, primechanie: T.grubo };
    if (!vsego) { p.cvet = "seryj"; p.smysl = T.pusto; p.delat = ""; return p; }
    vidy.sort(function (a, b) { return d[b] - d[a] || (a < b ? -1 : 1); });
    p.stroki = vidy.filter(function (k) { return +d[k] > 0; }).map(function (k) {
      return { tekst: T.vidy[k] || k, n: +d[k], proc: proc(+d[k], vsego) };
    });
    p.smysl = fmt(T.smysl, { glavnyj: T.vidy[vidy[0]] || vidy[0], proc: proc(+d[vidy[0]], vsego) });
    if (!(+d.vk > 0) && vsego >= MALO) { p.cvet = "warn"; p.smysl += " " + T.vk_nol; p.delat = T.vk_nol_delat; }
    return p;
  }

  /* 4. Путь посетителя: пришли → проверили → открыли отчёт → вошли → на слежении. Шаг с наибольшей потерей — красным. */
  var SHAGI = ["prishli", "proverka", "otchet", "vhod", "slezhenie"];
  function plVoronka(d, S) {
    var T = S.voronka;
    if (!d || num(d.prishli) === null) return seraya(T.zag, T.net);
    var p = { cvet: "ok", zag: T.zag, cifra: "—", podpis: T.podpis, stroki: [], delat: T.delat_ok };
    var pred = null, hudshij = null;
    SHAGI.forEach(function (k) {
      var n = num(d[k]), s = { tekst: T.shagi[k], n: n, proc: null, kluch: k };
      if (n !== null && pred !== null && pred > 0) {
        s.proc = Math.min(100, proc(n, pred));
        if (hudshij === null || s.proc < hudshij.proc) hudshij = s;
      }
      p.stroki.push(s);
      pred = n; // шаг без данных рвёт цепочку: следующий не сравниваем
    });
    var prishli = +d.prishli, prov = num(d.proverka);
    if (prov !== null && prishli > 0) p.cifra = Math.min(100, proc(prov, prishli)) + " %";
    if (prishli < MALO) { p.cvet = "seryj"; p.smysl = T.malo; p.delat = ""; return p; }
    if (hudshij) { hudshij.hudshij = true; p.smysl = fmt(T.smysl, { shag: hudshij.tekst, proc: hudshij.proc }); p.delat = T.delat; if (hudshij.proc < 10) p.cvet = "warn"; }
    else p.smysl = T.net;
    return p;
  }

  /* 5. Что читают — топ-10 страниц за 7 дней */
  function tipStranicy(put, tipy) {
    if (put === "/") return tipy["/"];
    var m = /^\/[^/]+\//.exec(put || "");
    return (m && tipy[m[0]]) || tipy.drugoe;
  }
  function plChitayut(d, S) {
    var T = S.chitayut;
    if (!Array.isArray(d)) return seraya(T.zag, T.net);
    var spisok = d.filter(function (r) { return r && r.put && num(r.n) !== null; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 10);
    if (!spisok.length || !(+spisok[0].n > 0)) { var s = seraya(T.zag, T.pusto); s.cifra = "0"; return s; }
    var p = { cvet: "ok", zag: T.zag, cifra: chislo(+spisok[0].n), podpis: fmt(T.podpis, { n: +spisok[0].n }), delat: T.delat };
    p.stroki = spisok.map(function (r) { return { tekst: r.put, tip: tipStranicy(r.put, T.tipy), n: +r.n, ssylka: r.put }; });
    p.smysl = fmt(T.smysl, { nazv: spisok[0].put === "/" ? p.stroki[0].tip : "«" + spisok[0].put + "» — " + p.stroki[0].tip, n: +spisok[0].n });
    return p;
  }

  /* 6. Посты — переходы по utm_campaign за 7 дней */
  function plPosty(d, S) {
    var T = S.posty;
    if (!Array.isArray(d)) return seraya(T.zag, T.net);
    var spisok = d.filter(function (r) { return r && r.kampaniya && +r.n > 0; }).sort(function (a, b) { return b.n - a.n; });
    var vsego = spisok.reduce(function (a, r) { return a + (+r.n); }, 0);
    if (!vsego) return { cvet: "seryj", zag: T.zag, cifra: "0", podpis: fmt(T.podpis, { n: 0 }), smysl: T.pusto, delat: T.pusto_delat, stroki: [] };
    return { cvet: "ok", zag: T.zag, cifra: chislo(vsego), podpis: fmt(T.podpis, { n: vsego }),
      smysl: fmt(T.smysl, { kampaniya: spisok[0].kampaniya, luchshe: +spisok[0].n }), delat: T.delat,
      stroki: spisok.slice(0, 8).map(function (r) { return { tekst: r.kampaniya, n: +r.n, proc: proc(+r.n, vsego) }; }) };
  }

  /* 7. Поиск Яндекса — только при токене Вебмастера */
  function plPoisk(d, S) {
    var T = S.poisk;
    if (!d || num(d.v_poiske) === null) return seraya(T.zag, T.net, T.net_delat);
    var isk = num(d.isklyucheny) || 0;
    var p = { cvet: "ok", zag: T.zag, cifra: chislo(+d.v_poiske), podpis: fmt(T.podpis, { n: +d.v_poiske }), stroki: [], delat: T.delat_ok, metka: "по Вебмастеру" };
    p.smysl = fmt(T.smysl, { pokazy: num(d.pokazy) || 0, kliki: num(d.kliki) || 0,
      poziciya: num(d.poziciya) !== null ? String(Math.round(d.poziciya * 10) / 10).replace(".", ",") : "—" });
    if (isk > 0) { p.cvet = "warn"; p.smysl += " " + fmt(T.isklyucheny, { isklyucheny: isk }); p.delat = T.isklyucheny_delat; }
    return p;
  }

  /* 8. Голос клиента — число и темы, без текстов */
  function plGolos(d, S, seichas) {
    var T = S.golos;
    if (!d || num(d.sutki) === null) return seraya(T.zag, T.net);
    var n = +d.sutki, ned = num(d.nedelya) || 0, temy = d.temy || {};
    var top = Object.keys(temy).filter(function (k) { return +temy[k] > 0; }).sort(function (a, b) { return temy[b] - temy[a]; }).slice(0, 3)
      .map(function (k) { return (T.temy[k] || k) + " — " + chislo(+temy[k]); });
    var p = { cvet: n ? "ok" : "seryj", zag: T.zag, cifra: chislo(n), podpis: fmt(T.podpis, { n: n }), stroki: [], delat: n ? T.delat : T.delat_tishina };
    p.smysl = fmt(top.length ? T.smysl : T.smysl_bez_tem, { nedelya: ned, temy: top.join(", ") });
    if (!n && d.poslednij) {
      var dnej = Math.floor(((seichas || Date.now()) - Date.parse(d.poslednij)) / 86400000);
      if (dnej >= 1) p.smysl = fmt(T.tishina, { dnej: dnej }) + " " + p.smysl;
    }
    return p;
  }

  var PLITKI = [["lyudi", plLyudi], ["proverki", plProverki], ["otkuda", plOtkuda], ["voronka", plVoronka],
    ["chitayut", plChitayut], ["posty", plPosty], ["poisk", plPoisk], ["golos", plGolos]];

  // сводка → 8 плиток; сводки нет (сервер старый) — 8 серых с одной причиной
  function plitki(svodka, S, seichas) {
    if (!svodka || !svodka.est) return PLITKI.map(function (x) { return seraya(S[x[0]].zag, S.net_svodki, S.net_svodki_delat); });
    return PLITKI.map(function (x) { var p = x[1](svodka[x[0]], S, seichas); p.id = x[0]; return p; });
  }
  function bezZhargona(p) {
    return !ZAPRET.test([p.cifra, p.podpis, p.smysl, p.delat, p.primechanie || ""].concat((p.stroki || []).map(function (s) { return s.tip || ""; })).join(" "));
  }
  function vremyaMsk(t) {
    try { return new Date(t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }); } catch (_) { return ""; }
  }

  var api = { PERIOD_MS: PERIOD_MS, MALO: MALO, fmt: fmt, sklon: sklon, plitki: plitki, plLyudi: plLyudi, plProverki: plProverki,
    plOtkuda: plOtkuda, plVoronka: plVoronka, plChitayut: plChitayut, plPosty: plPosty, plPoisk: plPoisk, plGolos: plGolos,
    tipStranicy: tipStranicy, bezZhargona: bezZhargona, vremyaMsk: vremyaMsk };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;
  root.DlkSegodnya = api;

  /* ---------------- DOM ---------------- */
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var SLOVO = { ok: "В порядке", warn: "Внимание", bad: "Не работает", seryj: "Не подключено" };

  function stroka(s, S) {
    var n = s.n === null || s.n === undefined ? '<span class="sg__net">' + esc(S.net_dannyh) + "</span>" : esc(chislo(s.n));
    var pr = s.proc !== null && s.proc !== undefined ? '<span class="sg__pr">' + s.proc + " %</span>" : "";
    var t = s.ssylka ? '<a href="' + esc(s.ssylka) + '" target="_blank" rel="noopener">' + esc(s.tekst) + "</a>" : esc(s.tekst);
    return '<li' + (s.hudshij ? ' class="sg__hud"' : "") + '><span class="sg__t">' + t + (s.tip ? ' <span class="sg__tip">' + esc(s.tip) + "</span>" : "") +
      '</span><span class="sg__n num">' + n + "</span>" + pr + "</li>";
  }
  function risovat(p, S) {
    return '<div class="pl pl--' + p.cvet + '" data-pl="' + esc(p.id || "") + '">' +
      '<p class="sg__zag">' + esc(p.zag) + (p.metka ? ' <span class="sg__metka">' + esc(p.metka) + "</span>" : "") + "</p>" +
      '<div class="pl__top"><span class="pl__dot" role="img" aria-label="' + esc(SLOVO[p.cvet]) + '"></span><b class="pl__n num">' + esc(p.cifra) + "</b></div>" +
      (p.podpis ? '<p class="pl__p">' + esc(p.podpis) + "</p>" : "") +
      '<p class="pl__s">' + esc(p.smysl) + "</p>" +
      (p.stroki && p.stroki.length ? '<ul class="sg__list">' + p.stroki.map(function (s) { return stroka(s, S); }).join("") + "</ul>" : "") +
      (p.delat ? '<p class="pl__d">' + esc(p.delat) + "</p>" : "") +
      (p.primechanie ? '<p class="pl__m">' + esc(p.primechanie) + "</p>" : "") + "</div>";
  }

  var sost = { kogda: 0, oshibkaS: 0, S: null };
  function tik() {
    var el = $("sgKogda"); if (!el) return;
    el.textContent = sost.kogda ? "обновлено " + (root.DlkPult ? root.DlkPult.sek(Date.now() - sost.kogda) : Math.round((Date.now() - sost.kogda) / 1000) + " с") + " назад · " + vremyaMsk(sost.kogda) + " МСК" : "собираем сводку…";
  }
  function pokazat(svodka) {
    var S = sost.S, box = $("sgPlitki"); if (!box || !S) return;
    if (!svodka || !svodka.est) { // сервер ещё без сводки — одна строка, а не восемь одинаковых
      box.innerHTML = '<div class="pl pl--seryj sg-odna"><p class="pl__s">' + esc(S.net_svodki) + '</p><p class="pl__d">' + esc(S.net_svodki_delat) + "</p></div>";
      return;
    }
    box.innerHTML = plitki(svodka, S, Date.now()).map(function (p) { return risovat(p, S); }).join("");
  }
  function obnovit(API) {
    return fetch(API + "/api/admin/pult/segodnya", { credentials: "include", cache: "no-store" })
      .then(function (r) {
        if (r.status === 404 || r.status === 405) return { est: false };
        if (!r.ok) throw new Error("svyaz");
        return r.json();
      })
      .then(function (j) { sost.oshibkaS = 0; $("sgSvyaz").hidden = true; pokazat(j); sost.kogda = Date.now(); tik(); })
      .catch(function () {
        if (!sost.oshibkaS) sost.oshibkaS = Date.now();
        var el = $("sgSvyaz"); el.hidden = false; el.textContent = fmt(sost.S.net_svyazi, { vremya: vremyaMsk(sost.oshibkaS) });
        if (!sost.kogda) pokazat({ est: false });
      });
  }
  function start(API) {
    fetch("/data/pult_slova.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (S) {
      sost.S = S; obnovit(API); setInterval(function () { obnovit(API); }, PERIOD_MS); setInterval(tik, TIK_MS); tik();
    }).catch(function () { var el = $("sgSvyaz"); if (el) { el.hidden = false; el.textContent = "Не загрузились подписи экрана — обновите страницу."; } });
  }
  root.DlkSegodnya.start = start;
})(typeof window !== "undefined" ? window : globalThis);
