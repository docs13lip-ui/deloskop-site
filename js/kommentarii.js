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

  // Запись библиотеки для строки светофора: первое совпадение по заголовку сверху вниз.
  function zapis(sprav, signal) {
    var list = (sprav && sprav.signaly) || [];
    var title = String((signal && signal.title) || "");
    if (!title) return null;
    for (var i = 0; i < list.length; i++) {
      var re;
      try { re = new RegExp(list[i].re, "i"); } catch (e) { continue; }
      if (re.test(title)) return list[i];
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

  return { TON: TON, MAKS: MAKS, gotov: gotov, zapis: zapis, najti: najti, html: html, zagruzit: zagruzit, vstavit: vstavit, dlina: dlina };
});
