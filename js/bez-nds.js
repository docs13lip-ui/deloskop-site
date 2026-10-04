/* Делоскоп — «Без НДС» при большой выручке: /proverit-schet/ и «Кому вы платите» (/kontragenty-iz-vypiski/).
 * Счёт «без НДС» от поставщика на упрощёнке законен, пока его доход за прошлый год не больше порога
 * п. 1 ст. 145 НК РФ (ред. 228-ФЗ от 04.07.2026): 20 млн ₽ за 2025–2028 годы, 15 млн ₽ за 2029-й,
 * 10 млн ₽ за 2030-й и дальше. Сверено [Налоговым юристом] — sroki.json, id usn_nds_porog.
 * Данные — из ответа /api/check: выручка (строка 2110) по годам из ГИР БО ФНС — dossier.charts.revenue,
 * налоговый режим — строка «Налоговый режим» раздела activity (открытые данные ФНС «СНР» и DaData).
 * Честно о пределах: выручка по бухотчётности ≠ доход по правилам упрощёнки, а «без НДС» законно и при
 * большой выручке по льготным операциям (ст. 149 НК РФ). Поэтому это информационная строка («спросите»),
 * а не красный флаг. ИП не показываем (у ИП нет бухотчётности; данные ИП не публикуем).
 * Чистые функции: без DOM, без сети. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DlkBezNds = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Порог дохода за год `godDohoda`, выше которого в следующем году освобождения нет (п. 1 ст. 145 НК РФ).
  function porog(godDohoda) {
    if (godDohoda < 2025) return null;          // старые годы — другие пороги, не считаем
    if (godDohoda <= 2028) return 20e6;         // 20 млн ₽ — доход за 2025–2028 годы
    if (godDohoda === 2029) return 15e6;
    return 10e6;
  }

  function mln(n) {
    var x = Math.round(n / 1e5) / 10;
    return String(x).replace(".", ",") + " млн ₽";
  }

  // Режим из досье: "usn" | "drugoj" (АУСН, ЕСХН, патент, СРП, ОСН — правило не то) | null (не знаем)
  function rezhim(dossier) {
    var secs = (dossier && dossier.sections) || [];
    for (var i = 0; i < secs.length; i++) {
      var rows = secs[i].rows || [];
      for (var j = 0; j < rows.length; j++) {
        if (rows[j][0] !== "Налоговый режим") continue;
        var v = String(rows[j][1] || "");
        if (/АУСН|ЕСХН|СРП|Патент|ПСН|ОСН|Общая/i.test(v)) return "drugoj";
        if (/УСН/.test(v)) return "usn";
        return null;
      }
    }
    return null;
  }

  /* noVat — в счёте «Без НДС» / «НДС не облагается»; remote — ответ /api/check; segodnya — Date.
   * → {st:'info', title, detail} или null (молчим, если не уверены). */
  function stroka(noVat, remote, segodnya) {
    if (!noVat || !remote) return null;
    var co = remote.company || {};
    if (co.inn && String(co.inn).length !== 10) return null;            // ИП — не показываем
    var d = remote.dossier || {};
    var rz = rezhim(d);
    if (rz === "drugoj") return null;
    var god = (segodnya || new Date()).getFullYear() - 1;               // доход прошлого года решает этот год
    var p = porog(god);
    if (!p) return null;
    var ryad = (d.charts && d.charts.revenue) || [];
    var t = null;
    for (var i = 0; i < ryad.length; i++) if (ryad[i] && ryad[i].year === god) t = ryad[i];
    if (!t || typeof t.value !== "number" || t.value <= p) return null;   // нет отчётности за год — молчим
    var nachalo = rz === "usn"
      ? "Поставщик на упрощёнке, выручка за " + god + " год по бухотчётности — " + mln(t.value) + ". Освобождение"
      : "Выручка поставщика за " + god + " год по бухотчётности — " + mln(t.value) + ". Если он на упрощёнке, освобождение";
    return {
      st: "info",
      title: "Без НДС",
      detail: nachalo + osvobozhdenie(god, p) + " Спросите поставщика, на каком основании " +
        "счёт без НДС. Что будет с ценой, если НДС появится, — заранее в договоре: пункт 2.2 Делописи."
    };
  }

  // Общая середина строки — одна для «Проверь счёт» и «Кому вы платите» (текст сверяет [Налоговый юрист]).
  function osvobozhdenie(god, p) {
    return " от НДС в " + (god + 1) + " году — только при доходе за " + god + " год до " + mln(p) +
      " (п. 1 ст. 145 НК РФ), выше — счёт выставляют с НДС: по общей ставке или по ставке 5 или 7\u00a0%. " +
      "Доход для порога считают по правилам упрощёнки, не по бухотчётности, а «без НДС» законно и при льготной " +
      "операции (ст. 149 НК РФ) — поэтому это вопрос, а не нарушение.";
  }

  function rub(n) {
    return Math.round(n).toLocaleString("ru-RU").replace(/[\s\u202f]/g, "\u00a0") + "\u00a0₽";
  }

  // Режим из ответа /api/shield/counterparties (открытые данные ФНС «СНР»): "usn" | "ausn" | "eshn" | "srp" | null.
  // null — компании нет в наборе спецрежимов: общая система или набор отстаёт → говорим условно.
  function rezhimKoda(k) {
    if (k === "usn") return "usn";
    if (k === "ausn" || k === "eshn" || k === "srp") return "drugoj";
    return null;
  }

  /* «Кому вы платите» (/kontragenty-iz-vypiski/): s — поставщик из DeloVypiska.analyze (inn, kind, noVatGod —
   * {год: сумма платежей с «без НДС» в назначении}); rm — элемент ответа /api/shield/counterparties
   * (rezhim, dohod — «СумДоход» набора ФНС revexp, dohod_na — 31.12 отчётного года).
   * Судим только платежи года, следующего за годом дохода: платили в 2026-м — решает доход за 2025-й.
   * → {level:'info', code:'bez_nds', text} или null. */
  function strokaVypiski(s, rm) {
    if (!s || !rm || s.kind !== "org" || !s.inn || String(s.inn).length !== 10) return null;
    var rz = rezhimKoda(rm.rezhim);
    if (rz === "drugoj") return null;
    if (typeof rm.dohod !== "number" || !/^\d{4}-/.test(String(rm.dohod_na || ""))) return null;
    var god = parseInt(String(rm.dohod_na).slice(0, 4), 10);
    var p = porog(god);
    if (!p || rm.dohod <= p) return null;
    var summa = (s.noVatGod || {})[god + 1];
    if (!(summa > 0)) return null;
    var dohod = "доход за " + god + " год по бухотчётности — " + mln(rm.dohod) + " (открытые данные ФНС).";
    var nachalo = "Платежи «без НДС» в " + (god + 1) + " году — " + rub(summa) + ". " + (rz === "usn"
      ? "Поставщик на упрощёнке, " + dohod + " Освобождение"
      : "Поставщик: " + dohod + " Если он на упрощёнке, освобождение");
    return {
      level: "info",
      code: "bez_nds",
      text: nachalo + osvobozhdenie(god, p) + " Спросите поставщика, на каком основании платежи без НДС. " +
        "Что будет с ценой, если НДС появится, — заранее в договоре: пункт 2.2 Делописи."
    };
  }


  /* nds-porog-v1 (Ночные-2, 03.10): «НДС в 2027 году» — честная строка «у порога» (решение владельца 03.10,
   * ТЗ claude/Продукт_НДС-2027_честная_строка_у_порога_03.10.md разд. 2 и 6; тексты — [Право · Налоговый юрист]
   * 03.10 21:10, claude/Право_Старт_390_оферта_НДС-2027_Вокфорс_03.10.md разд. 2, дословно).
   * Будет ли НДС у поставщика в году T, решает его доход за T−1 — отчётности за T−1 до апреля T ни у кого нет.
   * Поэтому смотрим выручку за T−2 рядом с порогом. Работает с 1 января T−1 до 1 мая T и только пока в ряду нет
   * выручки за T−1 (появилась — ответ уже не прогноз, строка молчит). T по умолчанию — 2027.
   * Только организации (10 цифр) и только упрощёнка, названная в досье: режим неизвестен — молчим (компании нет
   * в наборе спецрежимов — скорее общая система; «Поставщик на упрощёнке» было бы неправдой).
   * → {kod, st:'info', title, detail, vyruchka, god, rost} или null.
   *   uzhe_platit — выручка T−2 > порога; u_poroga — 15 млн < выручка ≤ порога (ровно порог — «не превысили»);
   *   u_poroga_rost — то же + рост к T−3 такой, что при нём доход T−1 превысит порог (оценка — так и пишем);
   *   osvobozhdena — выручка ≤ 15 млн: на экране молчим, на карточке — нейтральный факт (tests/kartochka_render.py). */
  var GOD_PROGNOZA = 2027, BLIZKO = 15e6;
  function prognoz(remote, segodnya, T) {
    T = T || GOD_PROGNOZA;
    if (!remote) return null;
    var co = remote.company || {};
    if (!/^\d{10}$/.test(String(co.inn || ""))) return null;               // ИП и без ИНН — не показываем
    var sg = segodnya || new Date();
    if (sg < new Date(T - 1, 0, 1) || sg >= new Date(T, 4, 1)) return null; // окно: с 01.01.(T−1) до 01.05.T
    var d = remote.dossier || {};
    if (rezhim(d) !== "usn") return null;
    var R = T - 2, p = porog(R), pTek = porog(T - 1);
    if (!p || !pTek) return null;
    var ryad = (d.charts && d.charts.revenue) || [], v = null, v0 = null;
    for (var i = 0; i < ryad.length; i++) {
      var x = ryad[i];
      if (!x || typeof x.value !== "number") continue;
      if (x.year === T - 1) return null;                                    // отчётность за T−1 есть — не прогноз
      if (x.year === R) v = x.value;
      if (x.year === R - 1) v0 = x.value;
    }
    if (v == null || v <= 0) return null;
    // 20 000 001 ₽ в «млн» округлится до порога — тогда пишем рубли, иначе «20 млн ₽, выше порога 20 млн ₽»
    var vyr = "Поставщик на упрощёнке, выручка за " + R + " год по бухотчётности — " + (mln(v) === mln(p) && v !== p ? rub(v) : mln(v));
    var hvost = " " + HVOST;
    if (v > p) {
      return { kod: "uzhe_platit", st: "info", title: "НДС в " + (T - 1) + " году", vyruchka: v, god: R, rost: null,
        detail: vyr + ", выше порога " + mln(p) + ". Поэтому в " + (T - 1) + " году он, вероятно, платит НДС — по общей " +
          "ставке или по ставке 5 или 7\u00a0% (п. 8 ст. 164 НК РФ). Если в счёте «Без НДС» — спросите основание." + hvost };
    }
    if (v <= BLIZKO) return { kod: "osvobozhdena", st: "info", title: "НДС в " + T + " году", vyruchka: v, god: R, rost: null, detail: "" };
    var rost = v0 > 0 ? v / v0 - 1 : null;
    var sRostom = rost != null && rost > 0 && v * (1 + rost) > pTek;
    var detail = vyr + ", у порога " + mln(p) + ". Если доход за " + (T - 1) + " год превысит " + mln(pTek) +
      ", в " + T + " году освобождения от НДС не будет (п. 1 ст. 145 НК РФ). Если превысит уже в " + (T - 1) +
      " году — НДС появится с 1-го числа следующего месяца (п. 5 ст. 145 НК РФ). Спросите поставщика, будет ли НДС " +
      "в счетах " + T + " года, и закрепите в договоре, что будет с ценой: пункт 2.2 Делописи.";
    if (sRostom) {
      detail += " За " + R + " год выручка выросла на " + procent(rost) + " %. Если рост сохранится, доход за " +
        (T - 1) + " год превысит " + mln(pTek) + ". Это наша оценка по двум годам отчётности, а не данные ФНС.";
    }
    return { kod: sRostom ? "u_poroga_rost" : "u_poroga", st: "info", title: "НДС в " + T + " году", vyruchka: v, god: R,
      rost: sRostom ? rost : null, detail: detail + hvost };
  }

  function procent(x) { var n = x * 100; return n >= 1 ? String(Math.round(n)) : String(Math.round(n * 10) / 10).replace(".", ","); }

  // Хвост для всех строк «НДС в 2027 году» — существующая середина osvobozhdenie(), утверждена [Право] 21:10 без правок.
  var HVOST = "Доход для порога считают по правилам упрощёнки, не по бухотчётности, а «без НДС» законно и при льготной " +
    "операции (ст. 149 НК РФ) — поэтому это вопрос, а не нарушение.";

  // Подпись под строкой: «Режим — открытые данные ФНС на [дата набора]; выручка — бухотчётность ГИР БО за 2025 год.»
  // Дата набора — из dossier.data_dates («… режим… — на ДД.ММ.ГГГГ»); нет даты — без неё (не выдумываем).
  function podpis(remote, god) {
    var s = String(((remote || {}).dossier || {}).data_dates || ""), data = "";
    s.split(";").forEach(function (ch) {
      var m = /^\s*(.+?)\s+—\s+(?:на\s+)?(\d{2}\.\d{2}\.\d{4})\s*$/.exec(ch);
      if (m && !data && /режим/i.test(m[1])) data = m[2];
    });
    return "Режим — открытые данные ФНС" + (data ? " на " + data : "") + "; выручка — бухотчётность ГИР БО за " + god + " год.";
  }

  // «Кому вы платите»: сколько поставщиков-организаций на упрощёнке с доходом за T−2 от 15 млн ₽ до порога включительно
  // (rm — элементы ответа /api/shield/counterparties: rezhim, dohod — набор ФНС revexp, dohod_na). Ровно, без прогноза.
  function uPorogaVypiski(spisok, T) {
    T = T || GOD_PROGNOZA;
    var R = T - 2, p = porog(R), n = 0;
    (spisok || []).forEach(function (rm) {
      if (!rm || !/^\d{10}$/.test(String(rm.inn || "")) || rezhimKoda(rm.rezhim) !== "usn") return;
      if (typeof rm.dohod !== "number" || String(rm.dohod_na || "").slice(0, 4) !== String(R)) return;
      if (rm.dohod > BLIZKO && rm.dohod <= p) n++;
    });
    return n;
  }

  return { porog: porog, rezhim: rezhim, stroka: stroka, mln: mln, rezhimKoda: rezhimKoda, strokaVypiski: strokaVypiski,
    prognoz: prognoz, podpis: podpis, uPorogaVypiski: uPorogaVypiski, HVOST: HVOST, GOD_PROGNOZA: GOD_PROGNOZA };
});
