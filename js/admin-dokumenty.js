/* Админка: «Документы в фирменном стиле» (admin-dokumenty-v1, 14.11.2026).
 *
 * Письмо от команды, письмо от ИП, счёт, два акта (право использования; работы и услуги) и два договора (с организацией
 * или ИП; с физическим лицом) — в одном оформлении: знак и слово «делоскоп» вверху, внизу визитка и QR-код сайта.
 * Поля слева, лист A4 справа; «Сохранить PDF» — окно печати браузера. Вызывается из admin.html после входа:
 * DlkDokumenty.start(call, isAdmin).
 *
 * Правила:
 *  • реквизиты продавца — только с сервера (/api/admin/rekvizity), в коде сайта их нет; пока не пришли — в листе прочерки;
 *  • «Заполнить по ИНН» — та же проверка, что на сайте (/api/check, запасной путь /api/suggest): название, КПП, ОГРН,
 *    адрес и руководитель организации из реестра; по физическим лицам ничего не ищем — их данные вносятся вручную,
 *    паспортных данных в договоре нет;
 *  • росчерк (подпись-картинка) выбирается с компьютера и хранится только в этом браузере (localStorage), на сервер и
 *    в код сайта не уходит; встаёт сам на строку подписи или щелчком по листу; в договоре его допускает п. 3.3
 *    (п. 2 ст. 160 ГК РФ — по соглашению сторон), подсказка под кнопкой говорит, где росчерка недостаточно;
 *  • набранное в полях никуда не отправляется, кроме ИНН для заполнения: лист собирается в браузере;
 *  • размеры листа — в мм и пт (печать), цвета — дизайн-система. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.DlkDokumenty = api;
})(this, function () {
  "use strict";
  var NB = " ";
  var KLYUCH = "dlk_adm_roscherk";                                   // росчерк — только в этом браузере
  var VIDY = [["dogovor_ur", "Договор с организацией или ИП"], ["dogovor_fiz", "Договор с физическим лицом"], ["schet", "Счёт на оплату"],
    ["akt_uslugi", "Акт выполненных работ (оказанных услуг)"], ["akt", "Акт — право использования (лицензия)"], ["pismo", "Письмо от команды Делоскопа"], ["pismo_ip", "Письмо от ИП"]];
  // Где росчерка достаточно, а где нет — подсказка под кнопкой
  var ROSCHERK = {
    pismo: "",
    pismo_ip: "В письма в банк и госорганы росчерк не ставьте: там нужна живая или электронная подпись.",
    schet: "Счёт — не первичный документ, росчерк в нём допустим.",
    akt: "Росчерк в акте действует, если стороны договорились об этом (п. 3.3 договора). Иначе — живая или электронная подпись.",
    akt_uslugi: "Росчерк в акте действует, если стороны договорились об этом (п. 3.3 договора). Иначе — живая или электронная подпись.",
    dogovor_ur: "Росчерк допускает п. 3.3 самого договора (п. 2 ст. 160 ГК РФ). Вторая сторона подписывает со своей стороны.",
    dogovor_fiz: "Росчерк допускает п. 3.3 самого договора (п. 2 ст. 160 ГК РФ). Оплата от физического лица — с кассовым чеком: спросите бухгалтера до подписания."
  };
  var MES = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  var NAIM_SCHET = "Доступ к" + NB + "сервису «Делоскоп», тариф «____», период ________ (простая неисключительная лицензия по" + NB + "оферте deloskop.ru/oferta/)";
  var NAIM_AKT = "Предоставлено право использования программы для ЭВМ «Делоскоп» (простая неисключительная лицензия), тариф «____», на" + NB + "период с" + NB + "__.__.20__ по" + NB + "__.__.20__";
  var NAIM_USL = "________________________________ (услуга или работа)";
  var VYBOR = { predmet: [["lic", "Доступ к сервису (лицензия)"], ["usl", "Услуги или работы"]] };
  // Поля слева: [ключ, подпись, вид, условие]. «inn» — поле с кнопкой «Заполнить по ИНН»; условие — предмет договора.
  var STORONA = [["pinn", "ИНН", "inn"], ["pok", "Название"], ["pkpp", "КПП"]];
  var PREDMET = [["predmet", "О чём договор", "sel"], ["tarif", "Тариф", "", "lic"], ["usluga", "Услуга или работа", "area2", "usl"], ["srok", "Срок"], ["summa", "Сумма, ₽", "num"]];
  var POLYA = {
    pismo: [["nomer", "Исх. №"], ["data", "Дата", "date"], ["komu", "Кому", "area2"], ["tema", "Тема письма"], ["obr", "Обращение"], ["tekst", "Текст письма", "area"]],
    pismo_ip: [["nomer", "Исх. №"], ["data", "Дата", "date"], ["komu", "Кому", "area2"], ["tema", "Тема письма"], ["obr", "Обращение"], ["tekst", "Текст письма", "area"], ["pril", "Приложение"]],
    schet: STORONA.concat([["nomer", "Номер счёта"], ["data", "Дата", "date"], ["naim", "Наименование", "area2"], ["kol", "Количество", "num"], ["cena", "Цена, ₽", "num"], ["do", "Действителен до", "date"]]),
    akt: STORONA.concat([["nomer", "Номер акта"], ["data", "Дата", "date"], ["osn", "Основание"], ["naim", "Наименование", "area2"], ["kol", "Количество", "num"], ["cena", "Цена, ₽", "num"]]),
    akt_uslugi: STORONA.concat([["nomer", "Номер акта"], ["data", "Дата", "date"], ["osn", "Основание (договор, счёт)"], ["naim", "Услуга или работа", "area2"], ["kol", "Количество", "num"], ["cena", "Цена, ₽", "num"]]),
    dogovor_ur: STORONA.concat([["pogrn", "ОГРН или ОГРНИП"], ["padres", "Адрес", "area2"], ["pruk", "Кто подписывает (должность и ФИО)"], ["posn", "На основании"], ["pemail", "Эл. почта"],
      ["nomer", "Номер договора"], ["data", "Дата", "date"], ["mesto", "Место заключения"]], PREDMET),
    dogovor_fiz: [["pok", "Фамилия, имя, отчество"], ["pemail", "Эл. почта"], ["nomer", "Номер договора"], ["data", "Дата", "date"], ["mesto", "Место заключения"]].concat(PREDMET)
  };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function v(x, zagl) { x = String(x == null ? "" : x).trim(); return x ? esc(x) : zagl; }
  function chislo(x) { var n = parseFloat(String(x == null ? "" : x).replace(/\s/g, "").replace(",", ".")); return isFinite(n) && n >= 0 ? n : null; }
  function den(n) { if (n == null) return "________"; var s = (Math.round(n * 100) / 100).toFixed(2).split("."); return s[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB) + "," + s[1]; }
  function dataSlovami(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? +m[3] + NB + MES[+m[2] - 1] + " " + m[1] + NB + "г." : "«___»" + NB + "__________ 20__" + NB + "г."; }
  function dataCifry(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? m[3] + "." + m[2] + "." + m[1] : "__.__.20__"; }
  function fioKorotko(f) { var p = String(f || "").trim().split(/\s+/); return p[0] ? p[0] + (p[1] ? " " + p[1][0] + "." : "") + (p[2] ? NB + p[2][0] + "." : "") : "______________"; }
  function bankIz(p) { var b = (p && p.banki) || {}; return b[p && p.aktivnyj_bank] || b.alfa || b.sber || {}; }
  function abzacy(t) { return String(t || "").split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) { return "<p>" + esc(x) + "</p>"; }).join(""); }
  function eIP(inn) { return /^\d{12}$/.test(String(inn || "").trim()); }
  function pokazat(f, d) { return !f[3] || f[3] === ((d && d.predmet) === "usl" ? "usl" : "lic"); }
  // Ответ проверки по ИНН → поля стороны: организация или ИП из реестра, как их отдаёт проверка сайта
  function izProverki(j) {
    var c = (j && j.company) || (j && j.items && j.items[0]) || null; if (!c) return null;
    var o = { pok: c.name_short || c.name || c.name_full || "", pinn: c.inn || "", pkpp: c.kpp || "", pogrn: c.ogrn || "", padres: c.address || "" };
    if (c.director_name) o.pruk = (c.director_post ? String(c.director_post).toLowerCase() + " " : "") + c.director_name;
    return o.pok ? o : null;
  }

  // ---------- общие части листа: шапка, подписи, низ — одни на все документы ----------
  function shapka(p, yur) {
    var prav = yur
      ? "<b>Индивидуальный предприниматель " + v(p.fio, "______________") + "</b><span>ИНН" + NB + v(p.inn, "____________") + " · ОГРНИП" + NB + v(p.ogrnip, "_______________") + "</span><span>help@deloskop.ru · deloskop.ru</span>"
      : "<b>Команда Делоскопа</b><span>Проверка контрагента по" + NB + "ИНН</span><span>help@deloskop.ru · deloskop.ru</span>";
    return '<div class="st" aria-hidden="true"><img src="/img/dok/studiya.jpg" alt=""><i></i></div>' +
      '<div class="sh"><div class="lg"><img src="/img/dok/znak.webp" alt=""><b>делоскоп</b></div><div class="rk">' + prav + "</div></div>";
  }
  function niz(p, yur, snoska) {
    var lev = yur ? "ИП " + esc(fioKorotko(p.fio)) + " · ИНН" + NB + v(p.inn, "____________") + " · ОГРНИП" + NB + v(p.ogrnip, "_______________") + " · help@deloskop.ru · deloskop.ru" : "Команда Делоскопа · help@deloskop.ru · deloskop.ru";
    return (snoska ? '<div class="fn">' + snoska + "</div>" : "") +
      '<div class="vz"><img src="/img/dok/vizitka-oborot.jpg" alt=""><img src="/img/dok/vizitka-lico.jpg" alt="Визитка Делоскопа"></div>' +
      '<div class="qr"><div><img src="/img/dok/qr.svg" alt="QR-код: deloskop.ru"></div><span>deloskop.ru</span></div>' +
      '<div class="ft"><span>' + lev + "</span><span>1</span></div>";
  }
  function liniya(nasha) { return '<div class="ln"' + (nasha ? " data-nasha" : "") + "><i></i><span>подпись</span></div>"; }
  function podpisA(p) { return '<div class="pa"><span>Индивидуальный предприниматель</span>' + liniya(true) + "<span>" + esc(fioKorotko(p.fio)) + "</span></div>"; }
  function podpisB() { return '<div class="pb"><div>С' + NB + 'уважением,</div><b>Команда Делоскопа</b><div class="ss">help@deloskop.ru · deloskop.ru</div></div>'; }
  function podpisA2(p, nash, ih, kto) {
    return '<div class="s2"><div><b>' + nash + "</b><span>ИП " + v(p.fio, "______________") + '</span><div class="pp">' + liniya(true) + "<span>" + esc(fioKorotko(p.fio)) + "</span></div></div>" +
      "<div><b>" + ih + "</b><span>" + v(kto, "______________________________") + '</span><div class="pp">' + liniya(false) + "<span>/ ______________ /</span></div><em>должность, фамилия и" + NB + "инициалы</em></div></div>";
  }
  function meta(d) {
    return '<div class="bl mt"><div class="s"><span>Исх. №' + NB + v(d.nomer, "____") + " от" + NB + dataSlovami(d.data) + "</span><span>На №" + NB + "________ от" + NB + "«___»" + NB + "__________ 20__" + NB + "г.</span></div>" +
      '<div><span class="s">Кому</span>' + (String(d.komu || "").trim() ? abzacy(d.komu).replace(/<p>/g, "<span>").replace(/<\/p>/g, "</span>") : "<span>______________________________</span><span>______________________________</span>") + "</div></div>";
  }
  function pozicii(naim, d) {
    var kol = chislo(d.kol), cena = chislo(d.cena), sum = kol != null && cena != null ? kol * cena : null;
    return { sum: sum, html: '<div class="tb poz"><div class="h">№</div><div class="h">Наименование</div><div class="h r">Кол-во</div><div class="h">Ед.</div><div class="h r">Цена,' + NB + '₽</div><div class="h r">Сумма,' + NB + "₽</div>" +
      '<div class="c">1</div><div class="c">' + v(d.naim, naim) + '</div><div class="c r">' + (kol != null ? esc(String(kol).replace(".", ",")) : "1") + '</div><div class="c">шт.</div><div class="c r">' + den(cena) + '</div><div class="c r">' + den(sum) + "</div></div>" };
  }
  function itogi(sum, posl, nds) {
    return '<div class="it"><span></span><span class="s">Итого</span><span>' + den(sum) + '</span><span></span><span class="s">' + esc(nds) + "</span><span>—</span><span></span><b>" + posl + "</b><b>" + den(sum) + "</b></div>";
  }
  // вторая сторона в счёте и акте: с ИНН — организация или ИП; название без ИНН — человек, только имя
  function storona(d) {
    var inn = String(d.pinn || "").trim(), imya = String(d.pok || "").trim();
    if (imya && !inn) return esc(imya);
    return v(d.pok, "______________________________") + ", ИНН" + NB + v(d.pinn, "____________") + (eIP(inn) ? "" : ", КПП" + NB + v(d.pkpp, "_________"));
  }
  function prodavec(p) { return "Индивидуальный предприниматель " + v(p.fio, "______________") + ", ИНН" + NB + v(p.inn, "____________") + ", ОГРНИП" + NB + v(p.ogrnip, "_______________"); }

  // ---------- договор: один лист; предмет — лицензия на сервис или услуги и работы ----------
  function dogovor(vid, d, p, propis) {
    var fiz = vid === "dogovor_fiz", usl = d.predmet === "usl", b = bankIz(p), sum = chislo(d.summa), slov = sum != null && propis ? propis(sum) : "", ip = !fiz && eIP(d.pinn);
    var nds = String(p.nds_tekst || "").trim() || "Без налога (НДС)";
    var my = usl ? ["Исполнитель", "Исполнителя"] : ["Лицензиар", "Лицензиара"], on = usl ? ["Заказчик", "Заказчика"] : ["Лицензиат", "Лицензиата"];
    var kto = fiz ? v(d.pok, "______________________________ (фамилия, имя, отчество)")
      : v(d.pok, "______________________________") + " (ИНН" + NB + v(d.pinn, "____________") + (ip ? "" : ", КПП" + NB + v(d.pkpp, "_________")) + ", " + (ip ? "ОГРНИП" : "ОГРН") + NB + v(d.pogrn, "_______________") + ")";
    var lico = fiz || ip ? "" : ", от" + NB + "имени которого действует " + v(d.pruk, "______________________________") + " на" + NB + "основании " + v(d.posn, "Устава");
    var dengi = den(sum) + " руб. (" + (slov ? esc(slov) : "____________________________________") + "). " + esc(nds) + ".";
    var oplata = fiz ? on[0] + " оплачивает эту сумму безналичным переводом на" + NB + "расчётный счёт " + my[1] + " по" + NB + "реквизитам раздела" + NB + "5 в" + NB + "течение 5" + NB + "рабочих дней с" + NB + "даты договора."
      : on[0] + " оплачивает эту сумму по" + NB + "счёту " + my[1] + " в" + NB + "срок, указанный в" + NB + "счёте, безналичным переводом со" + NB + "своего расчётного счёта.";
    var vozr = " Если " + on[0] + " в" + NB + "течение 5" + NB + "рабочих дней после получения акта не" + NB + "направил письменных возражений, акт считается принятым.";
    function para(a, c) { return '<span class="s">' + a + "</span><span>" + c + "</span>"; }
    function pn(n, t) { return "<p><i>" + n + "</i> " + t + "</p>"; }
    var usloviya = usl
      ? "<h2>1. Предмет договора</h2>" +
        pn("1.1.", "Исполнитель обязуется оказать Заказчику услуги (выполнить работы): " + v(d.usluga, "________________________________________________") + ", а" + NB + "Заказчик" + NB + "— принять и оплатить их. Срок: " + v(d.srok, "________") + ".") +
        pn("1.2.", "Исполнитель отвечает за" + NB + "качество и сроки своей работы. Решения банков, государственных органов и иных третьих лиц от" + NB + "Исполнителя не" + NB + "зависят, и" + NB + "Исполнитель их не" + NB + "гарантирует.") +
        "<h2>2. Стоимость и расчёты</h2>" +
        pn("2.1.", "Стоимость услуг (работ)" + NB + "— " + dengi) + pn("2.2.", oplata) +
        pn("2.3.", "Исполнитель приступает к" + NB + "работе не" + NB + "позднее рабочего дня, следующего за" + NB + "днём зачисления оплаты, если стороны не" + NB + "договорились об" + NB + "ином.") +
        "<h2>3. Документы и подписи</h2>" +
        pn("3.1.", "По" + NB + "окончании Исполнитель направляет Заказчику акт выполненных работ (оказанных услуг)." + vozr)
      : "<h2>1. Предмет договора</h2>" +
        pn("1.1.", "Лицензиар предоставляет Лицензиату право использования программы для ЭВМ «Делоскоп» через сайт deloskop.ru на" + NB + "условиях простой (неисключительной) лицензии по" + NB + "тарифу «" + v(d.tarif, "____") + "» на" + NB + "срок " + v(d.srok, "________") + ".") +
        pn("1.2.", "Порядок доступа, пределы использования программы, обработка данных и ответственность сторон определены офертой Лицензиара по" + NB + "адресу deloskop.ru/oferta/ в" + NB + "редакции на" + NB + "дату договора. Оферта" + NB + "— неотъемлемая часть договора; если договор и оферта расходятся, применяется договор.") +
        "<h2>2. Вознаграждение и расчёты</h2>" +
        pn("2.1.", "Вознаграждение Лицензиара за" + NB + "весь срок" + NB + "— " + dengi) + pn("2.2.", oplata) +
        pn("2.3.", "Доступ открывается не" + NB + "позднее рабочего дня, следующего за" + NB + "днём зачисления оплаты. С" + NB + "этого дня исчисляется срок лицензии.") +
        "<h2>3. Документы и подписи</h2>" +
        pn("3.1.", "В" + NB + "день открытия доступа Лицензиар оформляет акт о" + NB + "предоставлении права использования." + vozr);
    return shapka(p, true) +
      '<div class="bl dg"><h1>' + (usl ? "Договор оказания услуг №" : "Лицензионный договор №") + NB + v(d.nomer, "________") + '</h1><div class="dm"><span>' + v(d.mesto, "") + "</span><span>" + dataSlovami(d.data) + "</span></div>" +
      "<p>" + prodavec(p) + ", далее" + NB + "— «" + my[0] + "», и " + kto + ", далее" + NB + "— «" + on[0] + "»" + lico + ", заключили договор о" + NB + "следующем.</p>" + usloviya +
      pn("3.2.", "Стороны признают юридическую силу договора, счетов, актов и писем, направленных по" + NB + "электронной почте с" + NB + "адресов, указанных в" + NB + "разделе" + NB + "5.") +
      pn("3.3.", "Стороны допускают подписание договора, счетов и актов к" + NB + "нему с" + NB + "использованием факсимильного воспроизведения подписи (п." + NB + "2 ст." + NB + "160 Гражданского кодекса" + NB + "РФ).") +
      "<h2>4. Срок действия</h2>" +
      pn("4.1.", "Договор вступает в" + NB + "силу с" + NB + "даты подписания и действует до" + NB + (usl ? "исполнения сторонами обязательств." : "окончания срока лицензии.") + (fiz ? " Если " + on[0] + " заключает договор для личных нужд, применяется законодательство о" + NB + "защите прав потребителей." : "")) +
      pn("4.2.", "Отказ от" + NB + "договора и споры" + NB + "— в" + NB + "порядке, установленном Гражданским кодексом" + NB + "РФ" + (usl ? "." : " и офертой.")) +
      "<h2>5. Реквизиты и подписи сторон</h2></div>" +
      '<div class="tb rs dr"><div class="c rr"><span class="w"><b>' + my[0] + ":</b> Индивидуальный предприниматель " + v(p.fio, "______________") + "</span>" +
      para("ИНН · ОГРНИП", v(p.inn, "____________") + " · " + v(p.ogrnip, "_______________")) + para("Банк, БИК", v(b.bank, "______________") + ", " + v(b.bik, "_________")) + para("Корр. счёт", v(b.ks, "____________________")) + para("Расчётный счёт", v(b.rs, "____________________")) + para("Эл. почта", "help@deloskop.ru") + "</div>" +
      '<div class="c rr"><span class="w"><b>' + on[0] + ":</b> " + v(d.pok, "______________________________") + "</span>" +
      (fiz ? para("Эл. почта", v(d.pemail, "________________________"))
        : para("ИНН" + (ip ? "" : " · КПП"), v(d.pinn, "____________") + (ip ? "" : " · " + v(d.pkpp, "_________"))) + para(ip ? "ОГРНИП" : "ОГРН", v(d.pogrn, "_______________")) + para("Адрес", v(d.padres, "________________________")) + para("Эл. почта", v(d.pemail, "________________________"))) + "</div></div>" +
      '<div class="s2 dp"><div><div class="pp">' + liniya(true) + "<span>" + esc(fioKorotko(p.fio)) + '</span></div></div><div><div class="pp">' + liniya(false) + "<span>/ ______________ /</span></div></div></div>" + niz(p, true);
  }

  // ---------- лист: один документ ----------
  // vid — ключ из VIDY; d — поля; p — продавец с сервера; propis(n) — сумма прописью (js/schet.js)
  function list(vid, d, p, propis) {
    d = d || {}; p = p || {};
    var nds = String(p.nds_tekst || "").trim() || "Без налога (НДС)", b = bankIz(p), pz;
    function slovami(sum) { var t = sum != null && propis ? propis(sum) : ""; return t ? esc(t) : "________________________________________________ (сумма прописью)"; }
    if (vid === "dogovor_ur" || vid === "dogovor_fiz") return dogovor(vid, d, p, propis);
    if (vid === "pismo" || vid === "pismo_ip") {
      var yur = vid === "pismo_ip";
      return shapka(p, yur) + meta(d) +
        '<div class="bl tl"><h1>' + v(d.tema, "Тема письма") + "</h1><p>" + v(d.obr, yur ? "Уважаемый(ая) ______________," : "Здравствуйте, ______________.") + "</p>" +
        (String(d.tekst || "").trim() ? abzacy(d.tekst) : "<p>Текст письма.</p>") +
        (yur ? '<p class="s m">Приложение: ' + v(d.pril, "______________ на" + NB + "__" + NB + "л.") + "</p>" : "") + "</div>" +
        (yur ? podpisA(p) + '<div class="is">Исполнитель: Команда Делоскопа, help@deloskop.ru</div>' : podpisB()) + niz(p, yur);
    }
    if (vid === "schet") {
      pz = pozicii(NAIM_SCHET, d);
      return shapka(p, true) +
        '<div class="tb bk"><div class="c bn"><span>' + v(b.bank, "______________") + '</span><em>Банк получателя</em></div><div class="c s">БИК</div><div class="c n">' + v(b.bik, "_________") + '</div><div class="c s">Сч.' + NB + '№</div><div class="c n">' + v(b.ks, "____________________") + "</div>" +
        '<div class="bp"><div><span>ИНН' + NB + v(p.inn, "____________") + "</span><span>КПП" + NB + '—</span></div><div class="c"><span>ИП ' + v(p.fio, "______________") + '</span><em>Получатель</em></div></div><div class="c s b2">Сч.' + NB + '№</div><div class="c n b2">' + v(b.rs, "____________________") + "</div></div>" +
        '<div class="bl b3"><h1>Счёт на' + NB + "оплату №" + NB + v(d.nomer, "Д-20__-______") + " от" + NB + dataSlovami(d.data) + '</h1><div class="sv"><span class="s">Поставщик</span><span>' + prodavec(p) + '</span><span class="s">Покупатель</span><span>' + storona(d) + "</span></div></div>" +
        pz.html + itogi(pz.sum, "Всего к" + NB + "оплате", nds) +
        '<div class="bl b4"><div>Всего наименований' + NB + "1, на" + NB + "сумму " + den(pz.sum) + " руб.</div><b>" + slovami(pz.sum) + "</b><div>" + esc(nds) + ". Счёт действителен до" + NB + dataSlovami(d.do) + "</div></div>" +
        '<div class="nz"><b>Назначение платежа:</b> Оплата по' + NB + "счёту №" + NB + v(d.nomer, "Д-20__-______") + " от" + NB + dataCifry(d.data) + " за" + NB + "доступ к" + NB + "сервису «Делоскоп». Без" + NB + "НДС.</div>" +
        podpisA(p) +
        niz(p, true, "Оплата только с" + NB + "расчётного счёта организации или ИП. Оплата счёта" + NB + "— акцепт оферты deloskop.ru/oferta/ (п." + NB + "3 ст." + NB + "438 ГК" + NB + "РФ). Доступ открывается не" + NB + "позднее рабочего дня, следующего за" + NB + "днём зачисления оплаты, на" + NB + "срок тарифа.");
    }
    // акты: право использования (как на сайте) и выполненные работы, оказанные услуги
    var usl = vid === "akt_uslugi";
    pz = pozicii(usl ? NAIM_USL : NAIM_AKT, d);
    return shapka(p, true) +
      '<div class="bl"><h1>' + (usl ? "Акт выполненных работ (оказанных услуг) №" : "Акт №") + NB + v(d.nomer, usl ? "________" : "Д-20__-______") + " от" + NB + dataSlovami(d.data) + '</h1><div class="sv"><span class="s">Исполнитель</span><span>' + prodavec(p) + '</span><span class="s">Заказчик</span><span>' + storona(d) +
      '</span><span class="s">Основание</span><span>' + v(d.osn, usl ? "Договор №" + NB + "________ от" + NB + "__.__.20__" : "Счёт №" + NB + "Д-20__-______ от" + NB + "__.__.20__, оферта deloskop.ru/oferta/") + "</span></div></div>" +
      pz.html + itogi(pz.sum, "Всего", nds) +
      '<div class="bl b4"><div>Всего на' + NB + "сумму " + den(pz.sum) + " руб.</div><div><b>" + slovami(pz.sum) + "</b>. " + esc(nds) + ".</div><div>" +
      (usl ? "Работы выполнены (услуги оказаны) полностью и в" + NB + "срок. Заказчик претензий по" + NB + "объёму, качеству и срокам не" + NB + "имеет." : "Право использования предоставлено Заказчику на" + NB + "указанный период.") + "</div></div>" +
      podpisA2(p, "Исполнитель", "Заказчик", d.pok) + niz(p, true);
  }

  // Оформление листа: мм и пт — это печать; цвета и скругления — дизайн-система. Лист — бумага: тёмной темы у него нет,
  // поэтому строка начинается с пометки — сборщик тёмного слоя (tests/tema_temnaya.py) такие стили не берёт.
  var CSS = "/* лист: бумага */@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#fff}" +
    "body{font-family:Onest,Arial,sans-serif;color:#0D2247;font-size:10pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
    ".l{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff}p{margin:0 0 3mm}b{font-weight:600}em{font-style:normal}.s{color:#55555A}.r{text-align:right}.n{font-variant-numeric:tabular-nums}" +
    ".st{position:absolute;left:0;top:0;width:210mm;height:40mm;overflow:hidden}.st img{position:absolute;left:0;top:0;width:210mm;height:40mm;object-fit:cover}.st i{position:absolute;left:0;bottom:0;width:210mm;height:18mm;background:linear-gradient(180deg,rgba(255,255,255,0),#fff)}" +
    ".sh{position:relative;display:flex;align-items:center;justify-content:space-between;gap:6mm;padding:9.5mm 15mm 0}.lg{display:flex;align-items:center;gap:3mm}.lg img{width:20.6mm;height:14.8mm;object-fit:contain}.lg b{font-size:21pt;letter-spacing:-.03em;line-height:1}" +
    ".rk{display:flex;flex-direction:column;gap:.2mm;text-align:right;font-size:8.25pt;line-height:1.45;color:#55555A}.rk b{color:#0D2247}" +
    ".bl{position:relative;padding:17mm 15mm 0}.mt{display:grid;grid-template-columns:minmax(0,1fr) 77mm;gap:0 8mm;font-size:9.5pt}.mt>div{display:flex;flex-direction:column;gap:1mm}" +
    "h1{margin:0 0 3.5mm;font-size:19pt;font-weight:600;letter-spacing:-.02em;line-height:1.15}.tl{padding-top:11.5mm}.tl p.m{margin-top:1.5mm;font-size:9.5pt}" +
    ".pa{position:relative;display:grid;grid-template-columns:66mm 56mm minmax(0,1fr);align-items:end;gap:0 4mm;padding:11.5mm 15mm 0}.pa>span{padding-bottom:4.8mm}.ln{display:flex;flex-direction:column;gap:.8mm}.ln i{display:block;height:12mm;border-bottom:.26mm solid #0D2247}.ln span{font-size:7.5pt;color:#5B6783;text-align:center}" +
    ".is{position:relative;padding:6.3mm 15mm 0;font-size:8pt;color:#55555A}.pb{position:relative;display:flex;flex-direction:column;gap:.5mm;padding:13.5mm 15mm 0}.pb .ss{color:#12305F}" +
    ".sv{display:grid;grid-template-columns:25.4mm minmax(0,1fr);gap:1.6mm 3.2mm}.b3{padding-top:8mm}.b4{display:flex;flex-direction:column;gap:1.6mm;padding-top:4.8mm}" +
    ".tb{position:relative;margin:5.8mm 15mm 0;border:.26mm solid #E3DDCD;border-radius:16px;overflow:hidden;display:grid;font-size:9.5pt;background:#fff}.tb .h{padding:2.4mm 2.6mm;background:#F5F1E6;font-weight:600;border-bottom:.26mm solid #E3DDCD}.tb .c{padding:2.6mm}" +
    ".poz{grid-template-columns:10mm minmax(0,1fr) 20.6mm 12.7mm 23.8mm 26.5mm}.it{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 42mm 26.5mm;gap:1.6mm 0;padding:3.7mm 17.5mm 0 15mm;font-size:9.5pt;text-align:right}" +
    ".bk{margin-top:9mm;grid-template-columns:minmax(0,1fr) 18.5mm 58mm}.bk .c{border-bottom:.26mm solid #E3DDCD;border-right:.26mm solid #E3DDCD;padding:2.1mm 3.2mm}.bk .n{border-right:0}.bk .bn{grid-row:span 2;display:flex;flex-direction:column;gap:.5mm;padding:2.6mm 3.7mm}.bk em{font-size:8pt;color:#5B6783}" +
    ".bk .bp{grid-row:span 2;border-right:.26mm solid #E3DDCD;display:flex;flex-direction:column}.bk .bp>div:first-child{display:grid;grid-template-columns:1fr 1fr;border-bottom:.26mm solid #E3DDCD}.bk .bp>div:first-child span{padding:2.1mm 3.7mm}.bk .bp>div:first-child span:first-child{border-right:.26mm solid #E3DDCD}.bk .bp .c{border:0;display:flex;flex-direction:column;gap:.5mm;padding:2.6mm 3.7mm}.bk .b2{grid-row:span 2;border-bottom:0}" +
    ".nz{position:relative;margin:4.2mm 15mm 0;padding:3.2mm 4.2mm;border-radius:16px;background:#F5F1E6;font-size:9.5pt}" +
    ".rs{grid-template-columns:1fr 1fr}.rs .rr:first-child{border-right:.26mm solid #E3DDCD}.rr{display:grid;grid-template-columns:27.5mm minmax(0,1fr);gap:1.9mm 2.6mm;align-content:start;padding:3.7mm 4.2mm!important}.rr .w{grid-column:span 2}" +
    ".s2{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:0 10.6mm;padding:13.8mm 15mm 0}.s2>div{display:flex;flex-direction:column;gap:1mm}.s2 .pp{display:grid;grid-template-columns:45mm minmax(0,1fr);align-items:end;gap:0 3.7mm;padding-top:1.6mm}.s2 .pp>span{padding-bottom:4.8mm}.s2 em{font-size:7.5pt;color:#5B6783}" +
    ".dg{padding-top:12mm;font-size:8.5pt;line-height:1.4}.dg h1{font-size:16pt;margin-bottom:1.4mm}.dg h2{margin:2.1mm 0 1.1mm;font-size:9pt;font-weight:600}.dg p{margin:0 0 1.1mm;text-align:justify}.dg p i{font-style:normal;color:#55555A}.dm{display:flex;justify-content:space-between;gap:6mm;margin-bottom:2.2mm;color:#55555A}" +
    ".dr{margin-top:1.6mm;font-size:8.25pt}.dr .rr{gap:1mm 2.6mm;padding:2.4mm 3.7mm!important;grid-template-columns:25mm minmax(0,1fr)}.dp{padding-top:1mm}.dp .ln i{height:10mm}" +
    ".fn{position:absolute;left:15mm;right:111mm;bottom:26mm;font-size:8pt;line-height:1.5;color:#55555A}.ft{position:absolute;left:15mm;right:111mm;bottom:9mm;display:flex;justify-content:space-between;gap:4mm;padding-top:3.2mm;border-top:.26mm solid #E3DDCD;font-size:8pt;color:#5B6783}" +
    ".vz{position:absolute;right:42mm;bottom:8mm;width:64.5mm;height:35mm}.vz img{position:absolute;width:45mm;height:24.9mm;border-radius:10px}.vz img:first-child{left:1mm;top:1.6mm;box-shadow:0 2.6mm 6.3mm rgba(13,34,71,.2);transform:rotate(-7deg)}.vz img:last-child{right:1mm;bottom:1.6mm;box-shadow:0 3.7mm 8mm rgba(13,34,71,.34);transform:rotate(4deg)}" +
    ".qr{position:absolute;right:15mm;bottom:9mm;width:23mm;display:flex;flex-direction:column;align-items:center;gap:1mm}.qr div{padding:1.8mm;border-radius:10px;background:#fff;border:.26mm solid #E3DDCD}.qr img{display:block;width:19mm;height:19mm}.qr span{font-size:7pt;line-height:1.2;color:#55555A}" +
    ".fx{position:absolute;z-index:5;cursor:move;user-select:none;-webkit-user-drag:none}.stavim .l{cursor:crosshair}@media print{.fx{cursor:auto}}";

  // Целый документ для рамки предпросмотра и печати
  function dokument(vid, d, p, propis, zagolovok) {
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>' + esc(zagolovok || "Документ Делоскопа") + '</title><link rel="stylesheet" href="/css/fonts.css"><style>' + CSS + '</style></head><body><div class="l" id="l">' + list(vid, d, p, propis) + "</div></body></html>";
  }

  // ---------- раздел в админке ----------
  var CSS_ADM = ".dok{display:grid;grid-template-columns:minmax(260px,360px) minmax(0,1fr);gap:20px;align-items:start}.dok__f{display:flex;flex-direction:column;gap:10px}" +
    ".dok__f label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted)}.dok__f input,.dok__f select,.dok__f textarea{min-height:44px;border:1px solid #D8D1BE;border-radius:10px;padding:8px 12px;font:inherit;font-size:15px;color:var(--ink);background:#fff}" +
    ".dok__f textarea{min-height:120px;resize:vertical;line-height:1.45}.dok__f textarea.m{min-height:66px}.dok__f input:focus,.dok__f select:focus,.dok__f textarea:focus{outline:2px solid var(--accent);outline-offset:1px;border-color:var(--accent)}" +
    ".dok__inn{display:flex;gap:8px}.dok__inn input{flex:1 1 auto;min-width:0}.dok__kn{display:flex;flex-wrap:wrap;gap:8px}.dok__pd{border:1px solid var(--line);border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}.dok__pd b{font-size:15px}.dok__pd p{margin:0;font-size:13px;color:var(--muted)}" +
    ".dok__pd input[type=range]{min-height:28px;padding:0}.dok__pd input[type=file]{font-size:13px;padding:8px}.dok__pd label.g{flex-direction:row;align-items:center;gap:8px;font-size:15px;color:var(--ink)}.dok__pd label.g input{min-height:0;width:20px;height:20px;padding:0}" +
    ".dok__l{position:sticky;top:12px;border-radius:16px;overflow:hidden;background:#E8E8E4;border:1px solid var(--line)}.dok__l iframe{display:block;border:0;width:210mm;height:297mm;transform-origin:0 0;background:#fff}" +
    "@media (max-width:900px){.dok{grid-template-columns:1fr}.dok__l{position:relative;top:0}}";

  function start(call, isAdmin) {
    var sek = document.getElementById("dokSek"), box = document.getElementById("dokBox");
    if (!sek || !box) return;
    var st = document.createElement("style"); st.textContent = CSS_ADM; document.head.appendChild(st);
    var S = window.DeloskopSchet && window.DeloskopSchet.api, propis = S && S.propis ? function (n) { try { return S.propis(n); } catch (e) { return ""; } } : null;
    var P = {}, vid = VIDY[0][0], D = {}, fx = null, ruchnaya = false, stavim = false, svoj = false, tmr = 0;
    box.innerHTML = '<div class="dok"><div class="dok__f"><label>Документ<select id="dokVid">' + VIDY.map(function (x) { return '<option value="' + x[0] + '">' + esc(x[1]) + "</option>"; }).join("") + '</select></label><div id="dokPolya" class="dok__f"></div>' +
      '<div class="dok__kn"><button class="btn primary" type="button" id="dokPdf">Сохранить PDF или распечатать</button><button class="btn" type="button" id="dokChisto">Чистый бланк</button></div>' +
      '<div class="dok__pd"><b>Подпись-росчерк</b><p id="dokPdT"></p><input type="file" id="dokFajl" accept="image/png,image/webp" aria-label="Файл росчерка с компьютера">' +
      '<label class="g"><input type="checkbox" id="dokAvto" checked>Ставить подпись на строку сразу</label>' +
      '<div class="dok__kn"><button class="btn" type="button" id="dokStav">Указать место на листе</button><button class="btn" type="button" id="dokUbr">Убрать с листа</button><button class="btn" type="button" id="dokZab">Забыть росчерк</button></div>' +
      '<label>Размер подписи<input type="range" id="dokRaz" min="18" max="70" value="34" aria-label="Ширина подписи, мм"></label></div>' +
      '<p class="note" id="dokNote" role="status" aria-live="polite"></p></div><div class="dok__l" id="dokL"><iframe id="dokFr" title="Лист документа"></iframe></div></div>';
    var $ = function (id) { return document.getElementById(id); }, fr = $("dokFr"), L = $("dokL");
    function note(t, c) { var n = $("dokNote"); n.className = "note" + (c ? " " + c : ""); n.textContent = t || ""; }
    function roscherk() { try { return localStorage.getItem(KLYUCH) || ""; } catch (e) { return ""; } }
    function okr(x) { return Math.round(x * 10) / 10; }
    function masshtab() { var w = fr.offsetWidth || 794, k = L.clientWidth / w; fr.style.transform = "scale(" + k + ")"; L.style.height = Math.round((fr.offsetHeight || 1123) * k) + "px"; }
    function podskazka() {
      var est = !!roscherk(), nado = vid !== "pismo";
      $("dokPdT").textContent = !nado ? "Письмо от команды подписано «Команда Делоскопа» — росчерк не нужен."
        : est ? "Росчерк сохранён в этом браузере. " + ROSCHERK[vid]
          : "Выберите файл росчерка с компьютера (PNG с прозрачным фоном). Он останется только в этом браузере — на сервер не отправляется.";
      $("dokStav").disabled = !est; $("dokUbr").disabled = !fx; $("dokZab").disabled = !est; $("dokFajl").hidden = est; $("dokRaz").disabled = !fx; $("dokAvto").disabled = !est || !nado;
    }
    function polya() {
      $("dokPolya").innerHTML = POLYA[vid].filter(function (f) { return pokazat(f, D); }).map(function (f) {
        var id = "dok_" + f[0], val = esc(D[f[0]] || ""), inp;
        if (f[2] === "area" || f[2] === "area2") inp = '<textarea data-k="' + f[0] + '" id="' + id + '"' + (f[2] === "area2" ? ' class="m"' : "") + ">" + val + "</textarea>";
        else if (f[2] === "sel") inp = '<select data-k="' + f[0] + '" id="' + id + '">' + VYBOR[f[0]].map(function (o) { return '<option value="' + o[0] + '"' + (D[f[0]] === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
        else inp = '<input data-k="' + f[0] + '" id="' + id + '" type="' + (f[2] === "date" ? "date" : "text") + '"' + (f[2] === "num" || f[2] === "inn" ? ' inputmode="decimal"' : "") + ' autocomplete="off" value="' + val + '">';
        if (f[2] === "inn") inp = '<span class="dok__inn">' + inp + '<button class="btn" type="button" id="dokInn">Заполнить по ИНН</button></span>';
        return "<label>" + esc(f[1]) + inp + "</label>";
      }).join("");
    }
    // росчерк на нашей строке: середина по ширине, нижняя треть заходит за линию; выше 22 мм сам не встаёт — не закрывает текст
    function posadit(im) {
      if (!fx || !fx.avto || !im || !im.naturalWidth) return;
      var k = im.naturalHeight / im.naturalWidth;
      if (!svoj && fx.w * k > 22) { fx.w = okr(22 / k); im.style.width = fx.w + "mm"; }
      fx.x = okr(fx.cx - fx.w / 2); fx.y = okr(fx.niz - fx.w * k * 0.62);
      im.style.left = fx.x + "mm"; im.style.top = fx.y + "mm";
    }
    function vstavitFx(doc) {
      if (!fx) return;
      var im = doc.createElement("img"); im.className = "fx"; im.alt = "Подпись"; im.draggable = false;
      im.style.width = fx.w + "mm"; im.style.left = fx.x + "mm"; im.style.top = fx.y + "mm"; im.onload = function () { posadit(im); };
      im.src = roscherk(); doc.getElementById("l").appendChild(im);
    }
    function risovat() {
      var zag = VIDY.filter(function (x) { return x[0] === vid; })[0][1] + (D.nomer ? " № " + D.nomer : "");
      fr.srcdoc = dokument(vid, D, P, propis, zag);
    }
    function pozzhe() { clearTimeout(tmr); tmr = setTimeout(risovat, 180); }
    function poInn() {
      var inn = String(D.pinn || "").replace(/\D/g, "");
      if (!/^(\d{10}|\d{12})$/.test(inn)) { note("ИНН организации — 10 цифр, ИП — 12.", "err"); return; }
      var kn = $("dokInn"); if (kn) kn.disabled = true; note("Ищем в реестре…");
      function primenit(o, hvost) {
        ["pok", "pinn", "pkpp", "pogrn", "padres", "pruk"].forEach(function (k) { if (o[k]) D[k] = o[k]; });
        if (!D.posn && !eIP(inn)) D.posn = "Устава";
        polya(); risovat(); note("Заполнено по ИНН " + inn + ". Сверьте название и того, кто подписывает." + hvost, "ok");
      }
      call("/api/check?q=" + encodeURIComponent(inn)).then(function (j) {
        var o = izProverki(j); if (!o) throw new Error("нет данных");
        primenit(o, typeof j.verdict === "string" && j.verdict ? " Вывод проверки: " + j.verdict.slice(0, 160) : "");
      }).catch(function () {
        return call("/api/suggest?q=" + encodeURIComponent(inn)).then(function (j) { var o = izProverki(j); if (!o) throw new Error("нет данных"); primenit(o, " КПП и подписанта внесите вручную."); });
      }).catch(function () { note("По ИНН " + inn + " ничего не нашлось — заполните поля вручную.", "err"); if ($("dokInn")) $("dokInn").disabled = false; });
    }
    fr.addEventListener("load", function () {
      var doc = fr.contentDocument; if (!doc || !doc.getElementById("l")) return;
      var l = doc.getElementById("l"), MM = 96 / 25.4, tyanem = null, nasha = l.querySelector(".ln[data-nasha] i");
      doc.body.classList.toggle("stavim", stavim);
      if (!ruchnaya) {
        fx = null;
        if (nasha && $("dokAvto").checked && roscherk()) {
          var b0 = l.getBoundingClientRect(), b1 = nasha.getBoundingClientRect(), w0 = +$("dokRaz").value;
          fx = { w: w0, avto: true, cx: (b1.left - b0.left + b1.width / 2) / MM, niz: (b1.bottom - b0.top) / MM, x: 0, y: 0 };
          fx.x = okr(fx.cx - w0 / 2); fx.y = okr(fx.niz - w0 * 0.6);
        }
      }
      vstavitFx(doc); masshtab(); podskazka();
      if (l.scrollHeight > l.clientHeight + 2 || (function () { var x = l.querySelector(".s2,.pa,.pb"), y = l.querySelector(".vz"); return x && y && x.getBoundingClientRect().bottom > y.getBoundingClientRect().top - 4; })()) note("Текст не помещается на один лист — сократите его.", "err");
      l.addEventListener("click", function (e) {
        if (!stavim || !roscherk()) return;
        var b = l.getBoundingClientRect(), w = +$("dokRaz").value;
        fx = { w: w, x: okr((e.clientX - b.left) / MM - w / 2), y: okr((e.clientY - b.top) / MM - w * 0.36) };
        stavim = false; ruchnaya = true; note("Подпись поставлена. Её можно перетащить мышью и изменить размер ползунком.", "ok"); risovat();
      });
      l.addEventListener("pointerdown", function (e) { if (e.target.className === "fx" && fx) { tyanem = { x: e.clientX, y: e.clientY, fx: fx.x, fy: fx.y }; ruchnaya = true; fx.avto = false; e.target.setPointerCapture(e.pointerId); e.preventDefault(); } });
      l.addEventListener("pointermove", function (e) { if (!tyanem || !fx) return; fx.x = okr(tyanem.fx + (e.clientX - tyanem.x) / MM); fx.y = okr(tyanem.fy + (e.clientY - tyanem.y) / MM); var im = l.querySelector(".fx"); if (im) { im.style.left = fx.x + "mm"; im.style.top = fx.y + "mm"; } });
      l.addEventListener("pointerup", function () { tyanem = null; });
    });
    function sbros() { fx = null; ruchnaya = false; stavim = false; svoj = false; }
    $("dokVid").onchange = function () { vid = this.value; sbros(); note(""); polya(); risovat(); };
    $("dokPolya").addEventListener("input", function (e) { var k = e.target.getAttribute("data-k"); if (!k) return; D[k] = e.target.value; note(""); if (k === "predmet") { polya(); risovat(); } else pozzhe(); });
    $("dokPolya").addEventListener("click", function (e) { if (e.target.id === "dokInn") poInn(); });
    $("dokPolya").addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.getAttribute("data-k") === "pinn") { e.preventDefault(); poInn(); } });
    $("dokChisto").onclick = function () { D = {}; sbros(); note(""); polya(); risovat(); };
    $("dokPdf").onclick = function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); note("В окне печати выберите «Сохранить как PDF» или принтер; поля — «Нет», фон — включён.", ""); } catch (e) { note("Печать не открылась: " + e.message, "err"); } };
    $("dokStav").onclick = function () { stavim = true; if (fr.contentDocument) fr.contentDocument.body.classList.add("stavim"); note("Щёлкните по листу там, где должна стоять подпись."); };
    $("dokUbr").onclick = function () { sbros(); $("dokAvto").checked = false; note("Подпись убрана с листа."); risovat(); };
    $("dokAvto").onchange = function () { ruchnaya = false; risovat(); };
    $("dokZab").onclick = function () { try { localStorage.removeItem(KLYUCH); } catch (e) {} sbros(); $("dokFajl").value = ""; note("Росчерк удалён из этого браузера."); risovat(); };
    $("dokRaz").oninput = function () { if (!fx) return; svoj = true; fx.w = +this.value; var im = fr.contentDocument && fr.contentDocument.querySelector(".fx"); if (im) { im.style.width = fx.w + "mm"; posadit(im); } };
    $("dokFajl").onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      if (!/^image\/(png|webp)$/.test(f.type) || f.size > 600000) { note("Нужен файл PNG или WebP не больше 600 КБ.", "err"); this.value = ""; return; }
      var rd = new FileReader();
      rd.onload = function () { try { localStorage.setItem(KLYUCH, String(rd.result)); note("Росчерк сохранён в этом браузере.", "ok"); } catch (e) { note("Не удалось сохранить росчерк: " + e.message, "err"); } risovat(); };
      rd.readAsDataURL(f);
    };
    window.addEventListener("resize", masshtab);
    sek.hidden = false; polya(); podskazka(); risovat();
    // реквизиты продавца — с сервера; нет ответа — в листе остаются прочерки
    call("/api/admin/rekvizity").then(function (j) { P = (j && j.prodavec) || {}; risovat(); }).catch(function () { note("Реквизиты с сервера не пришли — в листе прочерки. Заполните «Реквизиты для счетов» выше.", ""); });
  }

  return { start: start, list: list, dokument: dokument, den: den, esc: esc, dataSlovami: dataSlovami, fioKorotko: fioKorotko, izProverki: izProverki, storona: storona, ROSCHERK: ROSCHERK, VIDY: VIDY, POLYA: POLYA, KLYUCH: KLYUCH };
});
