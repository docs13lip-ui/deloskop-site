// ИНН: длина и контрольные цифры (алгоритм ФНС) — один источник для главной, отчёта и форм.
// DlkInn.ok('7707083893') → true; DlkInn.oshibka('7707083894') → текст ошибки или ''.
(function (root) {
  function cifry(s) { return String(s == null ? "" : s).replace(/\D/g, ""); }
  function ok(s) {
    s = cifry(s);
    if (!/^(\d{10}|\d{12})$/.test(s)) return false;
    var d = s.split("").map(Number);
    function k(w) { var x = 0; for (var i = 0; i < w.length; i++) x += w[i] * d[i]; return x % 11 % 10; }
    if (d.length === 10) return k([2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[9];
    return k([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[10] && k([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[11];
  }
  var DLINA = "ИНН компании — 10 цифр, ИНН ИП или человека — 12.";
  var OPECHATKA = "В этом ИНН опечатка: контрольная цифра не сходится. Сверьте цифры с договором или счётом.";
  function oshibka(s) {
    var d = cifry(s);
    if (d.length !== 10 && d.length !== 12) return DLINA;
    return ok(d) ? "" : OPECHATKA;
  }
  var api = { ok: ok, oshibka: oshibka, cifry: cifry, DLINA: DLINA, OPECHATKA: OPECHATKA };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DlkInn = api;
})(this);
