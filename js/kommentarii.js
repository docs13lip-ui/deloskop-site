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

  // Готовый комментарий к строке светофора или null.
  function najti(sprav, signal) {
    var z = zapis(sprav, signal);
    var ton = TON[signal && signal.status];
    if (!z || !ton || !z.tony) return null;
    var t = z.tony[ton];
    if (!gotov(t)) return null;
    return { id: z.id, ton: ton, bank: t.bank || "", nalog: t.nalog || "", sdelat: t.sdelat,
      norma: z.norma || "", podpis: (sprav && sprav.podpis) || "Команда Делоскопа", data: dataRu(t.data_proverki) };
  }

  function html(k) {
    if (!k) return "";
    var str = function (l, t) { return t ? '<p><span class="kom__l">' + l + "</span> " + esc(t) + "</p>" : ""; };
    return '<div class="kom kom--' + esc(k.ton) + '" data-kom="' + esc(k.id) + '">' +
      '<div class="kom__h">Комментарий команды Делоскопа</div>' +
      str("Банк:", k.bank) + str("Налоговая:", k.nalog) + str("Что сделать:", k.sdelat) +
      '<div class="kom__p">' + esc(k.podpis) + (k.norma ? " · " + esc(k.norma) : "") + (k.data ? " · проверено " + esc(k.data) : "") + "</div></div>";
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
      n++;
    });
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
    var n = 0;
    spisok.forEach(function (v) {
      var tr = koren.querySelector('tr[data-f="' + v.f + '"]');
      if (!tr || (tr.nextSibling && tr.nextSibling.className === "kom-tr")) return;
      var nov = tr.ownerDocument.createElement("tr");
      nov.className = "kom-tr";
      nov.innerHTML = '<td colspan="2">' + html(v.k) + "</td>";
      tr.parentNode.insertBefore(nov, tr.nextSibling);
      n++;
    });
    return n;
  }

  return { TON: TON, MAKS: MAKS, gotov: gotov, zapis: zapis, najti: najti, html: html, zagruzit: zagruzit, vstavit: vstavit, dlina: dlina,
    dlyaFaktov: dlyaFaktov, vstavitFakty: vstavitFakty };
});
