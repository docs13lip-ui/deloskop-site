/* Делоскоп — «Следить за компанией» прямо в отчёте: почта, согласие, письмо со ссылкой (sledit-v1, 13.11.2026).
 *
 * Зачем: слежение — причина вернуться. Главная кнопка отчёта ведёт в кабинет (вход, потом список) — человек,
 * которому важно знать про новый иск у поставщика, до списка не доходит. Здесь — две строки прямо под кнопкой:
 * адрес почты и галочка согласия; сервер шлёт письмо со ссылкой, слежение включается, когда её откроют.
 * Без регистрации и пароля.
 *
 * Два ключа, оба нужны: SLEDIT = true (здесь, после текста согласия от юриста и строки в /politika/)
 * и tarify/tarify.json → slezhenie_pisma: true (сервер правда шлёт письма; тот же ключ, что у js/slezh-knopka.js).
 * Пока хоть один выключен — модуль ничего не делает: кнопка ведёт в кабинет, как раньше (ИНН уже вписан).
 *
 * Правила: только организации (ИНН из 10 цифр) и не «своя компания» (у Щита свой путь);
 * адрес почты уходит только на /api/slezhenie/zayavka — не в Метрику, не в хранилище браузера, не в адрес страницы;
 * нажатие считает прежний счётчик (deystvie_slezhenie по data-cel="otchet_sled", js/schetchik.js) — новых событий нет.
 * Чистые функции — для автотестов (node): tests/sledit.test.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.DlkSledit = api;
    if (root.document) api.zapusk(root.document, root.fetch && root.fetch.bind(root));
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SLEDIT = false;
  var ADRES = '/api/slezhenie/zayavka';
  var NB = ' ';
  // Текст согласия — черновик до ответа юриста по 152-ФЗ; при включении заменить дословно.
  var SOGLASIE = 'Согласен на обработку адреса почты, чтобы получать письма об изменениях по этой компании.';

  // ИНН организации из адреса кнопки: /cabinet.html?inn=7707083893#watch → '7707083893'; ИП и прочее — ''
  function innIzSsylki(href) {
    var m = /[?&]inn=(\d+)(?:[&#]|$)/.exec(String(href || ''));
    return m && m[1].length === 10 ? m[1] : '';
  }

  // Адрес почты: одно «@», точка в домене, без пробелов, не длиннее 254 знаков. Строже не надо — проверит письмо.
  function pochtaOk(s) {
    var v = String(s == null ? '' : s).trim();
    return v.length >= 6 && v.length <= 254 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>".]{2,}$/.test(v);
  }

  // Что не так с вводом → текст под полем; всё верно → ''
  function oshibka(pochta, soglasen) {
    var v = String(pochta == null ? '' : pochta).trim();
    if (!v) return 'Впишите адрес почты' + NB + '— на него придёт письмо со ссылкой.';
    if (!pochtaOk(v)) return 'Проверьте адрес: нужен вид имя@почта.ru.';
    if (!soglasen) return 'Отметьте согласие' + NB + '— без него письма слать нельзя.';
    return '';
  }

  // Тело запроса серверу: ровно три поля, ничего лишнего (ни названия, ни адреса страницы, ни времени).
  function telo(inn, pochta) {
    return { inn: String(inn), email: String(pochta).trim(), soglasie: true };
  }

  // Ответ сервера → { ok, t } — что сказать человеку. Адрес почты в тексте — как он его ввёл (экранирует htmlForma/DOM).
  function itog(status, pochta) {
    if (status >= 200 && status < 300) return { ok: true, t: 'Письмо отправлено на ' + String(pochta).trim() + '. Откройте ссылку из него' + NB + '— и слежение включится. Письма нет за 10 минут' + NB + '— загляните в «Спам».' };
    if (status === 429) return { ok: false, t: 'Слишком много заявок с этого устройства. Попробуйте через час.' };
    if (status === 400 || status === 422) return { ok: false, t: 'Сервер не принял адрес. Проверьте его и отправьте ещё раз.' };
    return { ok: false, t: 'Не получилось отправить. Попробуйте ещё раз через минуту или следите из кабинета.', kabinet: true };
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // Разметка формы. id уникальны на странице: форма может появиться и в отчёте, и в окне «Что делать завтра утром».
  var schet = 0;
  function htmlForma(inn) {
    var n = ++schet, p = 'sl' + n;
    return '<form class="sl-f" novalidate data-sl-inn="' + esc(inn) + '" aria-label="Следить за компанией">' +
      '<label class="sl-l" for="' + p + 'e">Почта для писем об изменениях</label>' +
      '<input class="sl-i" id="' + p + 'e" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" maxlength="254" placeholder="имя@почта.ru" required>' +
      '<label class="sl-s"><input type="checkbox" id="' + p + 's"> <span>' + esc(SOGLASIE) + ' <a href="/soglasie/" target="_blank" rel="noopener">Текст согласия</a></span></label>' +
      '<button class="ot-btn p sl-b" type="submit">Следить</button>' +
      '<p class="sl-p">На этот адрес придёт письмо со ссылкой; слежение включится, когда вы её откроете. Без регистрации. В письмах' + NB + '— изменения в реестрах: иск, долг у приставов, сообщение о банкротстве, смена руководителя или статуса. Отписка' + NB + '— в каждом письме.</p>' +
      '<p class="sl-o" role="status" aria-live="polite"></p>' +
      '</form>';
  }

  // Нажатие на «Следить за компанией» → показать форму под кнопкой (или перевести фокус в уже открытую). → форма | null
  function otkryt(doc, a) {
    var inn = innIzSsylki(a.getAttribute('href'));
    if (!inn) return null;
    var f = a.nextElementSibling && a.nextElementSibling.classList.contains('sl-f') ? a.nextElementSibling : null;
    if (!f) {
      var t = doc.createElement('div');
      t.innerHTML = htmlForma(inn);
      f = t.firstChild;
      a.parentNode.insertBefore(f, a.nextSibling);
    }
    a.setAttribute('aria-expanded', 'true');
    var i = f.querySelector('.sl-i');
    if (i && i.focus) i.focus();
    return f;
  }

  // Отправка: проверка в браузере → POST → текст в строке статуса. Кнопка заблокирована, пока ждём ответа.
  function otpravit(f, fetchFn) {
    var i = f.querySelector('.sl-i'), s = f.querySelector('input[type=checkbox]'), o = f.querySelector('.sl-o'), b = f.querySelector('.sl-b');
    var inn = f.getAttribute('data-sl-inn') || '';
    var e = oshibka(i.value, s.checked);
    o.className = 'sl-o';
    if (e || !/^\d{10}$/.test(inn)) { o.textContent = e || 'Следить можно только за организацией.'; o.className = 'sl-o sl-o--err'; if (e && !pochtaOk(i.value)) i.focus(); return Promise.resolve(null); }
    if (!fetchFn) return Promise.resolve(null);
    b.disabled = true;
    o.textContent = 'Отправляем…';
    var pochta = i.value;
    return fetchFn(ADRES, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(telo(inn, pochta)) })
      .then(function (r) { return r ? r.status : 0; }, function () { return 0; })
      .then(function (st) {
        var it = itog(st, pochta);
        o.textContent = it.t;
        o.className = 'sl-o ' + (it.ok ? 'sl-o--ok' : 'sl-o--err');
        if (it.kabinet) {
          var k = f.ownerDocument.createElement('a');
          k.href = '/cabinet.html?inn=' + inn + '#watch';
          k.textContent = ' Открыть кабинет →';
          o.appendChild(k);
        }
        if (it.ok) { i.disabled = true; s.disabled = true; b.hidden = true; var p = f.querySelector('.sl-p'); if (p) p.hidden = true; } else b.disabled = false;
        return it;
      });
  }

  // Один слушатель на документ: клик по главной кнопке отчёта (и её копии в окне липкой строки) и отправка формы.
  function slushat(doc, fetchFn, vkl) {
    if (!(vkl === undefined ? SLEDIT : vkl) || !doc || !doc.addEventListener) return false;
    doc.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a[data-cel="otchet_sled"]') : null;
      if (!a || ev.defaultPrevented || ev.button > 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
      if (otkryt(doc, a)) ev.preventDefault();
    });
    doc.addEventListener('submit', function (ev) {
      var f = ev.target;
      if (!f || !f.classList || !f.classList.contains('sl-f')) return;
      ev.preventDefault();
      otpravit(f, fetchFn);
    });
    return true;
  }

  // Включить, только если оба ключа включены: SLEDIT и slezhenie_pisma === true в tarify.json (нет файла, ошибка — нет).
  function zapusk(doc, fetchFn, vkl) {
    if (!(vkl === undefined ? SLEDIT : vkl) || !fetchFn) return Promise.resolve(false);
    return fetchFn('/tarify/tarify.json', { credentials: 'same-origin' })
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (t) { return !!(t && t.slezhenie_pisma === true) && slushat(doc, fetchFn, true); })
      .catch(function () { return false; });
  }

  return { SLEDIT: SLEDIT, zapusk: zapusk, ADRES: ADRES, SOGLASIE: SOGLASIE, innIzSsylki: innIzSsylki, pochtaOk: pochtaOk, oshibka: oshibka,
    telo: telo, itog: itog, htmlForma: htmlForma, otkryt: otkryt, otpravit: otpravit, slushat: slushat };
});
