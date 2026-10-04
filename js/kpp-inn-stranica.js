// [Ночные-3] kpp-inn-v1 — расшифровка ИНН или КПП на /nalogi/chto-oznachayut-cifry-inn-i-kpp/.
// Всё в браузере: номер на сервер не уходит; регионы — из /data/kpp-inn.json.
(function () {
  var f = document.querySelector("[data-ras]"), rez = document.querySelector("[data-ras-rez]");
  if (!f || !rez || !window.DlkKppInn) return;
  var regiony = null, ozhid = null;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function zagruzit(cb) {
    if (regiony) return cb();
    try {
      fetch("/data/kpp-inn.json").then(function (r) { return r.json(); })
        .then(function (d) { regiony = d.regiony || {}; cb(); }, function () { regiony = {}; cb(); });
    } catch (e) { regiony = {}; cb(); }
  }
  function reg(nn, r) { return r ? esc(r) + " (код " + nn + ")" : "код " + nn + " — в справочнике нет"; }
  function stroka(t, d) { return "<dt>" + t + "</dt><dd>" + d + "</dd>"; }
  function pokazat(v) {
    var s = DlkKppInn.chistyj(v), h = "";
    if (!s) { rez.innerHTML = ""; return; }
    if (/^\d{10}$|^\d{12}$/.test(s)) {
      var i = DlkKppInn.inn(s, regiony);
      if (!i.ok) { rez.innerHTML = '<p class="ras__osh">' + esc(i.oshibka) + "</p>"; return; }
      var hv = i.tip === "organizaciya" ? s.slice(4, 9) : s.slice(4, 10), c = i.tip === "organizaciya" ? s.slice(9) : s.slice(10);
      h = '<div class="ras__kod" aria-hidden="true"><span>' + s.slice(0, 2) + "</span><span>" + s.slice(2, 4) + "</span><span>" + hv + "</span><span>" + c + "</span></div><dl>" +
        stroka("Чей", i.tip === "organizaciya" ? "организации (10 цифр)" : "человека или предпринимателя (12 цифр)") +
        stroka("Цифры 1–2", "регион: " + reg(i.nn, i.region)) +
        stroka("Цифры 3–4", "в ИНН, присвоенных до 2026 года, вместе с 1–2 — код инспекции " + esc(s.slice(0, 4)) + "; с 2026 года — индекс ФНС") +
        stroka("Контрольное число", "сходится") + "</dl>";
    } else if (s.length === 9) {
      var k = DlkKppInn.kpp(s, regiony);
      if (k.oshibka && !k.pp) { rez.innerHTML = '<p class="ras__osh">' + esc(k.oshibka) + "</p>"; return; }
      h = '<div class="ras__kod" aria-hidden="true"><span>' + k.nnnn + "</span><span>" + k.pp + "</span><span>" + k.xxx + "</span></div><dl>" +
        stroka("Цифры 1–4", "код инспекции " + esc(k.nnnn) + "; регион: " + reg(k.nnnn.slice(0, 2), k.region)) +
        stroka("Знаки 5–6", "«" + esc(k.pp) + "» — " + esc(k.prichina)) +
        stroka("Знаки 7–9", "порядковый номер постановки на учёт в этой инспекции — " + esc(k.xxx)) + "</dl>";
    } else {
      h = '<p class="ras__osh">Введите ИНН (10 или 12 цифр) или КПП (9 знаков).</p>';
    }
    rez.innerHTML = h;
  }
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    ozhid = f.v.value;
    zagruzit(function () { pokazat(ozhid); });
    if (window.dlkGoal) window.dlkGoal("kpp_inn_rasshifrovka");
  });
})();
