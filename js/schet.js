/* Делоскоп — «Получить счёт» (п. 1 и 23 «Очереди»).
   Одна форма на трёх местах: окно по кнопкам тарифов (/tarify/ и главная), страница /schet/ и её же ссылка
   без JS (кнопки ведут на /schet/?tarif=…&srok=…). Сумму считает сервер из tarify.json; здесь — только показ.
   API не ответил — заявка не теряется: письмо с готовым текстом и кнопка «Скопировать заявку».
   Чистые функции экспортируются для автотестов (node): tests/schet.test.js. */
(function (root) {
  "use strict";

  var SROKI = { mes: 1, kvartal: 3, god: 12 };
  var SROK_IMYA = { mes: "Месяц", kvartal: "Квартал", god: "Год" };
  var SROK_TEKST = { 1: "1 месяц", 3: "3 месяца", 12: "12 месяцев" };
  var NDS = "Без налога (НДС)";

  // ---------- чистые функции ----------
  function innOk(s) {
    if (!/^(\d{10}|\d{12})$/.test(s || "")) return false;
    var d = s.split("").map(Number);
    function k(w) { var x = 0; for (var i = 0; i < w.length; i++) x += w[i] * d[i]; return x % 11 % 10; }
    if (d.length === 10) return k([2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[9];
    return k([7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[10] && k([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) === d[11];
  }
  function emailOk(s) { return typeof s === "string" && s.length <= 254 && /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/.test(s); }
  function klyuch23(s) { var w = [7, 1, 3], x = 0; for (var i = 0; i < 23; i++) x += (+s[i] * w[i % 3]) % 10; return x % 10 === 0; }
  function bikOk(b) { return /^04\d{7}$/.test(b || ""); }
  function rsOk(bik, rs) { return bikOk(bik) && /^\d{20}$/.test(rs || "") && klyuch23(bik.slice(-3) + rs); }
  function ksOk(bik, ks) { return bikOk(bik) && /^301\d{17}$/.test(ks || "") && ks.slice(-3) === bik.slice(-3) && klyuch23("0" + bik.slice(4, 6) + ks); }
  function ogrnipOk(s) { return /^\d{15}$/.test(s || "") && Number(BigInt(s.slice(0, 14)) % 13n % 10n) === +s[14]; }

  // разовые продукты (сейчас — «Скорая под ключ»): цена в tarify.json → <id>.cena_rub, срок не выбирается
  function produktIz(D, id) { var p = D && id && D[id]; return p && p.razovo && p.cena_rub > 0 ? p : null; }
  function tarifIz(D, id) { return (D && D.tarify || []).filter(function (t) { return t.id === id && t.mesyac > 0; })[0] || null; }
  function summa(D, tarif, srok) {
    var p = produktIz(D, tarif); if (p) return p.cena_rub;
    var t = tarifIz(D, tarif); if (!t || !SROKI[srok]) return null;
    return srok === "god" ? t.god : t.mesyac * SROKI[srok];
  }
  function rub(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽"; }
  function podpisSummy(D, tarif, srok) {
    var t = tarifIz(D, tarif); if (!t) return "";
    if (srok === "kvartal") return "3 × " + rub(t.mesyac);
    if (srok === "god") return "экономия " + rub(t.mesyac * 12 - t.god) + " против помесячной";
    return "за 1 месяц";
  }

  // сумма прописью: 14300 → «Четырнадцать тысяч триста рублей 00 копеек»
  var ED = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  var EDZ = ["", "одна", "две"];
  var DES = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  var DESYATKI = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  var SOTNI = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
  function slovo(n, a, b, c) { n = n % 100; if (n > 10 && n < 20) return c; n = n % 10; return n === 1 ? a : (n > 1 && n < 5 ? b : c); }
  function troyka(n, zhen) {
    var s = [SOTNI[Math.floor(n / 100)]], d = n % 100;
    if (d >= 10 && d < 20) s.push(DES[d - 10]);
    else { s.push(DESYATKI[Math.floor(d / 10)]); var e = d % 10; s.push(zhen && e < 3 ? EDZ[e] : ED[e]); }
    return s.filter(Boolean).join(" ");
  }
  function propis(rubli) {
    var n = Math.floor(rubli), kop = Math.round((rubli - n) * 100), chasti = [];
    if (n === 0) chasti.push("ноль");
    var mln = Math.floor(n / 1e6), tys = Math.floor(n / 1000) % 1000, ost = n % 1000;
    if (mln) chasti.push(troyka(mln, false) + " " + slovo(mln, "миллион", "миллиона", "миллионов"));
    if (tys) chasti.push(troyka(tys, true) + " " + slovo(tys, "тысяча", "тысячи", "тысяч"));
    if (ost) chasti.push(troyka(ost, false));
    var s = chasti.join(" ") + " " + slovo(n, "рубль", "рубля", "рублей") + " " + (kop < 10 ? "0" : "") + kop + " " + slovo(kop, "копейка", "копейки", "копеек");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function tekstZayavki(z, D) {
    if (z.produkt) {
      var p = produktIz(D, z.produkt);
      return "Прошу выставить счёт.\nУслуга: " + (p ? p.nazvanie : z.produkt) + ", разовый платёж" +
        (p ? " — " + rub(p.cena_rub).replace(/ /g, " ") : "") + "\nИНН плательщика: " + (z.inn || "") +
        (z.nazvanie ? " (" + z.nazvanie + ")" : "") + "\nE-mail для счёта, анкеты и документов: " + (z.email || "");
    }
    var t = tarifIz(D, z.tarif), s = summa(D, z.tarif, z.srok);
    return "Прошу выставить счёт.\nТариф: " + (t ? t.nazvanie : z.tarif) + ", " + SROK_TEKST[SROKI[z.srok]] +
      (s ? " — " + rub(s).replace(/ /g, " ") : "") + "\nИНН плательщика: " + (z.inn || "") +
      (z.nazvanie ? " (" + z.nazvanie + ")" : "") + "\nE-mail для счёта и закрывающих документов: " + (z.email || "");
  }
  function mailtoZayavki(z, D) {
    if (z.produkt) { var p = produktIz(D, z.produkt);
      return "mailto:help@deloskop.ru?subject=" + encodeURIComponent("Счёт: " + (p ? p.nazvanie : z.produkt)) + "&body=" + encodeURIComponent(tekstZayavki(z, D)); }
    var t = tarifIz(D, z.tarif);
    return "mailto:help@deloskop.ru?subject=" + encodeURIComponent("Счёт: " + (t ? t.nazvanie : z.tarif) + ", " + SROK_IMYA[z.srok].toLowerCase()) +
      "&body=" + encodeURIComponent(tekstZayavki(z, D));
  }
  function ddmm(iso) { if (!iso) return ""; var p = String(iso).slice(0, 10).split("-"); return p[2] + "." + p[1] + "." + p[0]; }

  var api = { innOk: innOk, emailOk: emailOk, bikOk: bikOk, rsOk: rsOk, ksOk: ksOk, ogrnipOk: ogrnipOk, summa: summa,
    rub: rub, produktIz: produktIz, propis: propis, podpisSummy: podpisSummy, tekstZayavki: tekstZayavki, mailtoZayavki: mailtoZayavki, ddmm: ddmm,
    SROKI: SROKI, SROK_TEKST: SROK_TEKST, NDS: NDS };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; }
  if (typeof document === "undefined") return;

  // ---------- браузер ----------
  var API = location.hostname.endsWith("deloskop.ru") ? "https://api.deloskop.ru" : "";
  // Первая строка окна счёта для разовых продуктов: что будет после оплаты (у каждого продукта — своё)
  var LID_PRODUKTA = {
    skoraya_pod_klyuch: "Разовый платёж с расчётного счёта компании или ИП. В день поступления денег пришлём на почту ссылку на анкету и загрузку выписки.",
    osnovatel: "Тариф «Про» на 12 месяцев, оплата с расчётного счёта компании или ИП. Доступ и номер основателя — в день поступления денег."
  };
  var D = null, zhdut = [];
  function sTarifami(fn) {
    if (D) return fn(D);
    zhdut.push(fn); if (zhdut.length > 1) return;
    var el = document.getElementById("tarify-data");
    if (el) { try { D = JSON.parse(el.textContent); } catch (e) {} }
    var gotovo = function () { var f = zhdut; zhdut = []; f.forEach(function (x) { x(D); }); };
    if (D) return gotovo();
    fetch("/tarify/tarify.json").then(function (r) { return r.json(); }).then(function (j) { D = j; gotovo(); }).catch(gotovo);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // партнёрская ссылка ?ref= — помним 90 дней (п. 19)
  function ref() {
    try {
      var r = new URLSearchParams(location.search).get("ref");
      if (r && /^[A-Za-z0-9_-]{1,64}$/.test(r)) document.cookie = "dlk_ref=" + r + ";max-age=" + 90 * 86400 + ";path=/;SameSite=Lax";
      var m = document.cookie.match(/(?:^|;\s*)dlk_ref=([A-Za-z0-9_-]{1,64})/);
      return m ? m[1] : null;
    } catch (e) { return null; }
  }
  ref();

  var CSS = "" +
    ".sf{--sf-ink:var(--ink,#1D1D1F);--sf-ink2:var(--ink2,#48484C);--sf-muted:var(--muted,#6B6B70);--sf-line:var(--line,#E6E6E1);--sf-acc:var(--accent,#0B63E5);--sf-ok:var(--ok,#16723F);--sf-bad:var(--bad,#B3261E);color:var(--sf-ink);font-size:16px;line-height:1.45}" +
    ".sf h3{font-size:24px;letter-spacing:-.02em;line-height:1.2;margin:0 0 6px;font-weight:600;outline:0}" +
    ".sf .sf-lead{color:var(--sf-ink2);font-size:15px;margin:0 0 18px}" +
    ".sf .sf-seg{display:flex;gap:4px;background:#EBEBE6;border-radius:999px;padding:4px;margin:0 0 10px;width:max-content;max-width:100%}" +
    ".sf .sf-seg button{border:0;background:transparent;font:inherit;font-size:15px;font-weight:500;color:var(--sf-ink2);padding:8px 16px;border-radius:999px;cursor:pointer;min-height:40px}" +
    ".sf .sf-seg button[aria-checked=true]{background:#fff;color:var(--sf-ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}" +
    ".sf .sf-sum{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:14px 0 18px;padding:14px 0;border-top:1px solid var(--sf-line);border-bottom:1px solid var(--sf-line)}" +
    ".sf .sf-sum b{font-size:28px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums}" +
    ".sf .sf-sum span{font-size:13px;color:var(--sf-muted);text-align:right}" +
    ".sf label.sf-f{display:block;margin:0 0 14px}.sf label.sf-f>span{display:block;font-size:14px;font-weight:500;margin:0 0 6px}" +
    ".sf input[type=text],.sf input[type=email]{width:100%;min-height:52px;border:1px solid #D9D9D4;border-radius:12px;padding:0 14px;font:inherit;font-size:17px;background:#fff;color:var(--sf-ink);box-sizing:border-box}" +
    ".sf input[type=text]:focus,.sf input[type=email]:focus{outline:0;border-color:var(--sf-acc);box-shadow:0 0 0 3px rgba(11,99,229,.25)}" +
    ".sf input[aria-invalid=true]{border-color:var(--sf-bad)}" +
    ".sf .sf-h{font-size:14px;margin-top:6px;min-height:20px;color:var(--sf-ink2)}.sf .sf-h.bad{color:var(--sf-bad)}.sf .sf-h.ok::before{content:'✓ ';color:var(--sf-ok);font-weight:600}" +
    ".sf .sf-g{display:grid;grid-template-columns:22px 1fr;gap:8px;align-items:start;font-size:14px;color:var(--sf-ink2);margin:4px 0 6px;cursor:pointer}.sf .sf-g input{width:20px;height:20px;margin:1px 0 0;accent-color:var(--sf-acc)}" +
    ".sf .sf-go{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:52px;border:0;border-radius:14px;background:var(--sf-acc);color:#fff;font:inherit;font-size:17px;font-weight:600;cursor:pointer;margin-top:14px}" +
    ".sf .sf-go:hover{background:var(--accent-hover,#0952C2)}.sf .sf-go:disabled{opacity:.7;cursor:default}" +
    ".sf .sf-go2{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;border:1px solid #D9D9D4;border-radius:14px;background:#fff;color:var(--sf-ink);font:inherit;font-size:16px;font-weight:600;cursor:pointer;margin-top:10px;text-decoration:none;box-sizing:border-box}" +
    ".sf .sf-spin{width:18px;height:18px;border:2px solid rgba(255,255,255,.5);border-top-color:#fff;border-radius:50%;animation:sfs .8s linear infinite}@keyframes sfs{to{transform:rotate(360deg)}}" +
    "@media (prefers-reduced-motion:reduce){.sf .sf-spin{animation-duration:2.4s}}" +
    ".sf .sf-mel{font-size:13px;color:var(--sf-muted);margin:12px 0 0}.sf .sf-err{font-size:14px;color:var(--sf-bad);margin:10px 0 0;min-height:0}" +
    ".sf .sf-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}" +
    ".sf .sf-ok{width:48px;height:48px;border-radius:50%;background:var(--ok-bg,#E8F5EE);display:flex;align-items:center;justify-content:center;margin:0 0 14px}" +
    "dialog.sf-dlg{border:0;border-radius:24px;padding:28px 28px 24px;width:min(480px,calc(100vw - 32px));max-height:calc(100dvh - 32px);box-shadow:0 30px 80px rgba(0,0,0,.25);background:#fff;overflow:auto;box-sizing:border-box}" +
    "dialog.sf-dlg::backdrop{background:rgba(29,29,31,.45)}" +
    "dialog.sf-dlg .sf h3{padding-right:44px}" +
    "dialog.sf-dlg .sf-x{position:absolute;top:14px;right:14px;width:40px;height:40px;border:0;border-radius:50%;background:#F0F0EC;font-size:22px;line-height:1;cursor:pointer;color:var(--ink,#1D1D1F)}" +
    "@media (max-width:640px){dialog.sf-dlg{width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;margin:0;border-radius:0;padding:24px 16px calc(24px + env(safe-area-inset-bottom))}.sf .sf-seg button{padding:8px 13px}}";
  function stili() { if (document.getElementById("sf-css")) return; var s = document.createElement("style"); s.id = "sf-css"; s.textContent = CSS; document.head.appendChild(s); }

  var nomerFormy = 0;
  function forma(box, nach, vDialoge) {
    stili();
    var st = { tarif: nach.tarif || "pro", srok: SROKI[nach.srok] ? nach.srok : "mes", nazvanie: null, poisk: 0,
      produkt: /^[a-z_]{3,40}$/.test(nach.produkt || "") ? nach.produkt : null };
    var id = "sf" + (++nomerFormy);
    box.innerHTML = '<form class="sf" novalidate>' +
      '<h3 id="' + id + '-h" tabindex="-1"></h3>' +
      (st.produkt
        ? '<p class="sf-lead">' + (LID_PRODUKTA[st.produkt] || LID_PRODUKTA.skoraya_pod_klyuch) + '</p>'
        : '<p class="sf-lead">Оплата с расчётного счёта компании или ИП. Доступ откроем в день поступления денег.</p>' +
          '<div class="sf-seg" role="radiogroup" aria-label="Тариф" data-seg="tarif"></div>' +
          '<div class="sf-seg" role="radiogroup" aria-label="Срок" data-seg="srok"></div>') +
      '<div class="sf-sum" aria-live="polite"><b data-sum>—</b><span><span data-pod></span><br>' + NDS + '</span></div>' +
      '<label class="sf-f"><span>ИНН плательщика</span><input type="text" inputmode="numeric" autocomplete="off" maxlength="14" data-p="inn" aria-describedby="' + id + '-inn" placeholder="10 цифр у компании, 12 у ИП"><div class="sf-h" id="' + id + '-inn" aria-live="polite"></div></label>' +
      '<label class="sf-f"><span>E-mail для счёта и закрывающих документов</span><input type="email" inputmode="email" autocomplete="email" maxlength="254" data-p="email" aria-describedby="' + id + '-email" placeholder="buh@company.ru"><div class="sf-h" id="' + id + '-email"></div></label>' +
      '<input class="sf-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" data-p="website">' +
      '<button class="sf-go" type="submit" data-go>Получить счёт</button>' +
      '<p class="sf-err" role="alert" data-err></p>' +
      // п. 57: для счёта основание обработки — договор (п. 5 ч. 1 ст. 6 152-ФЗ), галочка согласия не нужна (правовой пакет, разд. 4)
      '<p class="sf-mel" data-oferta>Нажимая кнопку, вы принимаете <a href="/oferta/" target="_blank" rel="noopener">оферту</a>; как мы обрабатываем данные — в <a href="/politika/" target="_blank" rel="noopener">Политике</a>.</p>' +
      '<p class="sf-mel">Счёт — для компаний и ИП, без НДС. Физлицам оплата картой откроется после подключения банка.</p>' +
      '</form>';
    var f = box.querySelector("form"), $ = function (s) { return f.querySelector(s); };
    var pInn = $('[data-p=inn]'), pEm = $('[data-p=email]');
    var hInn = document.getElementById(id + "-inn"), hEm = document.getElementById(id + "-email");

    function seg(el, vals, cur, name) {
      el.innerHTML = vals.map(function (v) { return '<button type="button" role="radio" aria-checked="' + (v[0] === cur) + '" data-v="' + v[0] + '">' + esc(v[1]) + "</button>"; }).join("");
      el.onclick = function (e) { var b = e.target.closest("button"); if (!b) return; st[name] = b.dataset.v; risovat(); };
    }
    function risovat() {
      sTarifami(function (DD) {
        if (st.produkt) {
          var p = produktIz(DD, st.produkt);
          $("h3").textContent = "Счёт на «" + (p ? p.nazvanie : "Скорую под ключ").replace(/^Скорая/, "Скорую") + "»";
          $("[data-sum]").textContent = p ? rub(p.cena_rub) : "—";
          $("[data-pod]").textContent = p ? "разово" + (p.podarok ? " · " + p.podarok + " в подарок" : "") : "";
          return;
        }
        var platnye = (DD && DD.tarify || []).filter(function (t) { return t.mesyac > 0; });
        if (!platnye.length) platnye = [{ id: "start", nazvanie: "Старт" }, { id: "pro", nazvanie: "Про" }, { id: "biznes", nazvanie: "Бизнес" }];
        var t = platnye.filter(function (x) { return x.id === st.tarif; })[0] || platnye[0]; st.tarif = t.id;
        $("h3").textContent = "Счёт на тариф «" + t.nazvanie + "»";
        seg($('[data-seg=tarif]'), platnye.map(function (x) { return [x.id, x.nazvanie]; }), st.tarif, "tarif");
        seg($('[data-seg=srok]'), [["mes", "Месяц"], ["kvartal", "Квартал"], ["god", "Год −20%"]], st.srok, "srok");
        var s = summa(DD, st.tarif, st.srok);
        $("[data-sum]").textContent = s ? rub(s) : "—";
        $("[data-pod]").textContent = s ? podpisSummy(DD, st.tarif, st.srok) : "";
      });
    }
    risovat();

    function pole(inp, h, tekst, ok) {
      // ok: true — зелёная галочка, null — нейтральная подсказка, иначе — ошибка
      inp.setAttribute("aria-invalid", tekst && ok === undefined ? "true" : "false");
      h.textContent = tekst || ""; h.className = "sf-h" + (tekst ? (ok ? " ok" : ok === null ? "" : " bad") : "");
    }
    function innChist() { return pInn.value.replace(/\D/g, ""); }
    function proveritInn(strogo) {
      var v = innChist();
      if (!v) { if (strogo) pole(pInn, hInn, "Введите ИНН плательщика"); return false; }
      if (v.length !== 10 && v.length !== 12) { if (strogo) pole(pInn, hInn, "В ИНН 10 цифр у компании и 12 у ИП"); return false; }
      if (!innOk(v)) { pole(pInn, hInn, "ИНН с опечаткой: контрольные цифры не сходятся"); return false; }
      return true;
    }
    pInn.addEventListener("input", function () {
      st.nazvanie = null; var v = innChist();
      if (v.length === 10 || v.length === 12) {
        if (!proveritInn(true)) return;
        var n = ++st.poisk; pole(pInn, hInn, "");
        if (!API && location.protocol === "file:") return;
        fetch(API + "/api/suggest?q=" + v).then(function (r) { return r.ok ? r.json() : { items: [] }; }).then(function (j) {
          if (n !== st.poisk) return;
          var it = (j.items || []).filter(function (x) { return x.inn === v; })[0];
          if (it) { st.nazvanie = it.name; pole(pInn, hInn, it.name + (it.address ? " · " + it.address : ""), true); }
          else pole(pInn, hInn, "Не нашли в подсказках — сверим по ЕГРЮЛ при выставлении счёта", null);
        }).catch(function () {});
      } else if (hInn.className.indexOf("bad") < 0) pole(pInn, hInn, "");
    });
    pInn.addEventListener("blur", function () { if (innChist()) proveritInn(true); });
    pEm.addEventListener("blur", function () { var v = pEm.value.trim(); if (v) proveritEm(); });
    function proveritEm() {
      var v = pEm.value.trim();
      if (!v) { pole(pEm, hEm, "Введите e-mail — пришлём на него счёт"); return false; }
      if (v.indexOf("@") < 0) { pole(pEm, hEm, "Проверьте адрес почты — нет знака @"); return false; }
      if (!emailOk(v)) { pole(pEm, hEm, "Проверьте адрес почты"); return false; }
      pole(pEm, hEm, ""); return true;
    }

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var a = proveritInn(true), b = proveritEm();
      if (!a) return pInn.focus(); if (!b) return pEm.focus();
      var z = { tarif: st.produkt || st.tarif, srok: st.produkt ? "razovo" : st.srok, produkt: st.produkt || undefined, inn: innChist(), email: pEm.value.trim(), soglasie_pd: true,
        nazvanie: st.nazvanie, ref: ref(), website: $('[data-p=website]').value };
      var go = $("[data-go]"), err = $("[data-err]"); err.textContent = "";
      go.disabled = true; go.innerHTML = '<span class="sf-spin" aria-hidden="true"></span><span>Выставляем счёт…</span>';
      [pInn, pEm].forEach(function (x) { x.disabled = true; });
      function vernut() { go.disabled = false; go.textContent = "Получить счёт"; [pInn, pEm].forEach(function (x) { x.disabled = false; }); }
      fetch(API + "/api/schet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(z) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { r: r, j: j }; }); })
        .then(function (o) {
          if (o.r.ok && o.j.ok) return uspeh(o.j, z);
          vernut();
          // сервер ещё не знает разовый продукт (API до schet-v2) — заявка не теряется: письмо с готовым текстом
          if (o.r.status === 422 && z.produkt && (o.j.pole === "tarif" || o.j.pole === "srok")) return zapasnoj(z, true);
          if (o.r.status === 422 && o.j.pole) {
            var m = { inn: [pInn, hInn], email: [pEm, hEm] }[o.j.pole];
            if (m) { pole(m[0], m[1], o.j.detail); m[0].focus(); return; }
            err.textContent = o.j.detail || "Проверьте поля формы"; return;
          }
          if (o.r.status === 429) { err.textContent = o.j.detail || "Слишком много заявок подряд. Подождите 10 минут."; return; }
          zapasnoj(z);
        })
        .catch(function () { vernut(); zapasnoj(z); });
    });

    function uspeh(j, z) {
      if (window.dlkGoal) window.dlkGoal("invoice_created", { nomer: String(j.nomer || ""), produkt: z.produkt || z.tarif });
      var h = j.gotov ? "Счёт № " + j.nomer + " готов" : "Заявка № " + j.nomer + " принята";
      var tekst = j.gotov
        ? "Откройте счёт, скачайте PDF и оплатите с расчётного счёта. В назначении платежа — номер счёта: так мы увидим оплату в тот же день." + (j.pismo ? " Копию отправили на " + esc(j.email) + ". Если письма нет 10 минут — проверьте «Спам»." : "")
        : "Счёт с реквизитами пришлём на " + esc(j.email) + " в течение рабочего дня. Он появится и по ссылке ниже — сохраните её.";
      f.innerHTML = '<div class="sf-ok" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 20 20" fill="none"><path d="M4.5 10.5L8 14L15.5 6.5" stroke="#16723F" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
        '<h3 tabindex="-1">' + esc(h) + "</h3>" +
        '<p class="sf-lead">' + esc(j.pokupatel || "") + (z.produkt ? " · «" + esc(j.tarif) + "», разово" : " · тариф «" + esc(j.tarif) + "» · " + esc(SROK_TEKST[j.mesyacev] || "")) + " · " + rub(j.summa) + "</p>" +
        '<p style="font-size:15px;margin:0 0 6px">' + tekst + "</p>" +
        (j.gotov ? '<a class="sf-go" href="' + esc(j.url) + '" target="_blank" rel="noopener">Открыть счёт и скачать PDF</a>' : "") +
        '<button type="button" class="' + (j.gotov ? "sf-go2" : "sf-go") + '" data-copy>Скопировать ссылку на счёт</button>' +
        '<p class="sf-mel">Нужен договор или счёт на другую компанию — напишите на <a href="mailto:help@deloskop.ru">help@deloskop.ru</a>.</p>';
      f.querySelector("h3").focus();
      f.querySelector("[data-copy]").onclick = function () { kopirovat(j.url, this, "Ссылка скопирована"); };
      try { if (window.ym && window.DLK_METRIKA) window.ym(window.DLK_METRIKA, "reachGoal", "invoice_created"); } catch (e) {}
    }
    function zapasnoj(z, pismom) {
      var err = $("[data-err]");
      if (f.querySelector("[data-copy2]")) return;
      err.innerHTML = pismom
        ? "Счета на «Скорую под ключ» пока выставляем по письму. Отправьте заявку — текст уже готов, ответим счётом:"
        : "Не получилось отправить заявку через сайт. Отправьте её письмом — текст уже готов:";
      if (pismom) err.style.color = "var(--sf-ink2)";
      var box2 = document.createElement("div");
      box2.innerHTML = '<a class="sf-go2" href="' + esc(mailtoZayavki(z, D)) + '">Отправить письмом на help@deloskop.ru</a>' +
        '<button type="button" class="sf-go2" data-copy2>Скопировать текст заявки</button>';
      err.parentNode.insertBefore(box2, err.nextSibling);
      box2.querySelector("[data-copy2]").onclick = function () { kopirovat(tekstZayavki(z, D), this, "Текст скопирован — вставьте в письмо на help@deloskop.ru"); };
    }
    if (!vDialoge) setTimeout(function () { try { pInn.focus({ preventScroll: true }); } catch (e) {} }, 0);
    return { fokus: function () { pInn.focus(); } };
  }

  function kopirovat(t, btn, ok) {
    var done = function () { var o = btn.textContent; btn.textContent = ok; setTimeout(function () { btn.textContent = o; }, 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { prompt("Скопируйте:", t); });
    else { prompt("Скопируйте:", t); }
  }

  var dlg = null;
  function otkryt(nach) {
    stili();
    if (!window.HTMLDialogElement) { location.href = nach.produkt ? "/schet/?produkt=" + encodeURIComponent(nach.produkt) : "/schet/?tarif=" + encodeURIComponent(nach.tarif || "") + "&srok=" + encodeURIComponent(nach.srok || ""); return; }
    if (!dlg) {
      dlg = document.createElement("dialog"); dlg.className = "sf-dlg"; dlg.setAttribute("aria-label", "Получить счёт");
      document.body.appendChild(dlg);
      dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener("close", function () { document.documentElement.style.overflow = ""; });
    }
    dlg.innerHTML = '<button type="button" class="sf-x" aria-label="Закрыть">×</button><div></div>';
    dlg.querySelector(".sf-x").onclick = function () { dlg.close(); };
    var fm = forma(dlg.lastChild, nach, true);
    document.documentElement.style.overflow = "hidden";
    dlg.showModal(); fm.fokus();
  }

  // кнопки тарифов: data-tarif + data-srok → окно; без JS работает ссылка на /schet/
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-tarif][data-srok]");
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    // «Помесячно / за год» на карточке переключает только цену; срок в окне выбирается заново
    otkryt({ tarif: a.dataset.tarif, srok: a.dataset.srok });
  });

  // разовые продукты: <a data-schet data-produkt="…" href="/schet/?produkt=…"> → окно; без JS — страница /schet/
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-schet][data-produkt]");
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    if (window.dlkGoal) window.dlkGoal("pkg_cta", { produkt: a.dataset.produkt });
    otkryt({ produkt: a.dataset.produkt });
  });

  root.DeloskopSchet = { otkryt: otkryt, forma: forma, api: api };
})(typeof window !== "undefined" ? window : this);
