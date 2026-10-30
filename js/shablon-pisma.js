// [команда] shablon-pisma-v1 — письмо в банк «сверить данные с перечнем» на /115-fz/sovpadenie-s-perechnem-chto-delat/.
// Текст письма — от юриста команды, 30.10.2026, дословно; для компании — те же фразы от имени организации.
// 152-ФЗ (условия юриста): письмо собирается только в браузере — поля на сервер не уходят, никуда не сохраняются
// (ни localStorage, ни cookie); в Метрику — только цель «скачал / скопировал», без значений полей.
// Файл .docx собирается здесь же: zip без сжатия (STORE) из трёх частей — открывается в Word, LibreOffice, «Мой Офис».
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DlkPismo = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var DEJSTVIYA = ["остановил операцию", "не исполнил платёж", "ограничил распоряжение средствами"];
  var OTL_CHEL = ["дата рождения", "место рождения", "паспорт", "ИНН", "СНИЛС"];
  var OTL_ORG = ["ИНН", "ОГРН", "адрес"];

  function chist(v) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim(); }
  // кусок письма: {t: текст, p: true — пустое поле, подставлен образец в [скобках]}
  function pole(v, obrazec) { v = chist(v); return v ? { t: v } : { t: "[" + obrazec + "]", p: true }; }
  function s(t) { return { t: t }; }

  function data(v) { // 2026-10-30 → 30.10.2026; другое — как ввели
    v = chist(v); var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    return m ? m[3] + "." + m[2] + "." + m[1] : v;
  }
  function summa(v) { // «480000» → «480 000»; с копейками и словами — как ввели
    v = chist(v).replace(/\s*₽$/, ""); var c = v.replace(/[\s ]/g, "");
    return /^\d+$/.test(c) ? c.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : v;
  }
  function spisok(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " и " + a[a.length - 1]; }

  // Абзацы письма: [{k: 'adres'|'zag'|'tekst'|'punkt'|'podpis', ch: [куски]}]
  function abzacy(d) {
    d = d || {};
    var org = d.kto === "org", A = [];
    A.push({ k: "adres", ch: [s("В "), pole(d.bank, "наименование банка")] });
    if (org) {
      A.push({ k: "adres", ch: [s("от "), pole(d.naim, "наименование"), s(", ИНН "), pole(d.inn, " "), s(", ОГРН "), pole(d.ogrn, " "),
        s(", в лице "), pole(d.lico, "должность, ФИО"), s(", телефон "), pole(d.tel, " "), s(", e-mail "), pole(d.email, " ")] });
    } else {
      A.push({ k: "adres", ch: [s("от "), pole(d.fio, "ФИО полностью"), s(", дата рождения "), pole(data(d.dr), "дд.мм.гггг"),
        s(", ИНН "), pole(d.inn, " "), s(", телефон "), pole(d.tel, " "), s(", e-mail "), pole(d.email, " ")] });
    }
    A.push({ k: "zag", ch: [s("Заявление о сверке данных с перечнем и об основании ограничения операции")] });
    var dej = DEJSTVIYA[d.dejstvie] ? { t: DEJSTVIYA[d.dejstvie] } : { t: "[" + DEJSTVIYA.join(" / ") + "]", p: true };
    A.push({ k: "tekst", ch: [pole(data(d.data), "Дата"), s(" банк "), dej, s(" по счёту, оканчивающемуся на "),
      pole(d.schet4, "4 цифры"), s(", на сумму "), pole(summa(d.summa), " "), s(" ₽.")] });
    A.push({ k: "tekst", ch: [s("Прошу письменно сообщить:")] });
    A.push({ k: "punkt", ch: [s("1. основание ограничения: норму закона и пункт договора банковского счёта;")] });
    A.push({ k: "punkt", ch: [s("2. связано ли ограничение с совпадением " + (org ? "данных организации" : "моих данных") +
      " с записью перечня организаций и физических лиц, в отношении которых имеются сведения об их причастности к экстремистской деятельности или терроризму.")] });
    var vse = org ? OTL_ORG : OTL_CHEL, otl = (d.otlichiya || []).filter(function (x) { return vse.indexOf(x) >= 0; });
    var otlK = otl.length ? { t: otl.join(", ") } : { t: "[что отличается: " + vse.join(" / ") + "]", p: true };
    A.push({ k: "tekst", ch: org
      ? [s("Организация не включена в этот перечень. Данные организации отличаются от данных записи перечня: "), otlK, s(". Копии документов прилагаю.")]
      : [s("Я не включён(а) в этот перечень. Мои данные отличаются от данных записи перечня: "), otlK, s(". Копии документов прилагаю.")] });
    A.push({ k: "tekst", ch: [s("По позиции Росфинмониторинга (письмо от 15.05.2020 № 01-01-40/9140), если хотя бы одно из идентификационных данных клиента не совпадает с данными перечня, клиент не может быть признан включённым в перечень, и меры по замораживанию (блокированию), предусмотренные подп. 6 п. 1 ст. 7 Федерального закона от 07.08.2001 № 115-ФЗ, к нему не применяются.")] });
    var otv = d.otvet === "email" ? { t: "на e-mail" } : d.otvet === "app" ? { t: "в приложении банка" } : { t: "[на e-mail / в приложении банка]", p: true };
    A.push({ k: "tekst", ch: [s("Прошу сверить " + (org ? "данные организации" : "мои данные") + " с записью перечня, по результату снять ограничение и письменно сообщить итог "), otv, s(".")] });
    if (org) {
      A.push({ k: "tekst", ch: [s("Приложения: 1) выписка из ЕГРЮЛ с ИНН и ОГРН; 2) "), { t: "[иное]", p: true }, s(".")] });
    } else {
      var dok = otl.filter(function (x) { return x === "ИНН" || x === "СНИЛС"; });
      A.push({ k: "tekst", ch: [s("Приложения: 1) копия паспорта (страницы с ФИО, датой и местом рождения); 2) "),
        dok.length ? { t: spisok(dok) } : { t: "[ИНН / СНИЛС]", p: true }, s("; 3) "), { t: "[иное]", p: true }, s(".")] });
    }
    A.push({ k: "podpis", ch: [{ t: "[Дата]", p: true }, s("    "), { t: "[Подпись]", p: true }, s("    "),
      org ? pole(d.lico, "ФИО") : pole(d.fio, "ФИО")] });
    return A;
  }

  function tekst(d) {
    return abzacy(d).map(function (a) { return a.ch.map(function (c) { return c.t; }).join(""); }).join("\n\n").replace(/ /g, " ");
  }

  // ---- .docx ----
  function xml(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function docXml(A) {
    var p = A.map(function (a) {
      var pPr = a.k === "adres" ? '<w:pPr><w:spacing w:after="0"/><w:ind w:left="4536"/></w:pPr>'
        : a.k === "zag" ? '<w:pPr><w:spacing w:before="480" w:after="360"/><w:jc w:val="center"/></w:pPr>'
        : a.k === "punkt" ? '<w:pPr><w:spacing w:after="120"/><w:ind w:left="360"/><w:jc w:val="both"/></w:pPr>'
        : a.k === "podpis" ? '<w:pPr><w:spacing w:before="480"/></w:pPr>'
        : '<w:pPr><w:spacing w:after="160"/><w:ind w:firstLine="567"/><w:jc w:val="both"/></w:pPr>';
      var r = a.ch.map(function (c) {
        var rPr = (a.k === "zag" ? "<w:b/>" : "") + (c.p ? '<w:color w:val="6B6B70"/>' : "");
        return "<w:r>" + (rPr ? "<w:rPr>" + rPr + "</w:rPr>" : "") + '<w:t xml:space="preserve">' + xml(c.t.replace(/ /g, " ")) + "</w:t></w:r>";
      }).join("");
      return "<w:p>" + pPr + r + "</w:p>";
    }).join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + p +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>' +
      "</w:body></w:document>";
  }
  var STILI = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>' +
    '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/>' +
    '<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="ru-RU"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>';
  var TIPY = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
  var RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  var DOC_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';

  function utf8(str) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
    var b = unescape(encodeURIComponent(str)), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  }
  var CRC = null;
  function crc32(u) {
    if (!CRC) { CRC = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
    var x = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) x = CRC[(x ^ u[i]) & 255] ^ (x >>> 8);
    return (x ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(fajly) { // [[имя, Uint8Array]] → Uint8Array (STORE, без сжатия)
    var chasti = [], central = [], smesh = 0;
    function le(n, b) { var a = []; for (var i = 0; i < b; i++) a.push((n >>> (8 * i)) & 255); return a; }
    fajly.forEach(function (f) {
      var imya = utf8(f[0]), dan = f[1], crc = crc32(dan);
      var obshchee = [].concat(le(20, 2), le(0, 2), le(0, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(dan.length, 4), le(dan.length, 4), le(imya.length, 2), le(0, 2));
      var lok = [].concat(le(0x04034b50, 4), obshchee);
      chasti.push(new Uint8Array(lok), imya, dan);
      central.push(new Uint8Array([].concat(le(0x02014b50, 4), le(20, 2), obshchee, le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(smesh, 4))), imya);
      smesh += lok.length + imya.length + dan.length;
    });
    var razmerC = central.reduce(function (s, u) { return s + u.length; }, 0);
    var konec = new Uint8Array([].concat(le(0x06054b50, 4), le(0, 2), le(0, 2), le(fajly.length, 2), le(fajly.length, 2), le(razmerC, 4), le(smesh, 4), le(0, 2)));
    var vse = chasti.concat(central, [konec]), dl = vse.reduce(function (s, u) { return s + u.length; }, 0), out = new Uint8Array(dl), p = 0;
    vse.forEach(function (u) { out.set(u, p); p += u.length; });
    return out;
  }
  function docx(d) {
    return zip([
      ["[Content_Types].xml", utf8(TIPY)],
      ["_rels/.rels", utf8(RELS)],
      ["word/document.xml", utf8(docXml(abzacy(d)))],
      ["word/_rels/document.xml.rels", utf8(DOC_RELS)],
      ["word/styles.xml", utf8(STILI)],
    ]);
  }

  // ---- страница ----
  // на странице — типографика сайта: «№» и «115-ФЗ» без переноса (в файле и при копировании — обычные знаки)
  function esc(t) { return xml(t).replace(/№ /g, "№\u00a0").replace(/115-ФЗ/g, "115\u2011ФЗ"); }
  function html(d) {
    return abzacy(d).map(function (a) {
      return '<p class="pismo__' + a.k + '">' + a.ch.map(function (c) { return c.p ? '<span class="pismo__p">' + esc(c.t) + "</span>" : esc(c.t); }).join("") + "</p>";
    }).join("");
  }
  function sobrat(f) { // данные формы → объект для abzacy (ничего не сохраняем)
    var g = function (n) { var e = f.elements[n]; return e ? e.value : ""; };
    var kto = (f.querySelector('input[name="kto"]:checked') || {}).value || "chel";
    var otvet = (f.querySelector('input[name="otvet"]:checked') || {}).value || "";
    var otl = [].slice.call(f.querySelectorAll('input[name="otl"]:checked')).map(function (e) { return e.value; });
    var dej = g("dejstvie");
    return { kto: kto, bank: g("bank"), fio: g("fio"), dr: g("dr"), inn: g(kto === "org" ? "inn_org" : "inn"), tel: g("tel"), email: g("email"),
      naim: g("naim"), ogrn: g("ogrn"), lico: g("lico"), data: g("data"), dejstvie: dej === "" ? null : +dej,
      schet4: g("schet4").replace(/\D/g, "").slice(-4), summa: g("summa"), otlichiya: otl, otvet: otvet };
  }
  function podklyuchit(doc) {
    var f = doc.querySelector("[data-pismo]"), obr = doc.querySelector("[data-pismo-obr]"), soob = doc.querySelector("[data-pismo-soob]");
    if (!f || !obr) return;
    doc.documentElement.classList.add("pismo-js");
    function vid() {
      var org = (f.querySelector('input[name="kto"]:checked') || {}).value === "org";
      [].forEach.call(f.querySelectorAll("[data-dlya]"), function (e) { e.hidden = e.getAttribute("data-dlya") !== (org ? "org" : "chel"); });
      obr.innerHTML = html(sobrat(f));
    }
    function skazat(t) { if (soob) { soob.textContent = t; setTimeout(function () { if (soob.textContent === t) soob.textContent = ""; }, 4000); } }
    f.addEventListener("input", vid); f.addEventListener("change", vid);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var blob = new Blob([docx(sobrat(f))], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      var a = doc.createElement("a"), url = URL.createObjectURL(blob);
      a.href = url; a.download = "pismo-v-bank-sverka-s-perechnem.docx"; doc.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
      skazat("Файл скачан. Проверьте поля в [скобках] перед отправкой.");
      if (window.dlkGoal) window.dlkGoal("odnofamilec_shablon", { sposob: "docx" });
    });
    var k = f.querySelector("[data-pismo-kopiya]");
    if (k) k.addEventListener("click", function () {
      var t = tekst(sobrat(f));
      var gotovo = function () { skazat("Текст скопирован."); if (window.dlkGoal) window.dlkGoal("odnofamilec_shablon", { sposob: "kopiya" }); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(gotovo, function () { skazat("Не получилось скопировать — выделите текст письма ниже."); });
      else skazat("Выделите текст письма ниже и скопируйте.");
    });
    vid();
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { podklyuchit(document); });
    else podklyuchit(document);
  }
  return { abzacy: abzacy, tekst: tekst, html: html, docx: docx, crc32: crc32, DEJSTVIYA: DEJSTVIYA, OTL_CHEL: OTL_CHEL, OTL_ORG: OTL_ORG };
});
