/* Делоскоп — тарифы: «Подбор без переплаты» и «Окупаемость в рублях».
   Цены и нормы — из tarify.json (встроен в страницу как #tarify-data).
   Чистые функции podobrat() и okupaemost() экспортируются для автотестов (node). */
(function (root) {
  "use strict";

  // Пени за 2 года по ст. 75 НК: 1–30 дней — 1/300 ставки, 31–90 — 1/150, с 91-го — 1/300.
  function doliPenej(stavka) { return stavka * (30 / 300 + 60 / 150 + 640 / 300); }

  function cenaGoda(t, period) { return period === "god" ? t.god : t.mesyac * 12; }

  /* Подбор: самый дешёвый тариф, которого хватает. Отчёты сверх лимита — пакетами,
     слежение и число людей пакетами не докупаются. При равной цене — тариф выше. */
  function podobrat(D, nuzhno, period) {
    var R = Math.max(0, Math.floor(nuzhno.otchetov || 0));
    var W = Math.max(0, Math.floor(nuzhno.slezhenie || 0));
    var U = Math.max(1, Math.floor(nuzhno.polzovatelej || 1));
    var pak = D.paket_otchetov;
    var var_ = [];
    D.tarify.forEach(function (t, i) {
      if (t.slezhenie < W || t.polzovatelej < U) return;
      if (nuzhno.delopis && !t.delopis) return;
      if (nuzhno.vypiska && !t.vypiska) return;
      var dobor = Math.max(0, R - t.otchetov);
      if (dobor > 0 && t.mesyac === 0) return;          // пакеты — только к платному тарифу
      var pakety = Math.ceil(dobor / pak.shtuk);
      var god = cenaGoda(t, period) + pakety * pak.cena * 12;
      var_.push({ id: t.id, nazvanie: t.nazvanie, i: i, pakety: pakety, god: god, mesyac: god / 12 });
    });
    var_.sort(function (a, b) { return a.god - b.god || b.i - a.i; });
    var luchshij = var_[0] || null;
    var sleduyushchij = var_[1] || null;
    var bolshe = U > 5 || W > 50;
    return { luchshij: luchshij, alternativa: sleduyushchij, individualno: bolshe || !luchshij };
  }

  /* Окупаемость: что стоит на кону и во сколько раз это больше цены тарифа.
     rezhim: "osn" — вычет НДС 22%; "usn15" — расходы по ставке 15%; "usn6" — налогового риска по вычетам нет. */
  function okupaemost(D, vvod, cenaGodTarifa) {
    var r = D.raschet;
    var S = Math.max(0, vvod.summa || 0);
    var nalog = 0;
    if (vvod.rezhim === "osn") {
      nalog = S * r.nds / (100 + r.nds);
      if (vvod.pribyl) nalog += (S - S * r.nds / (100 + r.nds)) * r.nalog_na_pribyl / 100;
    } else if (vvod.rezhim === "usn15") {
      nalog = S * 0.15;
    }
    var shtraf = nalog * r.shtraf_122 / 100;
    var peni = nalog * doliPenej(r.klyuchevaya_stavka);
    var naKonu = nalog + shtraf + peni;
    var dni = vvod.dni || r.dnej_prostoya_po_umolchaniyu;
    var prostoj = Math.max(0, vvod.oborot || 0) / r.rabochih_dnej_v_mesyace * dni;
    var res = {
      nalog: nalog, shtraf: shtraf, peni: peni, naKonu: naKonu, prostoj: prostoj, dni: dni,
      dolyaOtSdelki: naKonu > 0 ? cenaGodTarifa / naKonu : null,
      razVLet: naKonu > 0 && cenaGodTarifa > 0 ? Math.floor(naKonu / cenaGodTarifa) : null,
      dolyaOtProstoya: prostoj > 0 ? cenaGodTarifa / prostoj : null
    };
    return res;
  }

  /* Две кнопки оплаты в карточке: главная — под выбранный период, вторая — тихая ссылка на другой.
     Меняем местами href и data-srok, чтобы модуль оплаты получил верный срок. */
  function knopki(srok, doc) {
    doc = doc || (typeof document !== "undefined" ? document : null);
    if (!doc) return;
    doc.querySelectorAll(".knopki").forEach(function (k) {
      var a = k.querySelector(".cta"), b = k.querySelector(".cta2");
      if (!a || !b || a.getAttribute("data-srok") === srok) return;
      var h = a.getAttribute("href"); a.setAttribute("href", b.getAttribute("href")); b.setAttribute("href", h);
      a.setAttribute("data-srok", srok); b.setAttribute("data-srok", srok === "god" ? "mes" : "god");
      a.textContent = srok === "god" ? "Оплатить год" : "Оплачивать помесячно";
      b.textContent = srok === "god" ? "Оплачивать помесячно — " + k.getAttribute("data-cena-m") : "Оплатить год — " + k.getAttribute("data-cena-g");
    });
  }

  var API = { podobrat: podobrat, okupaemost: okupaemost, doliPenej: doliPenej, knopki: knopki };
  if (typeof module !== "undefined" && module.exports) { module.exports = API; return; }
  root.DeloskopTarify = API;

  // ---------- страница ----------
  var el = document.getElementById("tarify-data");
  if (!el) return;
  var D = JSON.parse(el.textContent);
  var $ = function (id) { return document.getElementById(id); };
  var period = "mes";  // по умолчанию помесячно (владелец, 26.09.2026)

  function rub(x) { return Math.round(x).toLocaleString("ru-RU").replace(/ |,/g, " ") + " ₽"; }
  function chislo(inp) { var v = +String(inp.value).replace(/\D/g, ""); return isFinite(v) ? v : 0; }
  function format(inp) {
    var raw = String(inp.value).replace(/\D/g, "");
    inp.value = raw ? (+raw).toLocaleString("ru-RU") : "";
  }
  function procent(x) {
    if (x == null) return "—";
    var p = x * 100;
    if (p < 0.1) return "меньше 0,1%";
    if (p < 10) return p.toFixed(1).replace(".", ",") + "%";
    return Math.round(p) + "%";
  }
  function letSlovo(n) {
    var a = n % 10, b = n % 100;
    if (b >= 11 && b <= 14) return "лет";
    if (a === 1) return "год";
    if (a >= 2 && a <= 4) return "года";
    return "лет";
  }
  function tarifPoId(id) { for (var i = 0; i < D.tarify.length; i++) if (D.tarify[i].id === id) return D.tarify[i]; }

  // переключатель периода
  document.querySelectorAll("[data-period]").forEach(function (b) {
    b.addEventListener("click", function () {
      period = b.getAttribute("data-period");
      document.querySelectorAll("[data-period]").forEach(function (x) {
        var on = x.getAttribute("data-period") === period;
        x.classList.toggle("on", on); x.setAttribute("aria-pressed", on ? "true" : "false");
      });
      document.querySelectorAll("[data-m]").forEach(function (n) { n.textContent = n.getAttribute(period === "god" ? "data-y" : "data-m"); });
      knopki(period === "god" ? "god" : "mes");
      schet();
    });
  });

  var polya = ["p-otch", "p-slezh", "p-lyudi", "p-summa", "p-oborot"];
  polya.forEach(function (id) {
    var inp = $(id); if (!inp) return;
    inp.addEventListener("input", function () { if (inp.dataset.den) format(inp); schet(); });
  });
  ["p-delopis", "p-rezhim", "p-pribyl", "p-nal"].forEach(function (id) { var x = $(id); if (x) x.addEventListener("change", schet); });

  function schet() {
    var nuzhno = { otchetov: chislo($("p-otch")), slezhenie: chislo($("p-slezh")), polzovatelej: chislo($("p-lyudi")) || 1, delopis: $("p-delopis").checked };
    var p = podobrat(D, nuzhno, period);
    var box = $("itog");
    if (p.individualno) {
      box.dataset.ton = "ind";
      $("i-nazv").textContent = "Под вашу команду";
      $("i-cena").textContent = "Рассчитаем";
      $("i-per").textContent = "Больше 5 сотрудников или 50 компаний на слежении — соберём тариф под вас.";
      $("i-pochemu").innerHTML = '<li>Напишите на <a href="mailto:help@deloskop.ru?subject=%D0%A2%D0%B0%D1%80%D0%B8%D1%84%20%D0%BF%D0%BE%D0%B4%20%D0%BA%D0%BE%D0%BC%D0%B0%D0%BD%D0%B4%D1%83">help@deloskop.ru</a>: сколько людей, компаний и отчётов.</li>';
      $("i-alt").textContent = "";
      okup(tarifPoId("biznes"), cenaGoda(tarifPoId("biznes"), period));
      return;
    }
    var L = p.luchshij, t = tarifPoId(L.id);
    box.dataset.ton = L.id;
    $("i-nazv").textContent = L.pakety ? t.nazvanie + " + " + L.pakety + " " + (L.pakety === 1 ? "пакет" : L.pakety < 5 ? "пакета" : "пакетов") + " отчётов" : t.nazvanie;
    $("i-cena").textContent = L.god === 0 ? "0 ₽" : rub(L.mesyac) + " в месяц";
    $("i-per").textContent = L.god === 0 ? "Платить не нужно — бесплатного хватит." :
      (period === "god" ? "При оплате за год — " + rub(L.god) + (L.pakety ? " вместе с пакетами" : "") : "При оплате помесячно — " + rub(L.god) + " за год");
    var pochemu = [];
    if (t.id === "free") pochemu.push("Подробных отчётов и слежения вам не нужно — хватит трёх проверок в день.");
    else {
      pochemu.push("Отчётов в тарифе: " + t.otchetov + (L.pakety ? ", ещё " + L.pakety * D.paket_otchetov.shtuk + " — пакетами по " + rub(D.paket_otchetov.cena) : "") + ".");
      pochemu.push("Слежение: до " + t.slezhenie + " компаний" + (t.polzovatelej > 1 ? ", до " + t.polzovatelej + " сотрудников" : "") + ".");
      if (nuzhno.delopis) pochemu.push("Делопись есть начиная с тарифа «Про».");
    }
    $("i-pochemu").innerHTML = pochemu.map(function (s) { return "<li>" + s + "</li>"; }).join("");
    var A = p.alternativa;
    if (A) {
      var ta = tarifPoId(A.id), raz = A.god - L.god;
      var bolsheDaet = ta.slezhenie > t.slezhenie || ta.otchetov > t.otchetov || (ta.delopis && !t.delopis);
      if (raz <= 0) $("i-alt").textContent = "«" + ta.nazvanie + "» стоит столько же, но даёт больше — берите его.";
      else if (bolsheDaet && raz <= L.god * 0.1)
        $("i-alt").textContent = "«" + ta.nazvanie + "» дороже всего на " + rub(raz) + " в год, но даёт больше: " +
          ta.otchetov + " отчётов в месяц, слежение за " + ta.slezhenie + " компаниями" + (ta.delopis && !t.delopis ? ", Делопись" : "") + ". Решайте сами.";
      else $("i-alt").textContent = "«" + ta.nazvanie + "»" + (A.pakety ? " с пакетами" : "") + " обошёлся бы на " + rub(raz) + " в год дороже — не переплачивайте.";
    } else $("i-alt").textContent = "";
    okup(t, L.god);
  }

  function okup(t, godCena) {
    var vvod = { summa: chislo($("p-summa")), rezhim: $("p-rezhim").value, pribyl: $("p-pribyl").checked, oborot: chislo($("p-oborot")) };
    $("p-pribyl-l").hidden = vvod.rezhim !== "osn";
    var o = okupaemost(D, vvod, godCena);
    $("o-nalog").textContent = rub(o.naKonu);
    $("o-nalog-sost").textContent = o.naKonu > 0
      ? "налог " + rub(o.nalog) + " + штраф " + rub(o.shtraf) + " + пени за 2 года " + rub(o.peni)
      : "на УСН «доходы» вычетов нет — налоговая не снимет их из-за поставщика";
    $("o-prostoj").textContent = rub(o.prostoj);
    var vyvod;
    if (godCena === 0) vyvod = "Бесплатный тариф ничего не стоит — но и не следит за партнёрами. Когда появятся постоянные поставщики, вернитесь к расчёту.";
    else if (o.naKonu > 0 && o.razVLet >= 1) {
      var n = o.razVLet;
      vyvod = "Год тарифа — " + procent(o.dolyaOtSdelki) + " от одной неудачной сделки. Он окупится, даже если убережёт вас от такой сделки " +
        (n >= 100 ? "реже, чем раз в сто лет." : "всего раз в " + n + " " + letSlovo(n) + ".");
    } else if (o.naKonu > 0) {
      vyvod = "На сделках такого размера тариф дороже одной ошибки. Он оправдан, только если защищает несколько сделок в год, — иначе выберите тариф попроще.";
    } else {
      vyvod = "Главная защита для вас — счёт и авансы. Год тарифа — " + procent(o.dolyaOtProstoya) + " от денег, которые встанут при блокировке.";
    }
    $("o-vyvod").textContent = vyvod;
    $("o-nal").hidden = !$("p-nal").checked;
  }

  schet();
})(this);
