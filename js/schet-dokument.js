/* Делоскоп — страница счёта и акта /schet/dokument/?n=Д-…&k=…[&vid=akt]
   Данные — GET /api/schet/dokument (по секретной ссылке). PDF — печать браузера в A4 («Сохранить как PDF»):
   без серверных библиотек и шрифтов, кириллица и вёрстка — те же, что на экране. */
(function () {
  "use strict";
  var S = window.DeloskopSchet.api;
  var API = location.hostname.endsWith("deloskop.ru") ? "https://api.deloskop.ru" : "";
  var q = new URLSearchParams(location.search), n = q.get("n") || "", k = q.get("k") || "", vid = q.get("vid") === "akt" ? "akt" : "schet";
  var box = document.getElementById("doc");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function den(x) { return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + ",00"; }
  function fioKorotko(f) { var p = String(f || "").trim().split(/\s+/); return p[0] + (p[1] ? " " + p[1][0] + "." : "") + (p[2] ? " " + p[2][0] + "." : ""); }
  // О5 ([команда] 10.10): редакция оферты в счёте — из <meta name="deloskop-oferta"> (кладёт tests/sobrat_tarify.py из оферты)
  function redakciya() { var m = document.querySelector('meta[name="deloskop-oferta"]'); return m && m.content ? " в редакции от " + m.content : ""; }
  function net(t) { box.innerHTML = '<div class="pust"><h1>Счёт не найден</h1><p>' + t + '</p><p><a href="/schet/">Получить новый счёт</a> · <a href="mailto:help@deloskop.ru">help@deloskop.ru</a></p></div>'; }

  if (!/^Д-\d{4}-\d{6}$/.test(n) || !k) { net("Ссылка неполная. Откройте её из письма целиком или скопируйте заново."); return; }
  fetch(API + "/api/schet/dokument?n=" + encodeURIComponent(n) + "&k=" + encodeURIComponent(k))
    .then(function (r) { if (r.status === 404) throw 404; if (!r.ok) throw 0; return r.json(); })
    .then(risovat)
    .catch(function (e) { net(e === 404 ? "Проверьте ссылку из письма: в ней номер счёта и секретный ключ." : "Сервер Делоскопа не ответил. Обновите страницу через минуту."); });

  function risovat(d) {
    document.title = (vid === "akt" && d.akt ? "Акт № " : "Счёт № ") + d.nomer + " — Делоскоп";
    var p = d.prodavec, b = p && p.bank, pk = d.pokupatel;
    var plash = "";
    if (d.status === "zayavka") plash = '<div class="plash">Заявка принята. Реквизиты для оплаты появятся на этой странице в течение рабочего дня — пришлём письмо на почту из заявки.</div>';
    else if (d.status === "oplachen") plash = '<div class="plash ok">' + oplachenTekst(d) + "</div>";
    else if (d.status === "annulirovan") plash = '<div class="plash net">Счёт аннулирован — оплачивать его не нужно. <a href="/schet/">Получить новый счёт</a></div>';
    else plash = '<div class="plash">Оплатите до ' + S.ddmm(d.oplatit_do) + " с расчётного счёта компании или ИП. Номер счёта — в назначении платежа: так мы найдём ваш платёж без уточнений.</div>";

    var akt = vid === "akt" && d.akt;
    var pan = '<div class="pan"><span class="gl">' + (akt ? "Акт" : "Счёт") + " № " + esc(d.nomer) + "</span>" +
      (d.akt ? '<span class="seg"><a href="?n=' + encodeURIComponent(n) + "&k=" + encodeURIComponent(k) + '"' + (akt ? "" : ' aria-current="page"') + '>Счёт</a><a href="?n=' + encodeURIComponent(n) + "&k=" + encodeURIComponent(k) + '&vid=akt"' + (akt ? ' aria-current="page"' : "") + ">Акт</a></span>" : "") +
      (p ? '<button class="b1" type="button" data-pdf>Скачать PDF</button>' : "") + "</div>";
    if (!p) { box.innerHTML = pan + plash + list(d, null); return; }
    box.innerHTML = pan + plash + (akt ? aktHtml(d) : list(d, b)) +
      (akt || d.status === "annulirovan" ? "" : '<div class="kop"><button class="b2" type="button" data-kop="nazn">Скопировать назначение платежа</button> <button class="b2" type="button" data-kop="rekv">Скопировать реквизиты</button></div>') +
      (akt ? "" : buhHtml(d));
    buhStart(d);
    oplachenCel(d);
    var pdf = box.querySelector("[data-pdf]");
    if (pdf) pdf.onclick = function () { window.print(); };
    [].forEach.call(box.querySelectorAll("[data-kop]"), function (x) {
      x.onclick = function () {
        var t = x.dataset.kop === "nazn" ? d.naznachenie :
          "Получатель: ИП " + p.fio + "\nИНН " + p.inn + "\nСчёт № " + b.rs + "\nБанк: " + b.bank + (b.gorod ? ", " + b.gorod : "") + "\nБИК " + b.bik + "\nКорсчёт " + b.ks + "\nСумма: " + den(d.itogo) + " ₽\nНазначение: " + d.naznachenie;
        var o = x.textContent;
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { x.textContent = "Скопировано"; setTimeout(function () { x.textContent = o; }, 2000); }, function () { prompt("Скопируйте:", t); });
      };
    });
  }

  function pokupatelStr(pk) { return esc(pk.nazvanie) + ", ИНН " + esc(pk.inn) + (pk.kpp ? ", КПП " + esc(pk.kpp) : "") + (pk.adres ? ", " + esc(pk.adres) : ""); }
  function prodavecStr(p) { return "Индивидуальный предприниматель " + esc(p.fio) + ", ИНН " + esc(p.inn) + ", ОГРНИП " + esc(p.ogrnip) + (p.adres ? ", " + esc(p.adres) : ""); }
  function pozicii(d, naim) {
    return '<div class="tw"><table class="poz"><thead><tr><th>№</th><th>Наименование</th><th class="n">Кол-во</th><th>Ед.</th><th class="n">Цена, ₽</th><th class="n">Сумма, ₽</th></tr></thead><tbody>' +
      d.stroki.map(function (s, i) { return "<tr><td>" + (i + 1) + "</td><td>" + esc(naim || s.naimenovanie) + '</td><td class="n">' + s.kol + "</td><td>" + esc(s.ed) + '</td><td class="n">' + den(s.cena) + '</td><td class="n">' + den(s.summa) + "</td></tr>"; }).join("") +
      '</tbody></table></div><table class="itog bez"><tr><td>Итого:</td><td class="n">' + den(d.itogo) + "</td></tr><tr><td>" + esc(d.nds_tekst) + ':</td><td class="n">—</td></tr><tr><td>Всего к оплате:</td><td class="n">' + den(d.itogo) + "</td></tr></table>";
  }

  function list(d, b) {
    var p = d.prodavec, pk = d.pokupatel;
    var bank = b ? '<div class="tw"><table><tr><td colspan="2" rowspan="2" style="width:60%">' + esc(b.bank) + (b.gorod ? ", " + esc(b.gorod) : "") + '<br><small>Банк получателя</small></td><td>БИК</td><td>' + esc(b.bik) + "</td></tr><tr><td>Сч. №</td><td>" + esc(b.ks) + "</td></tr>" +
      "<tr><td>ИНН " + esc(p.inn) + "</td><td>КПП —</td><td rowspan=\"2\">Сч. №</td><td rowspan=\"2\">" + esc(b.rs) + "</td></tr><tr><td colspan=\"2\">ИП " + esc(p.fio) + "<br><small>Получатель</small></td></tr></table></div>" : "";
    return '<div class="list">' + bank +
      "<h2>Счёт на оплату № " + esc(d.nomer) + " от " + S.ddmm(d.data) + "</h2>" +
      '<div class="str"><span>Поставщик:</span><span>' + (p ? prodavecStr(p) : "реквизиты появятся после выставления счёта") + "</span></div>" +
      '<div class="str"><span>Покупатель:</span><span>' + pokupatelStr(pk) + "</span></div>" +
      pozicii(d) +
      '<p class="prop">Всего наименований ' + d.stroki.length + ", на сумму " + den(d.itogo) + " руб.<br><b>" + esc(S.propis(d.itogo)) + "</b></p>" +
      '<p class="prop">' + esc(d.nds_tekst) + ". Счёт действителен до " + S.ddmm(d.oplatit_do) + ".</p>" +
      (p ? '<div class="nazn"><b>Назначение платежа:</b> ' + esc(d.naznachenie) + "</div>" : "") +
      (b ? qrHtml(d, p, b, pk) : "") +
      (p ? '<div class="podp"><div>Индивидуальный предприниматель</div><div>' + esc(fioKorotko(p.fio)) + "</div></div>" : "") +
      '<p class="mel">Оплата только с расчётного счёта организации или ИП. Оплата счёта — акцепт оферты deloskop.ru/oferta/' + esc(redakciya()) + ' (п. 3 ст. 438 ГК РФ). ' +
      (d.srok === "razovo" && d.vid === "usluga" ? "Пакет выдаём не позднее 1 рабочего дня после оплаты, анкеты и выписки (раздел 5 оферты)." : "Доступ открывается не позднее рабочего дня, следующего за днём зачисления оплаты, на срок тарифа.") + "</p></div>";
  }

  // schet-konversiya-v1 (решение команды 10.10, п. 3): QR по ГОСТ Р 56042-2014 — на неоплаченном счёте, на экране и в PDF.
  // Строку собирает js/qr-platezh.js только из данных самого счёта: сумма и назначение — те же, что в счёте (правило О1 [команда]).
  function qrHtml(d, p, b, pk) {
    if (d.status === "oplachen" || d.status === "annulirovan" || !window.DeloskopQR) return "";
    var s = window.DeloskopQR.stroka({ name: "ИП " + p.fio, rs: b.rs, bank: b.bank, bik: b.bik, ks: b.ks, summa: d.itogo, naznachenie: d.naznachenie, inn: p.inn, inn_platelshchika: pk && pk.inn });
    var kartinka = s && window.DeloskopQR.svg(s, "QR-код для оплаты счёта № " + esc(d.nomer));
    if (!kartinka) return "";
    return '<div class="qrp"><div class="qrp__k">' + kartinka + '</div><div class="qrp__t"><b>Оплата по QR-коду</b>' +
      "В приложении банка выберите оплату по QR и наведите камеру: получатель, сумма и назначение платежа заполнятся сами. Перед отправкой сверьте их со счётом.</div></div>";
  }

  // «Отправить счёт бухгалтеру» — тексты [команда] 10.10 (разд. 7). Форма появляется, только когда API отдаёт buhgalteru: true:
  // до выкладки API-части (письмо, хранение адреса 30 дней) кнопки нет — мёртвых кнопок на сайте не держим.
  // Почта бухгалтера в Метрику не уходит: цель без параметров из поля (tests/schet_konversiya.test.js).
  var BUH = {
    zagolovok: "Отправить счёт бухгалтеру",
    lid: "Пришлём бухгалтеру одно письмо: счёт в PDF с QR-кодом для оплаты. Без рассылок, адрес удалим через 30\u00a0дней.",
    pole: "Почта бухгалтера",
    soglasie: "Подтверждаю, что бухгалтер согласен получить счёт на этот адрес",
    knopka: "Отправить счёт бухгалтеру",
    idet: "Отправляем…",
    ok: "Отправили на {email}. Если письма нет 10\u00a0минут — пусть бухгалтер проверит «Спам».",
    net_pochty: "Введите почту бухгалтера",
    plohaya_pochta: "Проверьте адрес почты",
    net_soglasiya: "Отметьте, что бухгалтер согласен получить счёт",
    mnogo: "Слишком много отправок подряд. Попробуйте позже.",
    oshibka: "Не получилось отправить. Скачайте PDF и перешлите его сами — или напишите на help@deloskop.ru."
  };
  function buhHtml(d) {
    if (d.buhgalteru !== true || d.status === "oplachen" || d.status === "annulirovan" || d.status === "zayavka" || !d.prodavec) return "";
    return '<form class="buh" id="buhgalteru" data-buh novalidate><h2>' + BUH.zagolovok + '</h2><p class="buh__lid">' + BUH.lid + "</p>" +
      '<label class="buh__pole"><span>' + BUH.pole + '</span><input type="email" name="email" inputmode="email" autocomplete="off" maxlength="254" spellcheck="false" required></label>' +
      '<label class="buh__sogl"><input type="checkbox" name="soglasie" required><span>' + BUH.soglasie + "</span></label>" +
      '<div class="buh__niz"><button class="b1" type="submit">' + BUH.knopka + '</button><p class="buh__st" role="status" aria-live="polite"></p></div></form>';
  }
  function buhStart(d) {
    var f = box.querySelector("[data-buh]"); if (!f) return;
    var em = f.elements.email, sg = f.elements.soglasie, go = f.querySelector("button"), st = f.querySelector(".buh__st");
    function skazat(t, plokho) { st.textContent = t; st.className = "buh__st" + (plokho ? " buh__st--net" : ""); }
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = em.value.trim();
      if (!v) { skazat(BUH.net_pochty, true); return em.focus(); }
      if (!window.DeloskopSchet.api.emailOk(v)) { skazat(BUH.plohaya_pochta, true); return em.focus(); }
      if (!sg.checked) { skazat(BUH.net_soglasiya, true); return sg.focus(); }
      go.disabled = true; em.disabled = true; sg.disabled = true; skazat(BUH.idet);
      fetch(API + "/api/schet/buhgalteru", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n: n, k: k, email: v, soglasie: true }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { r: r, j: j }; }); })
        .then(function (o) {
          if (o.r.ok && o.j.ok) {
            skazat(BUH.ok.replace("{email}", v));
            if (window.dlkGoal) window.dlkGoal("schet_buhgalteru", { mesto: "schet" });
            return;
          }
          go.disabled = false; em.disabled = false; sg.disabled = false;
          if (o.r.status === 422 && o.j.pole === "email") { skazat(BUH.plohaya_pochta, true); return em.focus(); }
          skazat(o.r.status === 429 ? (o.j.detail || BUH.mnogo) : BUH.oshibka, true);
        })
        .catch(function () { go.disabled = false; em.disabled = false; sg.disabled = false; skazat(BUH.oshibka, true); });
    });
    // ссылка «Отправить бухгалтеру ещё раз» из письма-напоминания ведёт на #buhgalteru
    if (location.hash === "#buhgalteru") { f.scrollIntoView({ block: "center" }); try { em.focus({ preventScroll: true }); } catch (e) {} }
  }
  // цель «счёт оплачен» — один раз на счёт в этом браузере, без номера и сумм
  function oplachenCel(d) {
    if (d.status !== "oplachen" || !window.dlkGoal) return;
    try { if (localStorage.getItem("dlk_oplachen_" + n)) return; localStorage.setItem("dlk_oplachen_" + n, "1"); } catch (e) { return; }
    window.dlkGoal("schet_oplachen", { produkt: String(d.produkt || ""), vid: d.srok === "razovo" ? "razovo" : "tarif" });
  }

  // schet-v2: разовые продукты. Услуга («Скорая под ключ») — акт на дату выдачи пакета; лицензия — на дату оплаты.
  function oplachenTekst(d) {
    var data = S.ddmm((d.oplachen || (d.akt && d.akt.data) || "").slice(0, 10));
    if (d.srok === "razovo" && d.vid === "usluga")
      return "Оплачен " + data + ". " + (d.okazano ? "Пакет выдан " + S.ddmm(d.okazano) + " — акт во вкладке «Акт»." : "Ссылку на анкету пришлём на почту из заявки — пакет соберём не позднее 1 рабочего дня после того, как вы её заполните и загрузите выписку.");
    var po = d.dostup_do || (d.akt && d.akt.period_po);
    return "Оплачен " + data + ". Доступ по " + (d.produkt === "osnovatel" ? "«Тарифу основателя»" + (d.nomer_osnovatelya ? " (основатель № " + d.nomer_osnovatelya + ")" : "") : "тарифу «" + esc(d.tarif) + "»") +
      (po ? " — по " + S.ddmm(po) + " включительно." : ".");
  }

  function aktHtml(d) {
    var p = d.prodavec, pk = d.pokupatel, a = d.akt;
    // О4 ([команда] 10.10): запасное наименование — как в оферте (лицензия, ст. 1235 ГК), а не «доступ к сервису»
    var naim = a.naimenovanie || ("Предоставлено право использования программы для ЭВМ «Делоскоп» (простая неисключительная лицензия), тариф «" + d.tarif + "», на период с " + S.ddmm(a.period_s) + " по " + S.ddmm(a.period_po));
    return '<div class="list">' +
      "<h2>Акт № " + esc(d.nomer) + " от " + S.ddmm(a.data) + "</h2>" +
      '<div class="str"><span>Исполнитель:</span><span>' + prodavecStr(p) + "</span></div>" +
      '<div class="str"><span>Заказчик:</span><span>' + pokupatelStr(pk) + "</span></div>" +
      '<div class="str"><span>Основание:</span><span>Счёт № ' + esc(d.nomer) + " от " + S.ddmm(d.data) + ", оферта deloskop.ru/oferta/</span></div>" +
      pozicii(d, naim) +
      '<p class="prop">Всего на сумму ' + den(d.itogo) + " руб.<br><b>" + esc(S.propis(d.itogo)) + "</b>. " + esc(d.nds_tekst) + ".</p>" +
      '<p class="prop">' + esc(a.itog || "Право использования предоставлено Заказчику на указанный период.") + '</p>' +
      '<div class="podp"><div>Исполнитель: ИП ' + esc(fioKorotko(p.fio)) + '</div><div>Заказчик: ' + esc(pk.nazvanie) + "</div></div></div>";
  }
})();
