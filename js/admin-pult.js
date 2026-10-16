/* Админка: экран «Сейчас» — Пульт v2 (pult-v2, 16.10.2026:
 * «информация в режиме реального времени… работоспособность всех страниц… с расшифровками простым языком»).
 *
 * Правило каждой плитки: цифра крупно → что это значит по-человечески → что сделать (или «ничего, всё в порядке»).
 * Три цвета: зелёный / жёлтый / красный; серый — «не подключено». На экране нет слов «5xx», «latency», «uptime»,
 * «endpoint», «API» — вместо них «страница не открылась», «ответил за 0,8 с», «сервер Делоскопа».
 *
 * Откуда данные (сайт работает без нового кода на сервере):
 *   — «Страницы в порядке»: сам браузер владельца обходит все адреса из /sitemap.xml и 20 случайных карточек из
 *     /sitemap-companies.xml (HEAD, без кэша, по 6 одновременно) + здоровье сервера Делоскопа (/api/health).
 *     Медленно — дольше 3 с; не открылась — код ≥ 400 или сеть. Повтор каждые 5 минут, «обновлено N с назад» — каждые 10 с.
 *   — «Проверок сегодня», «Что просят», «Люди» — из уже существующего /api/admin/summary (users, active_1d, checks_today,
 *     checks_7d, feedback_new): это счётчики, без персональных данных.
 *   — «Люди на сайте» — живые визиты есть только у Метрики; без токена плитка серая с кнопкой «Открыть Метрику».
 *   — «Последнее обновление сайта» — верхняя запись /obnovleniya.json.
 * Чистые функции (оценка, фразы) — без DOM, для автотестов: tests/admin_pult.test.js. */
(function (root) {
  "use strict";
  var MEDLENNO_MS = 3000, PERIOD_MS = 5 * 60 * 1000, TIK_MS = 10 * 1000, PARALLEL = 6, KARTOCHEK = 20;
  var METRIKA_URL = "https://metrika.yandex.ru/dashboard?id=113083788";
  var ZAPRET = /\b(5xx|4xx|latency|uptime|endpoint|API|HTTP|status|timeout)\b/;

  function chislo(n) { return Number(n || 0).toLocaleString("ru-RU"); }
  function sklon(n, odin, dva, pyat) {
    n = Math.abs(Number(n) || 0) % 100; var d = n % 10;
    if (n > 10 && n < 20) return pyat; if (d > 1 && d < 5) return dva; if (d === 1) return odin; return pyat;
  }
  function sek(ms) { var s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? s + " " + sklon(s, "секунду", "секунды", "секунд") : Math.round(s / 60) + " " + sklon(Math.round(s / 60), "минуту", "минуты", "минут"); }
  function vremyaMsk(d) {
    try { return new Date(d).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }); } catch (_) { return ""; }
  }

  /* ---- Страницы в порядке ----
   * itogi: [{url, kod, ms, oshibka}] — kod 0 при ошибке сети. Возвращает плитку {cvet, cifra, podpis, smysl, delat, problemy}. */
  function ocenkaStranic(itogi, zdorov) {
    var vsego = itogi.length, ne = [], medl = [];
    itogi.forEach(function (r) {
      if (!r.kod || r.kod >= 400) ne.push(r); else if (r.ms > MEDLENNO_MS) medl.push(r);
    });
    var ok = vsego - ne.length;
    var p = { cvet: "ok", cifra: ok + " из " + vsego, podpis: "страниц открываются", problemy: ne.concat(medl) };
    if (!vsego) { return { cvet: "seryj", cifra: "—", podpis: "страницы ещё не проверяли", smysl: "Проверка начнётся через несколько секунд.", delat: "", problemy: [] }; }
    if (zdorov === false) {
      p.cvet = "bad"; p.smysl = "Сервер Делоскопа не отвечает: проверка по ИНН и вход в кабинет сейчас не работают, сами страницы сайта открываются.";
      p.delat = "Что сделать: написать в Штаб «сервер не отвечает» — там посмотрят Timeweb.";
      return p;
    }
    if (ne.length) {
      p.cvet = ne.length > 2 ? "bad" : "warn";
      p.smysl = ne.length + " " + sklon(ne.length, "страница не открылась", "страницы не открылись", "страниц не открылись") + " — посетитель увидит ошибку вместо текста.";
      p.delat = "Что сделать: написать в Штаб адреса ниже — обычно чинится за одну выкладку.";
      return p;
    }
    if (medl.length) {
      p.cvet = "warn";
      p.smysl = medl.length + " " + sklon(medl.length, "страница отвечает", "страницы отвечают", "страниц отвечают") + " дольше 3 с — люди с телефона могут не дождаться.";
      p.delat = "Что сделать: ничего срочного; если повторится завтра — сказать Штабу.";
      return p;
    }
    var sred = itogi.reduce(function (a, r) { return a + (r.ms || 0); }, 0) / vsego;
    p.smysl = "Все страницы открываются, в среднем за " + (sred / 1000).toFixed(1).replace(".", ",") + " с. Сервер Делоскопа отвечает.";
    p.delat = "Делать ничего не нужно.";
    return p;
  }

  /* ---- Проверок сегодня ---- s: summary из /api/admin/summary */
  function ocenkaProverok(s) {
    var seg = +s.checks_today || 0, ned = +s.checks_7d || 0, sredn = ned / 7;
    var p = { cvet: "ok", cifra: chislo(seg), podpis: sklon(seg, "проверка сегодня", "проверки сегодня", "проверок сегодня"), delat: "" };
    if (!ned) { p.cvet = "seryj"; p.smysl = "За неделю проверок не было — сайт ещё не нашли."; p.delat = "Что сделать: опубликовать первую статью в Дзене и пост в ВК — ссылки ведут на проверку."; return p; }
    var ch = new Date().getUTCHours() + 3; if (ch >= 24) ch -= 24; var dolya = Math.max(ch, 1) / 24;
    var ozhid = sredn * dolya;
    if (seg >= ozhid * 1.5 && seg >= 5) p.smysl = "Сегодня проверяют заметно чаще обычного (в среднем " + chislo(Math.round(sredn)) + " в день за неделю). Так бывает после публикации или письма.";
    else if (seg < ozhid * 0.5 && ch > 12) { p.cvet = "warn"; p.smysl = "Сегодня проверок меньше обычного (в среднем " + chislo(Math.round(sredn)) + " в день за неделю)."; p.delat = "Что сделать: если так и завтра — посмотреть, не сломалась ли проверка на главной."; }
    else p.smysl = "Обычный день: за неделю в среднем " + chislo(Math.round(sredn)) + " " + sklon(Math.round(sredn), "проверка", "проверки", "проверок") + " в день.";
    return p;
  }

  /* ---- Что просят ---- */
  function ocenkaGolosa(s) {
    var n = +s.feedback_new || 0;
    var p = { cvet: n ? "ok" : "seryj", cifra: chislo(n), podpis: n ? sklon(n, "новый отзыв", "новых отзыва", "новых отзывов") : "новых отзывов нет" };
    p.smysl = n ? "Люди написали, чего им не хватает или что было непонятно. Каждый отзыв — подсказка, куда углубляться." : "Пока никто не написал. Вопрос «Чего не хватило?» задаётся после второй проверки.";
    p.delat = n ? "Что сделать: прочитать в разделе «Отзывы и обращения» ниже — 2 минуты." : "";
    return p;
  }

  /* ---- Люди ---- */
  function ocenkaLyudej(s) {
    var a = +s.active_1d || 0, u = +s.users || 0;
    return { cvet: "seryj", cifra: chislo(a), podpis: sklon(a, "человек заходил в кабинет за сутки", "человека заходили в кабинет за сутки", "человек заходили в кабинет за сутки"),
      smysl: "Всего в кабинете " + chislo(u) + " " + sklon(u, "человек", "человека", "человек") + ". Сколько людей читает сайт без входа, знает только Яндекс Метрика.",
      delat: "Что сделать: открыть Метрику — там посетители за сегодня и откуда пришли. Подключим её сюда, когда будет токен Яндекса." };
  }

  function frazaObnovleniya(zapis) {
    if (!zapis) return "";
    return "Последнее обновление сайта: «" + zapis.zagolovok + "» — " + (zapis.data || "") + (zapis.vremya ? ", " + zapis.vremya : "") + ".";
  }

  // все фразы плиток — без технического жаргона (тест)
  function bezZhargona(p) { return !ZAPRET.test([p.cifra, p.podpis, p.smysl, p.delat].join(" ")); }

  var api = { MEDLENNO_MS: MEDLENNO_MS, PERIOD_MS: PERIOD_MS, KARTOCHEK: KARTOCHEK, METRIKA_URL: METRIKA_URL,
    ocenkaStranic: ocenkaStranic, ocenkaProverok: ocenkaProverok, ocenkaGolosa: ocenkaGolosa, ocenkaLyudej: ocenkaLyudej,
    frazaObnovleniya: frazaObnovleniya, bezZhargona: bezZhargona, sklon: sklon, sek: sek };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;
  root.DlkPult = api;

  /* ---------------- DOM ---------------- */
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var SLOVO = { ok: "В порядке", warn: "Внимание", bad: "Не работает", seryj: "Не подключено" };

  function risovatPlitku(id, p, dop) {
    var el = $(id); if (!el) return;
    el.className = "pl pl--" + p.cvet;
    el.innerHTML = '<div class="pl__top"><span class="pl__dot" role="img" aria-label="' + esc(SLOVO[p.cvet]) + '"></span><b class="pl__n num">' + esc(p.cifra) + "</b></div>" +
      '<p class="pl__p">' + esc(p.podpis) + "</p>" +
      '<p class="pl__s">' + esc(p.smysl) + "</p>" +
      (p.delat ? '<p class="pl__d">' + esc(p.delat) + "</p>" : "") + (dop || "");
  }

  function loc(xml) { var m, re = /<loc>\s*([^<\s]+)\s*<\/loc>/g, a = []; while ((m = re.exec(xml))) a.push(m[1]); return a; }
  function sluchajnye(a, n) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a.slice(0, n); }
  function proverit(url) {
    var t0 = Date.now(), ctrl = root.AbortController ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
    return fetch(url, { method: "HEAD", cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return { url: url, kod: r.status, ms: Date.now() - t0 }; })
      .catch(function (e) { return { url: url, kod: 0, ms: Date.now() - t0, oshibka: String(e && e.name || "сеть") }; })
      .then(function (r) { clearTimeout(tm); return r; });
  }
  function pachkami(urls, f) {
    var i = 0, itog = [];
    function dalee() { if (i >= urls.length) return Promise.resolve(); var u = urls[i++]; return f(u).then(function (r) { itog.push(r); return dalee(); }); }
    var p = []; for (var k = 0; k < PARALLEL; k++) p.push(dalee());
    return Promise.all(p).then(function () { return itog; });
  }
  function put(u) { try { return new URL(u, location.origin).pathname; } catch (_) { return u; } }

  var sost = { kogda: 0, idet: false };
  function obhod(API) {
    if (sost.idet) return Promise.resolve(); sost.idet = true;
    var el = $("plStr"); if (el && !sost.kogda) risovatPlitku("plStr", ocenkaStranic([], null));
    return Promise.all([
      fetch("/sitemap.xml", { cache: "no-store" }).then(function (r) { return r.text(); }).then(loc).catch(function () { return []; }),
      fetch("/sitemap-companies.xml", { cache: "no-store" }).then(function (r) { return r.text(); }).then(loc).catch(function () { return []; }),
      API ? fetch(API + "/api/health", { cache: "no-store" }).then(function (r) { return r.ok; }).catch(function () { return false; }) : Promise.resolve(null)
    ]).then(function (x) {
      var urls = x[0].concat(sluchajnye(x[1], KARTOCHEK));
      return pachkami(urls, proverit).then(function (itogi) {
        var p = ocenkaStranic(itogi, x[2]);
        var spisok = p.problemy.length ? '<ul class="pl__list">' + p.problemy.slice(0, 10).map(function (r) {
          return "<li><a href=\"" + esc(r.url) + '" target="_blank" rel="noopener">' + esc(put(r.url)) + "</a> — " + (r.kod && r.kod < 400 ? "отвечает " + (r.ms / 1000).toFixed(1).replace(".", ",") + " с" : (r.kod ? "не открылась (ответ " + r.kod + ")" : "не открылась (нет ответа)")) + "</li>";
        }).join("") + "</ul>" : "";
        var kart = x[1].length ? '<p class="pl__m">Карточек компаний на сайте — ' + chislo(x[1].length) + ", проверили " + Math.min(KARTOCHEK, x[1].length) + " случайных.</p>" : "";
        risovatPlitku("plStr", p, spisok + kart);
        sost.kogda = Date.now(); tik();
      });
    }).then(function () { sost.idet = false; }, function () { sost.idet = false; });
  }

  function tik() {
    var el = $("plKogda"); if (!el) return;
    el.textContent = sost.kogda ? "обновлено " + sek(Date.now() - sost.kogda) + " назад · " + vremyaMsk(sost.kogda) + " МСК" : "проверяем страницы…";
  }

  function start(API, summary) {
    var s = summary || {};
    risovatPlitku("plLyudi", ocenkaLyudej(s), '<a class="pl__a" href="' + METRIKA_URL + '" target="_blank" rel="noopener">Открыть Метрику</a>');
    risovatPlitku("plProv", ocenkaProverok(s));
    risovatPlitku("plGolos", ocenkaGolosa(s), (+s.feedback_new ? '<a class="pl__a" href="#fbSek">К отзывам</a>' : ""));
    fetch("/obnovleniya.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      var z = (j.obnovleniya || [])[0]; var el = $("plObn"); if (el && z) el.textContent = frazaObnovleniya(z);
    }).catch(function () {});
    obhod(API); setInterval(function () { obhod(API); }, PERIOD_MS); setInterval(tik, TIK_MS); tik();
    var b = $("plPovtor"); if (b) b.addEventListener("click", function () { sost.kogda = 0; obhod(API).then(tik); });
  }
  root.DlkPult.start = start;
})(typeof window !== "undefined" ? window : globalThis);
