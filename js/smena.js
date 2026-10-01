/* Делоскоп — «Поставщик сменил реквизиты?» на /proverit-schet/ (#smena).
 * Сравниваем прежние и новые реквизиты прямо в браузере: ничего не уходит на сервер.
 * Подмена реквизитов в письме — частый способ увести оплату: письмо выглядит как от поставщика,
 * а счёт в нём — чужой. Контрольный ключ такую подмену не ловит (чужой счёт — тоже верный),
 * поэтому мы показываем, ЧТО именно поменялось, и что сверить вне письма.
 * Счета по плану счетов Банка России (Положение № 809-П): 40702 — коммерческая организация,
 * 40802 — ИП, 40817/40820 и 423 — личные счета и вклады физических лиц.
 * Только textContent и createElement — никакой вставки HTML из текста пользователя.
 * Цель Метрики smena_sravnit (только с согласия — window.dlkGoal сам проверяет). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DlkSmena = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var NB = " ";

  function innOk(s) {
    if (!/^\d{10}$|^\d{12}$/.test(s || "")) return false;
    var d = s.split("").map(Number);
    function k(w, n) { var x = 0; for (var i = 0; i < w.length; i++) x += w[i] * d[i]; return (x % 11) % 10 === d[n]; }
    if (s.length === 10) return k([2, 4, 10, 3, 5, 9, 4, 6, 8], 9);
    return k([7, 2, 4, 10, 3, 5, 9, 4, 6, 8], 10) && k([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8], 11);
  }
  function key23(s) { var w = [7, 1, 3], x = 0; for (var i = 0; i < s.length; i++) x += (+s[i]) * w[i % 3]; return x % 10 === 0; }
  function accOk(bik, acc) { return key23(bik.slice(-3) + acc); }
  function ksOk(bik, ks) { return key23("0" + bik.slice(4, 6) + ks); }

  /* Разбор: ИНН, КПП, БИК, расчётный и корреспондентский счёт. Пробелы внутри номеров склеиваем. */
  function razobrat(raw) {
    var t = String(raw || "").replace(/ /g, " ").replace(/[ \t]+/g, " ");
    var j = t.replace(/(\d)[ \t]+(?=\d)/g, "$1");
    var r = { inn: null, kpp: null, bik: null, acc: null, ks: null };
    var m, re = /(?:^|\D)(\d{12}|\d{10})(?!\d)/g, pomech = null, lyuboj = null;
    while ((m = re.exec(j))) {
      var v = m[1], pos = m.index + m[0].indexOf(v), pered = j.slice(Math.max(0, pos - 20), pos);
      if (/ИНН/i.test(pered) && !pomech) pomech = v;
      if (innOk(v) && !lyuboj) lyuboj = v;
    }
    r.inn = pomech || lyuboj;
    m = j.match(/КПП[^\d]{0,12}(\d{9})(?!\d)/i) || j.match(/ИНН\s*\/\s*КПП[^\d]{0,12}\d{10}\s*\/\s*(\d{9})(?!\d)/i);
    if (m) r.kpp = m[1];
    m = j.match(/БИК[^\d]{0,12}(\d{9})(?!\d)/i) || j.match(/(?:^|\D)(04\d{7})(?!\d)/);
    if (m) r.bik = m[1];
    var accs = [], rr = /(?:^|\D)(\d{20})(?!\d)/g;
    while ((m = rr.exec(j))) accs.push(m[1]);
    r.ks = accs.filter(function (a) { return a.indexOf("301") === 0; })[0] || null;
    var cand = accs.filter(function (a) { return a.indexOf("301") !== 0; });
    if (r.bik) { var good = cand.filter(function (a) { return accOk(r.bik, a); }); r.acc = good[0] || cand[0] || null; }
    else r.acc = cand[0] || null;
    return r;
  }

  /* Чей счёт — по первым цифрам. null — тип не определяем. */
  function vidScheta(acc) {
    if (!/^\d{20}$/.test(acc || "")) return null;
    var p5 = acc.slice(0, 5);
    if (p5 === "40817" || p5 === "40820" || acc.indexOf("423") === 0 || acc.indexOf("426") === 0) return "fiz";
    if (p5 === "40802") return "ip";
    if (/^40[5-7]0[1-3]$/.test(p5)) return "org";
    return null;
  }
  var VID = { fiz: "личный счёт человека", ip: "счёт предпринимателя", org: "счёт организации" };

  function pusto(r) { return !r || (!r.inn && !r.acc && !r.bik); }

  /* Сравнение. Возвращает {uroven: ok|warn|bad|none, zagolovok, tekst, stroki:[{pole, bylo, stalo, uroven, tekst}]} */
  function sravnit(stRaw, noRaw) {
    var a = razobrat(stRaw), b = razobrat(noRaw);
    if (pusto(b)) return { uroven: "none", zagolovok: "Не нашли новых реквизитов", tekst: "Вставьте текст письма или счёта с новыми реквизитами: нужен хотя бы расчётный счёт и БИК.", stroki: [], a: a, b: b };
    if (pusto(a)) return { uroven: "none", zagolovok: "Нужны прежние реквизиты", tekst: "Вставьте реквизиты из договора или прошлого счёта, по которому вы уже платили, — сравним с новыми.", stroki: [], a: a, b: b };
    var s = [], hud = 0;
    function add(pole, bylo, stalo, ur, tekst) {
      s.push({ pole: pole, bylo: bylo || "—", stalo: stalo || "—", uroven: ur, tekst: tekst });
      var w = { ok: 0, neutral: 0, warn: 1, bad: 2 }[ur] || 0;
      if (w > hud) hud = w;
    }
    // 1. Получатель — тот же ли ИНН
    if (!b.inn) add("ИНН получателя", a.inn, null, "warn", "В новых реквизитах нет ИНН — по одному счёту не понять, чей он. Попросите полные реквизиты.");
    else if (!innOk(b.inn)) add("ИНН получателя", a.inn, b.inn, "bad", "Контрольная цифра ИНН не сходится — в номере ошибка.");
    else if (a.inn && a.inn !== b.inn) add("ИНН получателя", a.inn, b.inn, "bad", "Получатель — другая компания или человек: деньги уйдут не вашему поставщику. Если вам говорят, что платить теперь нужно другому, — получите письменное уведомление от самого поставщика (за подписью руководителя) и подтвердите его звонком по известному номеру. Письмо от новой компании само по себе — не основание платить ей.");
    else add("ИНН получателя", a.inn, b.inn, "ok", "Тот же получатель.");
    // 2. Банк
    if (b.bik && a.bik && a.bik !== b.bik) {
      var reg = a.bik.slice(2, 4) !== b.bik.slice(2, 4) ? " Банк в другом регионе (код " + a.bik.slice(2, 4) + " → " + b.bik.slice(2, 4) + ")." : "";
      add("БИК банка", a.bik, b.bik, "warn", "Банк сменился." + reg + " Само по себе это не ошибка — но повод сверить новые реквизиты голосом.");
    } else if (b.bik && a.bik) add("БИК банка", a.bik, b.bik, "ok", "Банк тот же.");
    else if (!b.bik) add("БИК банка", a.bik, null, "warn", "В новых реквизитах нет БИК — без него платёж не отправить.");
    // 3. Расчётный счёт
    if (!b.acc) add("Расчётный счёт", a.acc, null, "warn", "Не нашли номер расчётного счёта (20 цифр).");
    else if (b.bik && !accOk(b.bik, b.acc)) add("Расчётный счёт", a.acc, b.acc, "bad", "Счёт не сходится с БИК по контрольному ключу — в номере ошибка или изменённая цифра.");
    else if (a.acc && a.acc !== b.acc) add("Расчётный счёт", a.acc, b.acc, "warn", "Счёт новый. Верный ключ не значит, что счёт принадлежит поставщику: чужой счёт тоже пройдёт проверку.");
    else add("Расчётный счёт", a.acc, b.acc, "ok", "Тот же счёт.");
    // 4. Чей счёт
    var vid = vidScheta(b.acc);
    if (vid === "fiz") add("Вид счёта", VID[vidScheta(a.acc)] || null, VID.fiz, "bad", "Новый счёт — личный счёт человека (" + b.acc.slice(0, 5) + "…). Оплату компании на него не переводят.");
    else if (vid === "ip" && b.inn && b.inn.length === 10) add("Вид счёта", VID[vidScheta(a.acc)] || null, VID.ip, "bad", "Счёт предпринимателя (40802…), а ИНН — организации. Так не бывает: реквизиты собраны из разных частей.");
    else if (vid === "org" && b.inn && b.inn.length === 12) add("Вид счёта", VID[vidScheta(a.acc)] || null, VID.org, "warn", "Счёт организации, а ИНН из 12 цифр — предпринимателя или человека. Уточните, кому платите.");
    else if (vid && vidScheta(a.acc) && vid !== vidScheta(a.acc)) add("Вид счёта", VID[vidScheta(a.acc)], VID[vid], "warn", "Был " + VID[vidScheta(a.acc)] + ", стал " + VID[vid] + ".");
    // 5. Корсчёт
    if (b.bik && b.ks && !ksOk(b.bik, b.ks)) add("Корр. счёт", a.ks, b.ks, "bad", "Корреспондентский счёт не сходится с БИК — в реквизитах ошибка.");
    // 6. КПП — смена бывает при переезде, сама по себе не тревожна
    if (a.kpp && b.kpp && a.kpp !== b.kpp) add("КПП", a.kpp, b.kpp, "neutral", "КПП меняется при переезде или смене инспекции — это нормально, если ИНН тот же.");

    var V = [
      ["Реквизиты совпадают", "Получатель, банк и счёт — те же, что и раньше. Если письмо просило что-то сменить, а изменений нет, — перечитайте его ещё раз."],
      ["Реквизиты сменились — подтвердите голосом", "Позвоните поставщику по номеру из договора или с его сайта — не по номеру из письма — и продиктуйте новые счёт и БИК. Пока не подтвердили, платите по прежним реквизитам или не платите."],
      ["Не платите по новым реквизитам", "Ниже — что именно не так. Свяжитесь с поставщиком по известному вам номеру; если письмо пришло не от него — сообщите ему: его почту, похоже, используют чужие."]
    ][hud];
    return { uroven: ["ok", "warn", "bad"][hud], zagolovok: V[0], tekst: V[1], stroki: s, a: a, b: b };
  }

  function render(doc, host, res) {
    function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    while (host.firstChild) host.removeChild(host.firstChild);
    var v = el("div", "res " + (res.uroven === "none" ? "warn" : res.uroven));
    v.appendChild(el("div", "verdict-big", res.zagolovok));
    v.appendChild(el("p", null, res.tekst));
    host.appendChild(v);
    if (!res.stroki.length) return;
    var t = el("div", "smena__tab");
    var h = el("div", "smena__r smena__h");
    ["", "Было", "Стало"].forEach(function (x) { h.appendChild(el("span", null, x)); });
    t.appendChild(h);
    res.stroki.forEach(function (x) {
      var r = el("div", "smena__r is-" + x.uroven);
      r.appendChild(el("span", "smena__pole", x.pole));
      r.appendChild(el("span", "smena__z", x.bylo));
      r.appendChild(el("span", "smena__z" + (x.bylo !== x.stalo && x.stalo !== "—" ? " smena__novoe" : ""), x.stalo));
      r.appendChild(el("p", "smena__t", x.tekst));
      t.appendChild(r);
    });
    host.appendChild(t);
  }

  function podklyuchit(doc) {
    var f = doc.getElementById("smena-forma");
    if (!f) return;
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var res = sravnit(doc.getElementById("smena-bylo").value, doc.getElementById("smena-stalo").value);
      var host = doc.getElementById("smena-out");
      render(doc, host, res);
      host.hidden = false;
      if (typeof window.dlkGoal === "function") window.dlkGoal("smena_sravnit", { uroven: res.uroven });
    });
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { podklyuchit(document); });
    else podklyuchit(document);
  }

  return { razobrat: razobrat, sravnit: sravnit, vidScheta: vidScheta, render: render };
});
