/* Делоскоп — подпись-источник при копировании текста (kopiya-v1, решение владельца 01.10.2026).
   Человек копирует со страницы длинный кусок статьи, разбора или карточки → в буфер, кроме самого текста,
   ложится строка «Источник: <адрес страницы> — Делоскоп, deloskop.ru · делоскоп.рф» (и в HTML — две ссылки).
   Копирование НЕ мешаем: ничего не блокируем, выделение не трогаем, только добавляем подпись.
   Без подписи: меньше MIN знаков; поля ввода и формы; кабинет, админка, счёт и акт;
   готовые документы человека (договор Делописи, письмо Скорой); блоки .no-src / [data-no-src];
   кнопки «Копировать» ([data-copy], [data-copy2]); реквизиты (ИНН, КПП, БИК, р/с — их копируют, чтобы платить).
   Адрес — из <link rel="canonical"> (без ?inn= и меток), иначе адрес страницы без запроса и якоря.
   Подключает tests/sobrat_shapku.py на всех страницах (<head>, defer). Чистые функции — для tests/kopiya.test.js. */
(function (koren) {
  "use strict";
  var MIN = 120;
  var DOMEN_RF = "делоскоп.рф";
  var URL_RF = "https://делоскоп.рф";
  // кабинет, админка, счёт и акт (/schet/…) — служебное и платёжное, подпись там не нужна
  var ISKL_PUTI = /^\/(cabinet|admin|schet)(\.html)?(\/|$)/;
  // Готовые документы человека — договор Делописи (#dp-doc, #dp-out) и письмо в банк Скорой (.letter):
  // их вставляют в свой договор или письмо, чужая строка там лишняя
  var ISKL_BLOKI = "input, textarea, select, [contenteditable=''], [contenteditable='true'], form, .no-src, [data-no-src], " +
    "[data-copy], [data-copy2], button, #dp-doc, #dp-out, .letter";

  function dlina(t) { return String(t || "").replace(/\s+/g, " ").trim().length; }

  // Реквизиты: два и больше признаков — это платёжные данные, а не текст статьи
  function rekvizity(t) {
    var s = String(t || ""), n = 0;
    if (/ИНН\s*:?\s*\d{10,12}/i.test(s)) n++;
    if (/КПП\s*:?\s*\d{9}/i.test(s)) n++;
    if (/БИК\s*:?\s*\d{9}/i.test(s)) n++;
    if (/ОГРН(ИП)?\s*:?\s*\d{13,15}/i.test(s)) n++;
    if (/(р\/с|расч[её]тный сч[её]т|к\/с|корр?\.?\s*сч[её]т)[^\d]{0,20}\d{20}/i.test(s) || /\b\d{20}\b/.test(s)) n++;
    return n >= 2;
  }

  // kontekst: { put, vIsklyuchenii }  → true, если подпись нужна
  function nuzhnaPodpis(tekst, kontekst) {
    var k = kontekst || {};
    if (k.put && ISKL_PUTI.test(k.put)) return false;
    if (k.vIsklyuchenii) return false;
    if (dlina(tekst) < MIN) return false;
    if (rekvizity(tekst)) return false;
    return true;
  }

  function ekran(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function adres(kanon, href) {
    var u = kanon || href || "https://deloskop.ru/";
    return String(u).replace(/[?#].*$/, "");
  }

  function podpis(url) {
    var u = adres(url);
    return {
      text: "\n\nИсточник: " + u + " — Делоскоп, deloskop.ru · " + DOMEN_RF,
      html: '<p>Источник: <a href="' + ekran(u) + '">deloskop.ru</a> · <a href="' + URL_RF + '">' + DOMEN_RF + "</a></p>"
    };
  }

  function sobrat(tekst, htmlKusok, url) {
    var p = podpis(url);
    var h = htmlKusok != null && htmlKusok !== "" ? htmlKusok : ekran(tekst).replace(/\n/g, "<br>");
    return { text: String(tekst) + p.text, html: "<div>" + h + "</div>" + p.html };
  }

  var api = { MIN: MIN, nuzhnaPodpis: nuzhnaPodpis, rekvizity: rekvizity, podpis: podpis, sobrat: sobrat, adres: adres, ISKL_BLOKI: ISKL_BLOKI };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }
  koren.dlkKopiya = api;

  // ——— браузер ———
  function blizhajshij(uzel, sel) {
    var el = uzel && (uzel.nodeType === 1 ? uzel : uzel.parentElement);
    return !!(el && el.closest && el.closest(sel));
  }
  function naCopy(e) {
    try {
      if (e.defaultPrevented || !e.clipboardData) return;
      var vyd = window.getSelection && window.getSelection();
      if (!vyd || vyd.isCollapsed || !vyd.rangeCount) return;
      // выделение в поле ввода (фокус) или начало/конец выделения внутри исключённого блока.
      // Кнопку в фокусе (нажали «Собрать договор», потом выделили статью) не считаем — смотрим само выделение
      var akt = document.activeElement;
      var vIskl = !!(akt && /^(INPUT|TEXTAREA|SELECT)$/.test(akt.tagName)) || !!(akt && akt.isContentEditable) ||
        blizhajshij(vyd.anchorNode, ISKL_BLOKI) || blizhajshij(vyd.focusNode, ISKL_BLOKI);
      var tekst = vyd.toString();
      if (!nuzhnaPodpis(tekst, { put: location.pathname, vIsklyuchenii: vIskl })) return;
      var div = document.createElement("div");
      for (var i = 0; i < vyd.rangeCount; i++) div.appendChild(vyd.getRangeAt(i).cloneContents());
      // ссылки внутри кусков — полными адресами: «/nalogi/» в чужом письме никуда не ведёт
      var ss = div.querySelectorAll ? div.querySelectorAll("a[href]") : [];
      for (var j = 0; j < ss.length; j++) { try { ss[j].setAttribute("href", new URL(ss[j].getAttribute("href"), location.href).href); } catch (_) {} }
      var kan = document.querySelector('link[rel="canonical"]');
      var itog = sobrat(tekst, div.innerHTML, adres(kan && kan.href, location.origin + location.pathname));
      e.clipboardData.setData("text/plain", itog.text);
      e.clipboardData.setData("text/html", itog.html);
      e.preventDefault(); // иначе браузер перезапишет буфер исходным выделением — само копирование уже сделано выше
    } catch (_) { /* что-то пошло не так — браузер скопирует как обычно */ }
  }
  document.addEventListener("copy", naCopy);
})(this);
