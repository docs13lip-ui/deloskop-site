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
    else if (d.status === "oplachen") plash = '<div class="plash ok">Оплачен ' + S.ddmm(d.akt && d.akt.data) + ". Доступ по тарифу «" + esc(d.tarif) + "» — по " + S.ddmm(d.akt && d.akt.period_po) + " включительно.</div>";
    else if (d.status === "annulirovan") plash = '<div class="plash net">Счёт аннулирован — оплачивать его не нужно. <a href="/schet/">Получить новый счёт</a></div>';
    else plash = '<div class="plash">Оплатите до ' + S.ddmm(d.oplatit_do) + " с расчётного счёта компании или ИП. Номер счёта — в назначении платежа: так мы увидим оплату в тот же день.</div>";

    var akt = vid === "akt" && d.akt;
    var pan = '<div class="pan"><span class="gl">' + (akt ? "Акт" : "Счёт") + " № " + esc(d.nomer) + "</span>" +
      (d.akt ? '<span class="seg"><a href="?n=' + encodeURIComponent(n) + "&k=" + encodeURIComponent(k) + '"' + (akt ? "" : ' aria-current="page"') + '>Счёт</a><a href="?n=' + encodeURIComponent(n) + "&k=" + encodeURIComponent(k) + '&vid=akt"' + (akt ? ' aria-current="page"' : "") + ">Акт</a></span>" : "") +
      (p ? '<button class="b1" type="button" data-pdf>Скачать PDF</button>' : "") + "</div>";
    if (!p) { box.innerHTML = pan + plash + list(d, null); return; }
    box.innerHTML = pan + plash + (akt ? aktHtml(d) : list(d, b)) +
      (akt || d.status === "annulirovan" ? "" : '<div class="kop"><button class="b2" type="button" data-kop="nazn">Скопировать назначение платежа</button> <button class="b2" type="button" data-kop="rekv">Скопировать реквизиты</button></div>');
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
      (p ? '<div class="podp"><div>Индивидуальный предприниматель</div><div>' + esc(fioKorotko(p.fio)) + "</div></div>" : "") +
      '<p class="mel">Оплата счёта означает согласие с условиями оферты deloskop.ru/oferta/. Доступ открывается в день зачисления оплаты на срок тарифа.</p></div>';
  }

  function aktHtml(d) {
    var p = d.prodavec, pk = d.pokupatel, a = d.akt;
    var naim = "Предоставление доступа к сервису «Делоскоп» (deloskop.ru), тариф «" + d.tarif + "», на период с " + S.ddmm(a.period_s) + " по " + S.ddmm(a.period_po);
    return '<div class="list">' +
      "<h2>Акт № " + esc(d.nomer) + " от " + S.ddmm(a.data) + "</h2>" +
      '<div class="str"><span>Исполнитель:</span><span>' + prodavecStr(p) + "</span></div>" +
      '<div class="str"><span>Заказчик:</span><span>' + pokupatelStr(pk) + "</span></div>" +
      '<div class="str"><span>Основание:</span><span>Счёт № ' + esc(d.nomer) + " от " + S.ddmm(d.data) + ", оферта deloskop.ru/oferta/</span></div>" +
      pozicii(d, naim) +
      '<p class="prop">Всего на сумму ' + den(d.itogo) + " руб.<br><b>" + esc(S.propis(d.itogo)) + "</b>. " + esc(d.nds_tekst) + ".</p>" +
      '<p class="prop">Доступ к сервису предоставлен Заказчику на указанный период.</p>' +
      '<div class="podp"><div>Исполнитель: ИП ' + esc(fioKorotko(p.fio)) + '</div><div>Заказчик: ' + esc(pk.nazvanie) + "</div></div></div>";
  }
})();
