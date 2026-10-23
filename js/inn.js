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
  // inn-tekst-v1 (24.10.2026): ИНН, скопированный из договора, счёта или карточки компании, — «7707 083 893»,
  // «7707-083-893», «ИНН 7707083893», «ИНН/КПП 7707083893/770701001», «7707083893 770701001».
  // pohozh(s) — в тексте только цифры, разделители и слова ИНН/КПП/ОГРН: это реквизит, а не название компании.
  // izTeksta(s) — первый ИНН (10 или 12 цифр) из такого текста или «», если его нет: «ИНН 77070838» → «»,
  // «Ромашка 2024» → «» (не реквизит — ищем по названию как раньше).
  var SLOVA = /ОГРНИП|ОГРН|ИНН|КПП|OGRN|INN|KPP/gi, RAZD = /[\d\s\u00a0\-\u2010-\u2015\/\\.,:;№#()]/g;
  function pohozh(s) {
    s = String(s == null ? "" : s);
    return /\d/.test(s) && !s.replace(SLOVA, "").replace(RAZD, "");
  }
  function izTeksta(s) {
    if (!pohozh(s)) return "";
    var g = String(s).match(/\d(?:[\s\u00a0\-\u2010-\u2015]*\d)*/g) || [], i, j, d, t;
    for (i = 0; i < g.length; i++) {
      d = cifry(g[i]);
      if (d.length === 10 || d.length === 12) return d;
      t = g[i].split(/[\s\u00a0]+/); // «7707083893 770701001» — ИНН и КПП через пробел
      for (j = 0; j < t.length; j++) { d = cifry(t[j]); if (d.length === 10 || d.length === 12) return d; }
    }
    return "";
  }
  // inn-nazvanie-v1 (24.10.2026): ИНН внутри названия — «ПАО Сбербанк ИНН 7707083893», «ООО «Ромашка», ИНН/КПП …/…»,
  // «Сбербанк 7707083893». Живой /api/suggest 24.10 на «ПАО Сбербанк ИНН 7707083893» отвечал пустым списком
  // (слово «ИНН» ломает поиск по названию), а «Проверить» отправлял текст целиком. vNazvanii(s) — ИНН из такого текста или «»:
  // после слова «ИНН» — первое число из 10 или 12 цифр (с опечаткой тоже: отказ назовёт опечатку, а не «не нашли»);
  // без слова — только отдельное число из 10/12 цифр подряд с верной контрольной цифрой («Ромашка 2024» → «»).
  function vNazvanii(s) {
    s = String(s == null ? "" : s);
    if (!/[A-Za-zА-Яа-яЁё]/.test(s.replace(SLOVA, ""))) return "";
    var m = s.match(/(?:ИНН|INN)(?:\s*[\/\\]\s*(?:КПП|KPP))?[\s\u00a0:№#.,\-–—]*(\d[\d\s\u00a0\-]*)/i), d;
    if (m) { d = izTeksta(m[1]); if (d) return d; }
    var g = s.match(/(?:^|[^\d])(\d{10}|\d{12})(?![\d])/g) || [], i;
    for (i = 0; i < g.length; i++) { d = cifry(g[i]); if (ok(d)) return d; }
    return "";
  }
  // vstavka(pole, strogo) — вставка реквизита в поле кладёт чистый ИНН (без обрезки по maxlength: из «ИНН 7707083893»
  // в поле на 12 знаков браузер оставил бы «ИНН 77070838»). strogo — поле только для ИНН: реквизит без ИНН кладём
  // всеми цифрами, чтобы отказ назвал их число, а не молча обрезал. Название компании вставляется как обычно.
  function vstavka(pole, strogo) {
    if (!pole || !pole.addEventListener) return;
    pole.addEventListener("paste", function (e) {
      var b = e.clipboardData || (typeof window !== "undefined" && window.clipboardData), t = b && b.getData ? b.getData("text") : "";
      if (!t) return;
      // поле только для ИНН: «ПАО Сбербанк ИНН 7707083893» → 7707083893 (браузер оставил бы «ПАО Сбербанк»)
      var d = pohozh(t) ? (izTeksta(t) || (strogo ? cifry(t) : "")) : (strogo ? vNazvanii(t) : "");
      if (!d) return;
      e.preventDefault();
      pole.value = d;
      try { pole.dispatchEvent(new Event("input", { bubbles: true })); } catch (_) {}
    });
  }
  var api = { ok: ok, oshibka: oshibka, cifry: cifry, pohozh: pohozh, izTeksta: izTeksta, vNazvanii: vNazvanii, vstavka: vstavka, DLINA: DLINA, OPECHATKA: OPECHATKA };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DlkInn = api;
})(this);
