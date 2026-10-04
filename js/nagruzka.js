/* Делоскоп — «Налоговая нагрузка против отрасли» (/nalogi/nagruzka/, справочник /nalogi/nagruzka-po-otraslyam-2025/).
 * Нормы — data/fns-normy-2025.json: приложения 3–4 к приказу ФНС № ММ-3-06/333@, Информация ФНС от 05.05.2026.
 * Правила и тексты — claude/Налоговый_юрист_нагрузка_против_отрасли_27.09.md (§ 2 — четыре ловушки, § 3 — тексты):
 *   1) норма ФНС включает НДФЛ → без НДФЛ наша оценка ниже: «красный» только ниже 50 % нормы, 50–100 % — «внимание»;
 *   2) знаменатель — доходы по бухотчётности, у ФНС — оборот Росстата → слово «оценка» всегда;
 *   3) УСН — с общей нормой не сравниваем, не красим;
 *   4) доходы меньше 1 млн ₽ или нет данных — «данных нет», а не «ниже нормы»; «красный» — только при доходах ≥ 10 млн ₽.
 * Строка нормы — самая подробная, в которую входит ОКВЭД (подкласс → класс → раздел). Не нашли — «Всего по РФ»
 * НЕ подставляем. Запрещённые формулировки (обещания исхода, «безопасный» уровень) — список в tests/nagruzka.test.js.
 * Чистые функции: без DOM и сети (кроме init в браузере). Считается в браузере, ничего не отправляем. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DlkNagruzka = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var NBSP = " ";
  var MIN_DOHOD = 1e6;      // ловушка 4: меньше — «данных мало»
  var KRASNYJ_DOHOD = 10e6; // «красный» — только от 10 млн ₽ дохода

  function cifry(kod) { return String(kod || "").replace(/[^0-9]/g, ""); }

  // Код ОКВЭД-2 из ввода: «41.20», «41.2», «4120», «ОКВЭД 46.90» → «41.20». Плохой ввод → "".
  function okvedIzVvoda(s) {
    var m = String(s || "").match(/\d{2}(?:\.\d{1,2}){1,2}/);
    if (m) return m[0];
    var d = cifry(s);
    if (d.length < 2 || d.length > 6) return "";
    var out = d.slice(0, 2);
    if (d.length > 2) out += "." + d.slice(2, 4);
    if (d.length > 4) out += "." + d.slice(4, 6);
    return out;
  }

  // Самая подробная строка таблицы, в которую входит код (по цифрам: 49.41.1 → «4941 1» входит в «49.4», «49», …).
  function najti(okved, stroki) {
    var d = cifry(okved);
    if (d.length < 2 || !stroki) return null;
    var luchshaya = null, dlina = 0;
    for (var i = 0; i < stroki.length; i++) {
      var ok = stroki[i].okved || [];
      for (var j = 0; j < ok.length; j++) {
        var p = cifry(ok[j]);
        // при равной длине — строка подробнее раздела (46 «оптовая» точнее раздела G, где тоже есть «46»)
        var luchshe = p.length > dlina || (p.length === dlina && luchshaya && /^[A-Z]$/.test(luchshaya.kod) && !/^[A-Z]$/.test(stroki[i].kod));
        if (p && d.indexOf(p) === 0 && luchshe) { luchshaya = stroki[i]; dlina = p.length; }
      }
    }
    return luchshaya;
  }

  // nagruzka-yakorya-v1: якорь строки в справочнике — «n-35-1», «n-f», «n-vsego» (как tests/sobrat_nagruzka.py yakor).
  var SPRAVOCHNIK = "/nalogi/nagruzka-po-otraslyam-2025/";
  function yakor(kod, tablica) {
    var k = kod === "ВСЕГО" ? "vsego" : String(kod || "").toLowerCase().replace(/[^0-9a-z]+/g, "-").replace(/^-+|-+$/g, "");
    return (tablica || "n") + "-" + k;
  }

  function pct(x) {
    var r = Math.round(x * 10) / 10;
    return String(r).replace(".", ",") + (String(r).indexOf(".") < 0 ? ",0" : "") + "%";
  }

  // «раздел F «Строительство»» / «ОКВЭД 46 «торговля оптовая…»» — с чем сравнили.
  function podpisStroki(s) {
    var nazv = String(s.nazvanie).replace(/\s+-\s+всего$/i, "");
    var kod = /^[A-Z]$/.test(s.kod) ? "раздел " + s.kod : "ОКВЭД " + s.kod;
    return kod + " «" + nazv + "»";
  }

  /* vvod: { okved, dohody (₽ за год), nalogi (₽, уплачено за год, без страховых взносов), sNdfl (true — в сумме есть
   *        НДФЛ за работников), rezhim ("osn" | "usn"), god (год нормы, по умолчанию 2025) }
   * Возвращает { st, n, norma, stroka, raz, zagolovok, tekst, podpis }.
   * st: "net-dannyh" | "usn" | "net-normy" | "zelenyj" | "zheltyj" | "krasnyj". */
  function ocenka(vvod, dannye) {
    var god = String(vvod.god || 2025);
    var dohody = Number(vvod.dohody), nalogi = Number(vvod.nalogi);
    var r = { st: "", n: null, norma: null, stroka: null, ssylka: null, raz: null, zagolovok: "Налоговая нагрузка против отрасли", tekst: "", podpis: "" };
    r.podpis = "Оценка по методике калькулятора ФНС: уплаченные налоги без страховых взносов / доходы за " + god +
      " год. Норма — приложение 3 к приказу ФНС № ММ-3-06/333@, Информация ФНС от 05.05.2026. Страховые взносы не учитываются — как и в норме ФНС. Считается в вашем браузере, ничего не отправляем.";

    if (!isFinite(dohody) || !isFinite(nalogi) || dohody < MIN_DOHOD || nalogi < 0) {
      r.st = "net-dannyh";
      r.tekst = "Для сравнения нужны доходы за год — от 1" + NBSP + "млн" + NBSP + "₽ — и сумма уплаченных налогов. " +
        "У новой компании или при нулевой отчётности сравнивать не с чем — это не значит «всё плохо».";
      return r;
    }
    r.n = nalogi / dohody * 100;

    if (vvod.rezhim === "usn") {
      r.st = "usn";
      r.tekst = "Налоги — " + pct(r.n) + " от доходов. Вы на упрощённой системе. Общая отраслевая норма ФНС включает НДС и налог на прибыль, " +
        "поэтому сравнивать с ней упрощенца некорректно — мы этого не делаем.";
      return r;
    }

    var stroki = dannye && dannye.nagruzka;
    var s = najti(vvod.okved, stroki);
    if (!s || typeof s.nagruzka[god] !== "number") {
      r.st = "net-normy";
      r.tekst = "Налоги — " + pct(r.n) + " от доходов. Отраслевой нормы для вашего вида деятельности ФНС не публикует: " +
        "в таблице ФНС есть не все разделы ОКВЭД. Со средней «Всего по РФ» не сравниваем — это была бы другая отрасль.";
      return r;
    }
    r.stroka = s;
    r.ssylka = SPRAVOCHNIK + "#" + yakor(s.kod);
    r.norma = s.nagruzka[god];
    r.raz = Math.round((r.norma - r.n) * 10) / 10;
    var dolya = r.n / r.norma;
    var golova = "Ваша нагрузка — " + pct(r.n) + ". Средняя по отрасли — " + pct(r.norma) + " (" + podpisStroki(s) + ", ФНС, " + god + " год). ";
    var ndfl = vvod.sNdfl
      ? ""
      : "В вашем расчёте нет НДФЛ за работников, а в норме ФНС он есть, поэтому настоящая нагрузка, скорее всего, выше. ";

    if (dolya >= 1) {
      r.st = "zelenyj";
      r.tekst = golova + "Нагрузка не ниже отраслевой — по этому признаку налоговая компанию на проверку не отбирает.";
    } else if (dolya >= 0.5 || dohody < KRASNYJ_DOHOD) {
      r.st = "zheltyj";
      r.tekst = golova + "Разница: " + String(r.raz).replace(".", ",") + NBSP + "п." + NBSP + "п. " + ndfl +
        "Само по себе это не нарушение: ФНС сравнивает нагрузку с отраслью как один из 12 признаков при отборе на выездную проверку.";
    } else {
      r.st = "krasnyj";
      var vRaz = r.n > 0 ? ": в " + Math.round(r.norma / r.n) + NBSP + "раз ниже" : "";
      r.tekst = golova.replace(/\. $/, "") + vRaz + ". " + ndfl +
        "Нагрузка ниже среднеотраслевой — первый из 12 признаков, по которым налоговая выбирает компании для выездной проверки " +
        "(приказ ФНС № ММ-3-06/333@). Это не вывод о нарушении — возможны убытки, крупные вычеты или особенности бизнеса.";
    }
    return r;
  }

  // ---- браузер: калькулятор на /nalogi/nagruzka/ ----
  function chislo(s) { var x = Number(String(s || "").replace(/[\s ]/g, "").replace(",", ".")); return isFinite(x) ? x : NaN; }

  function init(doc, dannye) {
    var f = doc.getElementById("nagruzka-forma");
    if (!f) return;
    var vyhod = doc.getElementById("nagruzka-itog");
    function poschitat(e) {
      if (e) e.preventDefault();
      var r = ocenka({
        okved: okvedIzVvoda(f.okved.value),
        dohody: chislo(f.dohody.value),
        nalogi: chislo(f.nalogi.value),
        sNdfl: f.ndfl.checked,
        rezhim: f.rezhim.value,
      }, dannye);
      vyhod.className = "itog itog--" + r.st;
      vyhod.hidden = false;
      vyhod.querySelector("[data-tekst]").textContent = r.tekst;
      vyhod.querySelector("[data-podpis]").textContent = r.podpis;
      var sp = vyhod.querySelector("[data-stroka-p]");
      if (sp) {
        sp.hidden = !r.ssylka;
        if (r.ssylka) sp.querySelector("a").setAttribute("href", r.ssylka);
      }
      var shkala = vyhod.querySelector("[data-shkala]");
      if (r.norma) {
        var max = Math.max(r.n, r.norma) * 1.1;
        shkala.hidden = false;
        shkala.querySelector("[data-vy]").style.width = Math.min(100, r.n / max * 100) + "%";
        shkala.querySelector("[data-otr]").style.width = Math.min(100, r.norma / max * 100) + "%";
        shkala.querySelector("[data-vy-t]").textContent = "Вы — " + pct(r.n);
        shkala.querySelector("[data-otr-t]").textContent = "Отрасль — " + pct(r.norma);
      } else shkala.hidden = true;
    }
    f.addEventListener("submit", poschitat);
  }

  return { yakor: yakor, najti: najti, ocenka: ocenka, okvedIzVvoda: okvedIzVvoda, pct: pct, podpisStroki: podpisStroki, init: init, chislo: chislo };
});
