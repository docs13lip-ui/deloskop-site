/* Админка: «Счета» и «Реквизиты для счетов» (п. 1 «Очереди»). Вызывается из admin.html после входа:
   DlkScheta.start(call, isAdmin, email). Пока API без комплекта schet-v1 — разделы скрыты. */
(function () {
  "use strict";
  var S = window.DeloskopSchet && window.DeloskopSchet.api;
  var TARIF = { start: "Старт", pro: "Про", biznes: "Бизнес" };
  var PLAN = { start: "start", pro: "pro", biznes: "business" };      // имена тарифов в кабинете (admin.py)
  var SROK = { mes: "месяц", kvartal: "квартал", god: "год" };
  var STATUS = { zayavka: "заявка, нет реквизитов", vystavlen: "ждёт оплаты", oplachen: "оплачен", annulirovan: "аннулирован" };
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function note(el, t, c) { el.className = "note" + (c ? " " + c : ""); el.textContent = t || ""; }
  function segodnya() { return new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); }

  function start(call, isAdmin, me) {
    var sek = $("schSek"), rek = $("rekSek");
    if (!sek) return;
    function spisok() {
      return call("/api/admin/scheta" + ($("schF").value ? "?status=" + $("schF").value : "")).then(function (j) {
        sek.hidden = false;
        var items = j.items || [];
        if (!items.length) { $("schList").innerHTML = '<li class="empty" style="border:0">Пока пусто.</li>'; return; }
        $("schList").innerHTML = items.map(function (s) {
          var pk = s.pokupatel || {};
          return '<li class="sch" data-n="' + esc(s.nomer) + '" data-e="' + esc(s.email) + '" data-t="' + esc(s.tarif) + '" data-do="' + esc(s.dostup_do || "") + '">' +
            '<div class="nm"><b>' + esc(pk.nazvanie) + (pk.proveren ? "" : ' <span class="tag blocked">ИНН не сверен</span>') + "</b>" +
            "<span>" + esc(s.nomer) + " от " + S.ddmm(s.data) + " · ИНН " + esc(pk.inn) + " · " + esc(TARIF[s.tarif] || s.tarif) + ", " + esc(SROK[s.srok] || s.srok) +
            " · " + esc(s.email) + (s.ref ? " · партнёр " + esc(s.ref) : "") + " · <b style=\"display:inline;font-weight:600\">" + esc(STATUS[s.status] || s.status) + "</b>" +
            (s.dostup_do ? " до " + S.ddmm(s.dostup_do) : "") + "</span></div>" +
            '<span class="sum">' + S.rub(s.summa) + "</span>" +
            '<div class="ctl"><a class="btn" href="' + esc(s.url) + '" target="_blank" rel="noopener">Открыть</a>' +
            (isAdmin() && s.status === "vystavlen" ? '<input type="date" data-d value="' + segodnya() + '" max="' + segodnya() + '" min="' + esc(s.data) + '" aria-label="Дата оплаты"><button class="btn primary" type="button" data-s="oplachen">Оплачено</button><button class="btn" type="button" data-s="annulirovan">Аннулировать</button>' : "") +
            (isAdmin() && (s.status === "oplachen" || s.status === "annulirovan") ? '<button class="btn" type="button" data-s="vystavlen">Вернуть в «ждёт оплаты»</button>' : "") +
            "</div></li>";
        }).join("");
      }).catch(function (e) { if (e.status === 404) { sek.hidden = true; rek.hidden = true; } else note($("schNote"), e.message, "err"); });
    }
    $("schF").onchange = spisok;
    $("schList").onclick = function (e) {
      var b = e.target.closest("[data-s]"); if (!b) return;
      var li = b.closest("li"), st = b.dataset.s, d = li.querySelector("[data-d]");
      if (st === "annulirovan" && !confirm("Аннулировать счёт " + li.dataset.n + "?")) return;
      b.disabled = true;
      call("/api/admin/scheta/status", { method: "POST", body: { nomer: li.dataset.n, status: st, data_oplaty: d ? d.value : null, kto: me } })
        .then(function (s) {
          if (st !== "oplachen") { note($("schNote"), "Счёт " + s.nomer + ": " + STATUS[s.status], "ok"); return spisok(); }
          // открыть тариф в кабинете клиента: ищем пользователя по почте из заявки
          return call("/api/admin/users?q=" + encodeURIComponent(s.email)).then(function (j) {
            var u = (j.users || j.items || []).filter(function (x) { return (x.email || "").toLowerCase() === s.email.toLowerCase(); })[0];
            if (!u) { note($("schNote"), "Оплата отмечена. " + s.email + " ещё не входил на сайт — после первого входа назначьте тариф «" + TARIF[s.tarif] + "» до " + S.ddmm(s.dostup_do) + " в «Пользователях».", "ok"); return spisok(); }
            return call("/api/admin/plan", { method: "POST", body: { user_id: u.id, plan: PLAN[s.tarif], plan_until: s.dostup_do } })
              .then(function () { note($("schNote"), "Оплата отмечена, тариф «" + TARIF[s.tarif] + "» открыт для " + s.email + " до " + S.ddmm(s.dostup_do) + ". Отправьте клиенту письмо «доступ открыт».", "ok"); return spisok(); });
          });
        })
        .catch(function (e2) { b.disabled = false; note($("schNote"), e2.message, "err"); });
    };

    // реквизиты
    var f = $("rekF");
    function pole(k) { return f.querySelector(k.indexOf(".") > 0 ? '[data-b="' + k + '"]' : '[data-r="' + k + '"]'); }
    function sobrat() {
      var p = { banki: { sber: {}, alfa: {} } };
      [].forEach.call(f.querySelectorAll("[data-r]"), function (i) { p[i.dataset.r] = i.value.trim(); });
      [].forEach.call(f.querySelectorAll("[data-b]"), function (i) { var k = i.dataset.b.split("."); p.banki[k[0]][k[1]] = i.value.trim(); });
      var a = f.querySelector("[name=aktiv]:checked"); p.aktivnyj_bank = a ? a.value : null;
      return p;
    }
    function proverka() {   // подсветка сразу, до сохранения: ключ счёта ловит опечатку в одной цифре
      var p = sobrat(), bad = [];
      function m(k, cond) { var i = pole(k); var b = !!i.value && !cond; i.setAttribute("aria-invalid", b); if (b) bad.push(i); }
      m("inn", p.inn.length === 12 && S.innOk(p.inn)); m("ogrnip", S.ogrnipOk(p.ogrnip));
      ["sber", "alfa"].forEach(function (k) { var b = p.banki[k]; m(k + ".bik", S.bikOk(b.bik)); m(k + ".ks", S.ksOk(b.bik, b.ks)); m(k + ".rs", S.rsOk(b.bik, b.rs)); });
      return bad;
    }
    f.addEventListener("input", proverka);
    f.onsubmit = function (e) {
      e.preventDefault();
      var bad = proverka();
      call("/api/admin/rekvizity", { method: "POST", body: sobrat() }).then(function (j) {
        note($("rekNote"), j.nehvataet.length ? "Сохранено. Для счёта ещё нужно: " + j.nehvataet.join("; ") + "." : "Сохранено. Новые счета выставляются с этими реквизитами.", j.nehvataet.length ? "" : "ok");
        if (bad.length) bad[0].focus();
      }).catch(function (e2) { note($("rekNote"), e2.message, "err"); });
    };
    call("/api/admin/rekvizity").then(function (j) {
      rek.hidden = false;
      var p = j.prodavec || {};
      [].forEach.call(f.querySelectorAll("[data-r]"), function (i) { i.value = p[i.dataset.r] || ""; });
      [].forEach.call(f.querySelectorAll("[data-b]"), function (i) { var k = i.dataset.b.split("."); i.value = ((p.banki || {})[k[0]] || {})[k[1]] || ""; });
      if (p.aktivnyj_bank) { var r = f.querySelector('[name=aktiv][value="' + p.aktivnyj_bank + '"]'); if (r) r.checked = true; }
      if (!isAdmin()) [].forEach.call(f.elements, function (x) { x.disabled = true; });
      $("rekSub").textContent = (j.nehvataet.length ? "Счета пока не выставляются — не хватает: " + j.nehvataet.join("; ") + ". Заявки при этом сохраняются." : "Реквизиты в порядке: новые счета выставляются сразу.") +
        (j.pisma ? "" : " Письма клиентам не отправляются — не задан SMTP (переменные окружения API): отвечайте по шаблонам «Продаж».");
      proverka();
    }).catch(function () { rek.hidden = true; });
    spisok();
  }
  window.DlkScheta = { start: start };
})();
