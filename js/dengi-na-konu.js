/* Делоскоп — «Деньги на кону», шаг 1 (dengi-na-konu-v1, решение команды 12.11; слова — юрист 12.11 п. 3).
 * Что: иски к компании без итогового решения + остаток долга по открытым исполнительным производствам + недоимка —
 * в сравнении с годовой выручкой по ГИР БО. Числа считает сервер (поле `dengi` ответа /api/check, api-dengi-na-konu-v1);
 * здесь — только подписи, доля и строка действия ПОЛЬЗОВАТЕЛЯ. Оценки чужой платёжеспособности и прогноза исхода нет.
 * Где: только отчёт по ИНН (экран проверки и /report.html), только организации; не ИП, не карточки /company/,
 * не «своя компания» (Щит) — карточкам отдельное «да» юрист после месяца без жалоб.
 * Подписи — дословно юрист 12.11 п. 3; запрещённые слова сторожит tests/dengi_na_konu.test.js.
 * Цель Метрики: dengi_na_konu_view {porog}. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DengiNaKonu = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var NB = " ";

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // 24542188319 → «24,5 млрд ₽»; 4239775 → «4,2 млн ₽»; 856300 → «856 300 ₽»
  function rub(v) {
    v = Math.max(0, Math.round(Number(v) || 0));
    var drob = function (x) { return x.toLocaleString("ru-RU", { maximumFractionDigits: 1 }).replace(/\s/g, NB); };
    if (v >= 1e9) return drob(v / 1e9) + NB + "млрд" + NB + "₽";
    if (v >= 1e6) return drob(v / 1e6) + NB + "млн" + NB + "₽";
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + "₽";
  }

  function data(v) {
    if (!v) return "";
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    return m ? m[3] + "." + m[2] + "." + m[1] : "";
  }

  // Подписи строк и источников — юрист 12.11 п. 1.2 и п. 3, дословно
  var VIDY = {
    iski_otvetchik: { podpis: "Иски к компании без итогового решения", istochnik: "Картотека арбитражных дел — через Checko", kratko: "иски" },
    fssp_ostatok: { podpis: "Остаток долга по открытым исполнительным производствам", istochnik: "ФССП, банк данных исполнительных производств — через Checko", kratko: "производства у приставов" },
    nedoimka: { podpis: "Недоимка и задолженность по пеням и штрафам", istochnik: "ФНС, открытые данные", kratko: "недоимка" }
  };
  var PORYADOK = ["iski_otvetchik", "fssp_ostatok", "nedoimka"];

  var OGOVORKA = "Это сравнение сумм из открытых реестров на указанные даты, а не оценка платёжеспособности. " +
    "Иски могут отклонить, долг — уже погасить. Сверьте с документами компании.";
  var DEJSTVIE = {
    srednyaya: "Предоплату — частями, под отгрузку; проверьте снова перед следующим платежом",
    bolshaya: "Без предоплаты или с обеспечением: оплата по факту, аккредитив, банковская гарантия"
  };

  function ip(r) {
    var c = (r && r.company) || {};
    return c.kind === "INDIVIDUAL" || String(c.inn || "").replace(/\D/g, "").length === 12;
  }

  // raschet(r, segodnya) → null (блока нет) или {stroki, neProvereno, summa, dolya, porog, podpis, dejstvie, dataNashli, nepolno}
  // porog: net (сумм нет) · malaya (< 10 %) · srednyaya (10–50 %) · bolshaya (> 50 %) · bez_vyruchki (сравнить не с чем)
  function raschet(r, segodnya) {
    var D = r && r.dengi;
    if (!D || typeof D !== "object" || ip(r)) return null;
    var sost = Array.isArray(D.sostavlyayushchie) ? D.sostavlyayushchie : [];
    var po = {};
    sost.forEach(function (x) { if (x && VIDY[x.vid] && x.summa != null && isFinite(Number(x.summa))) po[x.vid] = x; });
    var neUchteno = (Array.isArray(D.ne_uchteno) ? D.ne_uchteno : []).map(function (x) { return typeof x === "string" ? x : x && x.vid; });
    var neProvereno = PORYADOK.filter(function (v) { return !po[v] || neUchteno.indexOf(v) >= 0; });
    var stroki = PORYADOK.filter(function (v) { return po[v] && neProvereno.indexOf(v) < 0; }).map(function (v) {
      var x = po[v], dt = data(x.data_svedeniy || x.data_nabora);
      var ohv = /^pervye_(\d+)_iz_(\d+)$/.exec(String(x.ohvat || ""));
      return {
        vid: v, podpis: VIDY[v].podpis, summa: Math.max(0, Number(x.summa)), chislo: x.chislo,
        istochnik: VIDY[v].istochnik + (dt ? ", на " + dt : ""),
        nepolno: ohv ? "в сумме — первые " + ohv[1] + ", по всем она может быть больше" : ""
      };
    });
    if (!stroki.length) return null; // ни один источник не ответил — нечего показывать (опись «Что проверено» скажет сама)
    var summa = stroki.reduce(function (s, x) { return s + x.summa; }, 0);
    var dataNashli = stroki.map(function (x) { var p = po[x.vid]; return data(p.data_svedeniy || p.data_nabora); })
      .filter(Boolean).sort(function (a, b) { return a.split(".").reverse().join("") < b.split(".").reverse().join("") ? 1 : -1; })[0] || "";
    var o = { stroki: stroki, neProvereno: neProvereno, summa: summa, dolya: null, porog: "", podpis: "", dejstvie: "", dataNashli: dataNashli,
      nepolno: stroki.some(function (x) { return x.nepolno; }), vyruchka: null };
    if (summa <= 0) { o.porog = "net"; return o; }
    var V = D.vyruchka || {}, god = Number(V.god), tek = (segodnya || new Date()).getFullYear();
    // юрист п. 3: нет отчёта, выручка 0 или отчёт старше 2 лет → процент не показываем
    if (!(Number(V.summa) > 0) || !god || tek - god > 2) { o.porog = "bez_vyruchki"; return o; }
    o.vyruchka = { summa: Number(V.summa), god: god };
    var d = summa / Number(V.summa);
    o.dolya = d;
    if (d < 0.1) { o.porog = "malaya"; o.podpis = "меньше 10" + NB + "% годовой выручки"; }
    else if (d <= 0.5) { o.porog = "srednyaya"; o.podpis = Math.min(50, Math.max(10, Math.round(d * 100))) + NB + "% годовой выручки"; o.dejstvie = DEJSTVIE.srednyaya; }
    else { o.porog = "bolshaya"; o.podpis = d > 1 ? "больше годовой выручки" : "больше половины годовой выручки"; o.dejstvie = DEJSTVIE.bolshaya; }
    return o;
  }

  var CSS = ".dnk{display:grid;gap:12px;padding:20px 22px;border-radius:16px;border:1px solid var(--line,#E6E6E1);background:var(--surface,transparent);margin:0 0 16px}" +
    ".dnk__h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px}.dnk__h h2{margin:0;font-size:20px;font-weight:600;letter-spacing:-.01em}" +
    ".dnk__h span{font-size:13px;color:var(--muted,#66666B)}.dnk p{margin:0}" +
    ".dnk__itog{display:grid;gap:6px}.dnk__sum{font-size:32px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.15}" +
    ".dnk__dolya{font-size:15px;color:var(--ink-2,#3A3A3F)}" +
    ".dnk__shk{position:relative;height:6px;border-radius:3px;background:var(--surface-2,#EDEDE8);overflow:hidden;max-width:420px}" +
    ".dnk__shk i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--ink,#111113)}" +
    ".dnk__shk b{position:absolute;top:0;bottom:0;width:1px;background:var(--bg,#fff)}" +
    ".dnk__act{font-size:15px;line-height:1.5;padding:10px 14px;border-radius:10px;background:var(--surface-2,#F2F2EE)}.dnk__act b{font-weight:600}" +
    ".dnk__rows{list-style:none;margin:0;padding:0;display:grid;gap:0;border-top:1px solid var(--line,#E6E6E1)}" +
    ".dnk__rows li{display:grid;grid-template-columns:1fr auto;gap:2px 16px;padding:10px 0;border-bottom:1px solid var(--line,#E6E6E1)}" +
    ".dnk__rows .dnk__p{font-size:15px;line-height:1.4}.dnk__rows .dnk__v{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}" +
    ".dnk__rows small{grid-column:1/-1;font-size:12px;color:var(--muted,#66666B);line-height:1.4}" +
    ".dnk__np{font-size:13px;color:var(--muted,#66666B)}.dnk__og{font-size:12px;line-height:1.5;color:var(--muted,#66666B)}" +
    "@media (max-width:520px){.dnk{padding:16px}.dnk__sum{font-size:24px}}@media print{.dnk{break-inside:avoid;border-color:#ccc}}";

  function html(o) {
    if (!o) return "";
    var shk = "", itog;
    if (o.porog === "net") {
      itog = '<p class="dnk__sum">0' + NB + "₽</p>" +
        '<p class="dnk__dolya">Исков, долгов у приставов и недоимки на ' + esc(o.dataNashli) + " не нашли" +
        (o.neProvereno.length ? " (" + o.neProvereno.map(function (v) { return VIDY[v].kratko; }).join(", ") + " — не проверено)" : "") + "</p>";
    } else {
      var pod = o.porog === "bez_vyruchki" ? "Сравнить не с чем: нет свежей отчётности в ГИР" + NB + "БО" :
        esc(o.podpis) + " — выручка за " + o.vyruchka.god + NB + "год по бухгалтерской отчётности (ГИР" + NB + "БО): " + rub(o.vyruchka.summa);
      itog = '<p class="dnk__sum">' + rub(o.summa) + "</p>" + '<p class="dnk__dolya">' + pod + "</p>";
      if (o.dolya != null) {
        var w = Math.max(1, Math.min(100, Math.round(o.dolya * 100)));
        // риски на 10 и 50 % — границы правила отображения, без цвета-оценки
        shk = '<div class="dnk__shk" role="img" aria-label="Доля в годовой выручке: ' + esc(o.podpis) + '"><i style="width:' + w + '%"></i><b style="left:10%"></b><b style="left:50%"></b></div>';
      }
    }
    var rows = o.stroki.map(function (x) {
      return '<li><span class="dnk__p">' + esc(x.podpis) + '</span><span class="dnk__v">' + rub(x.summa) + "</span>" +
        "<small>" + esc(x.istochnik) + (x.chislo ? " · " + esc(x.vid === "iski_otvetchik" ? x.chislo + " дел" : x.chislo + " производств") : "") +
        (x.nepolno ? " · " + esc(x.nepolno) : "") + "</small></li>";
    }).join("");
    var np = o.porog !== "net" && o.neProvereno.length ? '<p class="dnk__np">Не проверено: ' + o.neProvereno.map(function (v) { return VIDY[v].kratko; }).join(", ") +
      " — источник не ответил, в сумму не вошло.</p>" : "";
    return '<section class="dnk" aria-labelledby="dnk-h" data-dengi="' + esc(o.porog) + '">' +
      '<div class="dnk__h"><h2 id="dnk-h">Деньги на кону</h2><span>иски, приставы и недоимка против выручки</span></div>' +
      '<div class="dnk__itog">' + itog + shk + "</div>" +
      (o.dejstvie ? '<p class="dnk__act"><b>Что сделать:</b> ' + esc(o.dejstvie) + ".</p>" : "") +
      '<ul class="dnk__rows">' + rows + "</ul>" + np +
      '<p class="dnk__og">' + esc(OGOVORKA) + "</p></section>";
  }

  function stil(doc) {
    if (!doc || doc.getElementById("dnk-css")) return;
    var s = doc.createElement("style"); s.id = "dnk-css"; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
  }

  // mount(report, r) — экран проверки: первым в основной колонке листа (.ot-main); /report.html — после «Светофора».
  // Повторная проверка заменяет блок; нет данных — блок убирается.
  function mount(report, r, segodnya) {
    if (!report) return null;
    var star = report.querySelector(".dnk"), o = raschet(r, segodnya), h = html(o);
    if (!h) { if (star && star.parentNode) star.parentNode.removeChild(star); return null; }
    var doc = report.ownerDocument, t = doc.createElement("div");
    t.innerHTML = h;
    var nov = t.firstChild;
    try { stil(doc); } catch (e) {}
    if (star && star.parentNode) star.parentNode.replaceChild(nov, star);
    else {
      var main = report.querySelector(".ot-main"), sig = report.querySelector("table.sig");
      if (main) main.insertBefore(nov, main.firstChild);
      else if (sig && sig.parentNode) sig.parentNode.insertBefore(nov, sig.nextSibling);
      else return null;
    }
    if (typeof self !== "undefined" && self.dlkGoal) { try { self.dlkGoal("dengi_na_konu_view", { porog: o.porog }); } catch (e) {} }
    return nov;
  }

  return { raschet: raschet, html: html, mount: mount, rub: rub, OGOVORKA: OGOVORKA, DEJSTVIE: DEJSTVIE, VIDY: VIDY, CSS: CSS };
});
