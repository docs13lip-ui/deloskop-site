/* Делоскоп — «Комментарий команды Делоскопа» под строками светофора (решения владельца 02.10).
 * Библиотека текстов — /data/kommentarii.json: id сигнала → по тону (zel / zhel / kras) три фразы:
 * что видит банк (115-ФЗ, ЗСК) · что видит налоговая (ст. 54.1 НК) · что сделать до оплаты, + норма.
 * Тексты пишет [Право]; на сайт выходит только тон со status «utverzhdeno», кем и когда проверен.
 * Нет утверждённого текста — блока нет совсем (без заглушек «скоро»).
 * Чистые функции najti/html — без DOM и сети; zagruzit/vstavit — браузерная часть. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Kommentarii = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TON = { ok: "zel", info: "zel", warn: "zhel", bad: "kras" };
  var MAKS = 300;

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"]/g, function (x) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x];
    });
  }
  function dataRu(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
    return m ? m[3] + "." + m[2] + "." + m[1] : "";
  }
  function dlina(t) { return ["bank", "nalog", "sdelat"].reduce(function (s, k) { return s + String(t[k] || "").length; }, 0); }

  // Тон годится для показа: утверждён, проверен (роль + дата), есть хотя бы «что сделать», укладывается в 300 знаков.
  function gotov(t) {
    return !!(t && t.status === "utverzhdeno" && t.proveril && dataRu(t.data_proverki) &&
      t.sdelat && (t.bank || t.nalog) && dlina(t) <= MAKS);
  }

  // Запись библиотеки для строки светофора: первое совпадение сверху вниз.
  // re — по заголовку строки; uslovie (необязательно) — ещё и по «заголовок · деталь»: так «Адрес» с
  // недостоверностью в детали получает текст о недостоверности, а неясный «Статус» — ничего.
  // kak — запись берёт тексты другой записи (один текст [Право] — несколько заголовков API).
  function rx(s) { try { return new RegExp(s, "i"); } catch (e) { return null; } }
  function zapis(sprav, signal) {
    var list = (sprav && sprav.signaly) || [];
    var title = String((signal && signal.title) || "");
    if (!title) return null;
    var vse = title + " · " + String((signal && signal.detail) || "");
    for (var i = 0; i < list.length; i++) {
      var re = rx(list[i].re);
      if (!re || !re.test(title)) continue;
      if (list[i].uslovie) { var u = rx(list[i].uslovie); if (!u || !u.test(vse)) continue; }
      if (!list[i].kak) return list[i];
      for (var j = 0; j < list.length; j++) if (list[j].id === list[i].kak && !list[j].kak) return list[j];
      return null;
    }
    return null;
  }

  // [Право] 02.10 08:20: зелёный текст — только если источник ответил («не проверяли ≠ не нашли»):
  // строка со статусом ok, и ни в заголовке, ни в детали нет признаков неответа источника.
  var NE_OTVETIL = /не\s*провер|недоступ|не\s*ответ|нет\s*ответа|нет\s*данных|нет\s*сведений|не\s*получ|ошибк|временно|не\s*удалось/i;
  function istochnikOtvetil(signal) {
    if (!signal || signal.status !== "ok") return false;
    return !NE_OTVETIL.test(String(signal.title || "") + " · " + String(signal.detail || ""));
  }

  // Готовый комментарий к строке светофора или null.
  function najti(sprav, signal) {
    var z = zapis(sprav, signal);
    var ton = TON[signal && signal.status];
    if (!z || !ton || !z.tony) return null;
    if (ton === "zel" && !istochnikOtvetil(signal)) return null;
    var t = z.tony[ton];
    if (!gotov(t)) return null;
    // uslovie у тона: тон только для своей детали (дисквалификация «Внимание» — совпадение лишь по ФИО, [Право] 02.10 21:25)
    if (t.uslovie) {
      var ut = rx(t.uslovie);
      if (!ut || !ut.test(String(signal.title || "") + " · " + String(signal.detail || ""))) return null;
    }
    // norma у тона (если задана, хоть пустой строкой) важнее нормы записи
    var norma = t.norma != null ? t.norma : z.norma;
    return { id: z.id, ton: ton, bank: t.bank || "", nalog: t.nalog || "", sdelat: t.sdelat,
      norma: norma || "", podpis: (sprav && sprav.podpis) || "Команда Делоскопа", data: dataRu(t.data_proverki) };
  }

  function html(k) {
    if (!k) return "";
    var str = function (l, t) { return t ? '<p><span class="kom__l">' + l + "</span> " + esc(t) + "</p>" : ""; };
    return '<div class="kom kom--' + esc(k.ton) + '" data-kom="' + esc(k.id) + '">' +
      '<div class="kom__h">Комментарий команды Делоскопа</div>' +
      str("Банк:", k.bank) + str("Налоговая:", k.nalog) + str("Что сделать:", k.sdelat) +
      '<div class="kom__p">' + esc(k.podpis) + (k.norma ? " · " + esc(k.norma) : "") + (k.data ? " · нормы сверены " + esc(k.data) : "") + "</div></div>";
  }

  // Номера норм («ст. 76 НК», «№ ММ-3-06/333@») не рвутся на переносе — общая обёртка шапки (js/shapka.js), если она есть.
  function nerazryv(uzel) {
    try { var w = typeof window !== "undefined" ? window : null; if (uzel && w && w.dlkNerazryv) w.dlkNerazryv.obernut(uzel); } catch (e) {}
  }

  // Браузер: библиотека загружается один раз; при ошибке — пусто (отчёт работает как раньше).
  var obeshchanie = null;
  function zagruzit(url) {
    if (!obeshchanie) {
      obeshchanie = (typeof fetch === "function" ? fetch(url || "/data/kommentarii.json", { cache: "no-cache" })
        .then(function (o) { return o.ok ? o.json() : null; }) : Promise.resolve(null))
        .catch(function () { return null; });
    }
    return obeshchanie;
  }

  // Под каждой строкой tr[data-sig=i] таблицы светофора — строка с комментарием, если он утверждён.
  function vstavit(tablica, signals, sprav) {
    if (!tablica || !sprav) return 0;
    var n = 0;
    (signals || []).forEach(function (s, i) {
      var k = najti(sprav, s);
      var tr = tablica.querySelector('tr[data-sig="' + i + '"]');
      if (!k || !tr || (tr.nextSibling && tr.nextSibling.className === "kom-tr")) return;
      var nov = tr.ownerDocument.createElement("tr");
      nov.className = "kom-tr";
      nov.innerHTML = '<td colspan="2">' + html(k) + "</td>";
      tr.parentNode.insertBefore(nov, tr.nextSibling);
      nerazryv(nov);
      n++;
    });
    // оговорка [Право] — один раз под таблицей, если в ней есть комментарий
    if (tablica.querySelector(".kom-tr") && tablica.parentNode && tablica.parentNode.querySelector) postavitOgovorku(tablica.parentNode, tablica, "p");
    return n;
  }

  // Паспорт контрагента: строки разделов (fakty) собраны из тех же строк светофора — заголовок строки = заголовок признака.
  // Чистая функция: [{ f: "razdel:i", k: комментарий }] для строк, к которым есть утверждённый текст.
  // Служебные и расчётные разделы (Итог, предел, что запросить, чего не знаем) — без комментариев.
  var BEZ = { predel: 1, zaprosit: 1, ne_znaem: 1, podlinnost: 1, indeks: 1 };
  var TON_FAKTA = { ok: "ok", warn: "warn", bad: "bad" };
  function dlyaFaktov(razdely, signals, sprav) {
    if (!sprav) return [];
    var vzyat = {}, out = [];
    (razdely || []).forEach(function (x) {
      if (!x || BEZ[x.id] || x.vid === "sluzhebnyj") return;
      (x.fakty || []).forEach(function (f, i) {
        var t = String((f && f.tekst) || "");
        if (!t) return;
        for (var j = 0; j < (signals || []).length; j++) {
          var s = signals[j];
          if (vzyat[j] || String((s && s.title) || "") !== t || TON_FAKTA[s.status] !== f.ton) continue;
          vzyat[j] = 1;
          var k = najti(sprav, s);
          if (k) out.push({ f: x.id + ":" + i, k: k });
          return;
        }
      });
    });
    return out;
  }

  // Браузер: под строкой tr[data-f] Паспорта — строка с комментарием (повторно не вставляет).
  function vstavitFakty(koren, spisok) {
    if (!koren || !spisok) return 0;
    var n = 0, posl = null;
    spisok.forEach(function (v) {
      var tr = koren.querySelector('tr[data-f="' + v.f + '"]');
      if (!tr) return;
      if (tr.nextSibling && tr.nextSibling.className === "kom-tr") { posl = tr; return; }
      var nov = tr.ownerDocument.createElement("tr");
      nov.className = "kom-tr";
      nov.innerHTML = '<td colspan="2">' + html(v.k) + "</td>";
      tr.parentNode.insertBefore(nov, tr.nextSibling);
      nerazryv(nov);
      posl = tr; n++;
    });
    // оговорка [Право] — один раз, под таблицей раздела с последним комментарием
    var t = posl;
    while (t && t.tagName !== "TABLE") t = t.parentNode;
    if (t) postavitOgovorku(koren, t, "p");
    return n;
  }

  // [Право] 02.10 11:15: один раз под блоком комментариев (и в печати) — общая оговорка (ст. 152 ГК РФ, ч. 3 ст. 5 38-ФЗ).
  var OGOVORKA = "Комментарий команды — общий: он объясняет, как банки и налоговая смотрят на такой признак. Это не оценка этой компании или сделки и не юридическая консультация.";
  function ogovorkaHtml() { return '<p class="kom-og">' + esc(OGOVORKA) + "</p>"; }
  // Оговорка после узла posle (последний комментарий), если её ещё нет в koren.
  function postavitOgovorku(koren, posle, teg) {
    if (!koren || !posle || !posle.parentNode || koren.querySelector(".kom-og")) return false;
    var el = posle.ownerDocument.createElement(teg || "p");
    el.className = "kom-og";
    el.textContent = OGOVORKA;
    posle.parentNode.insertBefore(el, posle.nextSibling);
    return true;
  }

  // Экран проверки: «Существенные факты» (js/sushchestvennoe.js, строки .sut__r[data-fakt=k]; k = id строки светофора или «sigN»).
  // Чистая функция: [{ k, kom }] — только для фактов из строк светофора, у которых тон на экране совпадает со статусом строки
  // (налоги «не проверяли — набор старше 3 месяцев» — нейтральные, зелёный текст к ним не подходит).
  var TON_EKRANA = { ok: "ok", info: "ok", warn: "warn", bad: "bad" };
  // kom-kapital-v1 ([Ночные-2] 03.10): факты, которые экран считает сам из ГИР БО (js/sushchestvennoe.js) — у них нет строки
  // светофора; комментарий ищем по названию факта (записи kapital, likvidnost — тексты [Право · Юрист 115-ФЗ] 03.10 07:07).
  // Только «Внимание»: экран выносит их, лишь когда капитал меньше нуля / ликвидность меньше 1.
  var SVOI_FAKTY = { kapital: 1, likvidnost: 1 };
  function dlyaSut(spisok, signals, sprav) {
    if (!sprav) return [];
    var out = [];
    (spisok || []).forEach(function (f) {
      if (!f || !f.k) return;
      if (SVOI_FAKTY[f.k]) {
        if (f.ton !== "warn") return;
        var ks = najti(sprav, { title: String(f.nazv || ""), status: "warn", detail: String(f.znach || "") });
        if (ks) out.push({ k: f.k, kom: ks });
        return;
      }
      for (var j = 0; j < (signals || []).length; j++) {
        var s = signals[j];
        if (!s || !s.title || (s.id || "sig" + j) !== f.k) continue;
        if (TON_EKRANA[s.status] !== f.ton) return;
        var k = najti(sprav, s);
        if (k) out.push({ k: f.k, kom: k });
        return;
      }
    });
    return out;
  }

  var CSS_EKRANA = ".sut .kom{margin:-4px 0 12px;padding:10px 14px;border-left:3px solid var(--line,#E5E5E0);background:#FAFAF8;" +
    "border-radius:0 10px 10px 0;font-size:14px;line-height:1.5;color:var(--ink,#1D1D1F)}" +
    ".sut .kom--zel{border-left-color:var(--ok,#1E7F4F)}.sut .kom--zhel{border-left-color:var(--warn,#B26B00)}.sut .kom--kras{border-left-color:var(--bad,#C0362C)}" +
    ".sut .kom__h{font-weight:600;font-size:12.5px;letter-spacing:.02em;color:var(--ink2,#48484C);margin-bottom:4px}" +
    ".sut .kom p{margin:2px 0}.sut .kom__l{font-weight:600}.sut .kom__p{color:var(--muted,#6B6B70);font-size:12px;margin-top:6px}" +
    ".kom-og{margin:4px 0 12px;font-size:12.5px;line-height:1.45;color:var(--muted,#6B6B70)}" +
    "@media print{.sut .kom{background:none;break-inside:avoid}}";
  function stil(doc) {
    if (!doc || !doc.createElement || doc.getElementById("kom-css")) return;
    var s = doc.createElement("style"); s.id = "kom-css"; s.textContent = CSS_EKRANA;
    (doc.head || doc.documentElement).appendChild(s);
  }

  // Браузер: под строкой .sut__r[data-fakt] — комментарий (повторно не вставляет), после последнего — оговорка.
  function vstavitSut(koren, spisok) {
    if (!koren || !spisok || !spisok.length) return 0;
    var n = 0, posl = null;
    spisok.forEach(function (v) {
      var row = koren.querySelector('.sut__r[data-fakt="' + String(v.k).replace(/["\\]/g, "") + '"]');
      if (!row) return;
      var sl = row.nextSibling;
      if (sl && /(^| )kom( |$)/.test(sl.className || "")) { posl = sl; return; }
      var w = row.ownerDocument.createElement("div");
      w.innerHTML = html(v.kom);
      var el = w.firstChild;
      if (!el) return;
      row.parentNode.insertBefore(el, row.nextSibling);
      nerazryv(el);
      posl = el; n++;
    });
    if (posl) {
      try { stil(koren.ownerDocument); } catch (e) {}
      // оговорка — под всем списком фактов (после последней строки или её комментария), а не посреди него
      var vse = koren.querySelectorAll ? koren.querySelectorAll(".sut__r") : [];
      var kon = vse.length ? vse[vse.length - 1] : posl;
      if (kon.nextSibling && /(^| )kom( |$)/.test(kon.nextSibling.className || "")) kon = kon.nextSibling;
      postavitOgovorku(koren, kon, "p");
    }
    return n;
  }

  // «Кому вы платите»: сигналы разбора выписки (engine.js) — по коду, не по заголовку. Тон у записи один: уровень сигнала
  // в движке постоянный (bad — kras, warn — zhel, info — sery: справка, не «норма»). Те же ворота gotov().
  var TON_VYP = { bad: "kras", warn: "zhel", info: "sery" };
  // klient — «org» (ИНН выписки из 10 цифр) / «ip» / пусто. Строка ton.dlya_organizacii — только для «org»:
  // норма о налоге на прибыль (ч. 8 ст. 15 422-ФЗ, [Право · Налоговый юрист] 02.10 23:20) к ИП не относится.
  function dlyaOrg(o) {
    return !!(o && o.tekst && o.proveril && dataRu(o.data_proverki) && String(o.tekst).length <= MAKS);
  }
  function vypiska(sprav, kod, klient) {
    var list = (sprav && sprav.vypiska && sprav.vypiska.zapisi) || [];
    for (var i = 0; i < list.length; i++) {
      var z = list[i];
      if (!z || z.kod !== kod) continue;
      if (!TON_VYP[z.uroven] || !gotov(z.ton)) return null;
      var t = z.ton, norma = t.norma != null ? t.norma : z.norma, org = "";
      if (klient === "org" && dlyaOrg(t.dlya_organizacii)) {
        org = t.dlya_organizacii.tekst;
        var n2 = t.dlya_organizacii.norma || "";
        if (n2 && String(norma || "").indexOf(n2) < 0) norma = norma ? norma + "; " + n2 : n2;
      }
      return { id: z.id, ton: TON_VYP[z.uroven], bank: t.bank || "", nalog: t.nalog || "", sdelat: t.sdelat, org: org,
        norma: norma || "", podpis: (sprav && sprav.podpis) || "Команда Делоскопа", data: dataRu(t.data_proverki) };
    }
    return null;
  }
  // Свёрнуто под сигналом: в выписке десятки поставщиков, и раскрытый текст под каждым сигналом заслонил бы суммы.
  function vypiskaHtml(sprav, kod, klient) {
    var k = vypiska(sprav, kod, klient);
    if (!k) return "";
    var str = function (l, t) { return t ? '<p><span class="kom__l">' + l + "</span> " + esc(t) + "</p>" : ""; };
    return '<details class="kom kom--' + esc(k.ton) + '" data-kom="' + esc(k.id) + '">' +
      '<summary class="kom__h">Комментарий команды Делоскопа</summary>' +
      str("Банк:", k.bank) + str("Налоговая:", k.nalog) + str("Что сделать:", k.sdelat) + str("Компании:", k.org) +
      '<div class="kom__p">' + esc(k.podpis) + (k.norma ? " · " + esc(k.norma) : "") + (k.data ? " · нормы сверены " + esc(k.data) : "") + "</div></details>";
  }
  // Есть ли в библиотеке хоть один утверждённый текст для выписки (иначе страницу не перерисовываем).
  function estVypiska(sprav) {
    var list = (sprav && sprav.vypiska && sprav.vypiska.zapisi) || [];
    for (var i = 0; i < list.length; i++) if (list[i] && vypiska(sprav, list[i].kod)) return true;
    return false;
  }

  return { TON: TON, MAKS: MAKS, OGOVORKA: OGOVORKA, ogovorkaHtml: ogovorkaHtml, postavitOgovorku: postavitOgovorku,
    dlyaSut: dlyaSut, vstavitSut: vstavitSut, CSS_EKRANA: CSS_EKRANA, gotov: gotov, istochnikOtvetil: istochnikOtvetil, NE_OTVETIL: NE_OTVETIL, zapis: zapis, najti: najti, html: html, zagruzit: zagruzit, vstavit: vstavit, dlina: dlina,
    dlyaFaktov: dlyaFaktov, vstavitFakty: vstavitFakty,
    TON_VYP: TON_VYP, vypiska: vypiska, vypiskaHtml: vypiskaHtml, estVypiska: estVypiska };
});
