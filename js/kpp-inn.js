// [Ночные-3] kpp-inn-v1 — что значат цифры ИНН и КПП. Один источник для страницы
// /nalogi/chto-oznachayut-cifry-inn-i-kpp/, «Проверь счёт» и разбора письма о смене реквизитов.
// Нормы — приказ ФНС от 26.06.2025 № ЕД-7-14/559@ (в силе с 01.01.2026), справочник — /data/kpp-inn.json.
// DlkKppInn.kpp('7707 01 001') → {ok, kpp, nnnn, pp, xxx, region, prichina, osnovnoj}
// DlkKppInn.inn('7707083893', regiony) → {ok, tip, nn, region}
(function (root) {
  // КПП: 4 цифры кода инспекции, 2 знака причины (цифры или латинские A–Z), 3 цифры номера.
  var KPP_RE = /^\d{4}[0-9A-Z]{2}\d{3}$/;
  // Для поиска в тексте счёта: после «КПП» — 9 знаков, буквы только на 5–6 месте.
  var KPP_V_TEKSTE = "(\\d{4}[0-9A-Za-z]{2}\\d{3})(?![0-9A-Za-z])";

  function chistyj(s) { return String(s == null ? "" : s).replace(/[\s\u00a0-]/g, "").toUpperCase(); }

  function prichina(pp) {
    if (pp === "01") return { tekst: "по месту нахождения организации — основной КПП", rod: "osnovnoj" };
    if (/[A-Z]/.test(pp)) return { tekst: "код причины с латинской буквой — Порядок ФНС это допускает", rod: "bukva" };
    var n = +pp;
    if (n === 0) return { tekst: "кода причины «00» в Порядке ФНС нет — проверьте, нет ли опечатки", rod: "net" };
    if (n < 50) return { tekst: "российская организация на учёте не по месту нахождения, а по другому основанию Налогового кодекса — например, по месту обособленного подразделения или имущества (п. 1 ст. 83 НК РФ)", rod: "drugoe" };
    if (n === 50) return { tekst: "значение 50 Порядок ФНС относит и к российским, и к иностранным организациям — основание смотрите в выписке ЕГРЮЛ", rod: "drugoe" };
    return { tekst: "иностранная организация (коды от 50 до 99)", rod: "inostr" };
  }

  function region(nn, regiony) {
    if (!regiony || nn === "99") return "";
    return regiony[nn] || "";
  }

  function kpp(s, regiony) {
    var k = chistyj(s);
    if (!KPP_RE.test(k)) return { ok: false, kpp: k, oshibka: k.length !== 9 ? "КПП — 9 знаков: 4 цифры, 2 знака причины, 3 цифры." : "В КПП буквы бывают только на 5-м и 6-м месте." };
    var pp = k.slice(4, 6), p = prichina(pp);
    return {
      ok: p.rod !== "net", kpp: k, nnnn: k.slice(0, 4), pp: pp, xxx: k.slice(6),
      region: region(k.slice(0, 2), regiony), prichina: p.tekst, rod: p.rod, osnovnoj: pp === "01",
      oshibka: p.rod === "net" ? p.tekst : ""
    };
  }

  function kontrol(d) {
    var a = d.split("").map(Number);
    function k(w) { var x = 0; for (var i = 0; i < w.length; i++) x += w[i] * a[i]; return x % 11 % 10; }
    if (a.length === 10) return k([2, 4, 10, 3, 5, 9, 4, 6, 8]) === a[9];
    return k([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === a[10] && k([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === a[11];
  }

  function inn(s, regiony) {
    var d = String(s == null ? "" : s).replace(/\D/g, "");
    if (d.length !== 10 && d.length !== 12) return { ok: false, inn: d, oshibka: "ИНН компании — 10 цифр, ИНН ИП или человека — 12." };
    if (!kontrol(d)) return { ok: false, inn: d, oshibka: "В этом ИНН опечатка: контрольная цифра не сходится. Сверьте цифры с договором или счётом." };
    var nn = d.slice(0, 2);
    return { ok: true, inn: d, tip: d.length === 10 ? "organizaciya" : "fizlico", nn: nn, yy: d.slice(2, 4), region: region(nn, regiony) };
  }

  // Строка для «Проверь счёт»: КПП в счёте не совпал с КПП из ЕГРЮЛ.
  function strokaRashozhdeniya(vSchete, vEgryul) {
    var a = kpp(vSchete), b = kpp(vEgryul);
    var t = "В счёте " + a.kpp + ", в ЕГРЮЛ " + b.kpp + ".";
    if (a.kpp && b.kpp && a.kpp.slice(0, 4) !== b.kpp.slice(0, 4) && a.pp === "01" && b.pp === "01")
      return t + " Обе цифры причины «01» — по месту нахождения, но инспекции разные: так бывает после переезда. Сверьте КПП в свежей выписке ЕГРЮЛ.";
    if (a.ok && !a.osnovnoj && b.osnovnoj)
      return t + " В счёте — КПП с причиной «" + a.pp + "»: " + a.prichina + ". ИНН один на все КПП организации; уточните у поставщика, почему в счёте не основной КПП.";
    return t + " Так бывает у филиалов, но стоит уточнить.";
  }

  var api = { kpp: kpp, inn: inn, prichina: prichina, strokaRashozhdeniya: strokaRashozhdeniya, KPP_RE: KPP_RE, KPP_V_TEKSTE: KPP_V_TEKSTE, chistyj: chistyj };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DlkKppInn = api;
})(this);
