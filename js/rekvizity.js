/* Реквизиты продавца на /rekvizity/, /oferta/, /politika/ — сразу из админки (rekv-v1, 28.09.2026).
 *
 * Решение владельца 28.09: показываем ФИО, ИНН, ОГРНИП, дату и инспекцию регистрации ИП и адрес для писем
 * (ст. 9 ЗоЗПП). Реквизиты владелец вводит только в админку «Реквизиты для счетов» — не в чат и не в файлы.
 *
 * Как это работает:
 *   1) сборщик (tests/sobrat_shapku.py), пока rekvizity.json пуст, ставит на эти страницы заглушку
 *      [data-rekv="tablica"] / [data-rekv="ispolnitel"] и подключает этот файл;
 *   2) скрипт спрашивает GET https://api.deloskop.ru/api/rekvizity — сервер отдаёт только разрешённые поля
 *      и только когда владелец отметил «Показывать на сайте», а ИНН и ОГРНИП сошлись по контрольным цифрам;
 *   3) при следующей выкладке tests/rekvizity_iz_api.py записывает те же данные в rekvizity.json —
 *      и реквизиты становятся обычным текстом страницы (подвал тоже), скрипт на страницах больше не нужен.
 * Не ответил сервер или реквизитов ещё нет — остаётся честная строка «появятся после регистрации».
 * Расчётные счета, телефоны, личная почта сюда не попадают никогда (сервер их не отдаёт, скрипт не выводит).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DlkRekvizity = api;
  if (typeof document !== 'undefined' && typeof fetch !== 'undefined') api.zapustit(document);
})(typeof self !== 'undefined' ? self : this, function () {
  var NDS = 'Без НДС — УСН, освобождение по п.\u00a01 ст.\u00a0145 НК\u00a0РФ';
  var POLYA = ['fio', 'inn', 'ogrnip', 'data_registracii', 'organ_registracii', 'adres_dlya_pisem', 'email'];

  // Сервер уже проверил; здесь — вторая защита: без целого набора ничего не показываем.
  function godny(r) {
    return !!(r && r.est === true && typeof r.fio === 'string' && r.fio.trim().split(/\s+/).length >= 2 &&
      /^\d{12}$/.test(r.inn || '') && /^\d{15}$/.test(r.ogrnip || ''));
  }

  function stroki(r) {
    if (!godny(r)) return null;
    var s = [['Продавец', 'Индивидуальный предприниматель ' + r.fio.trim()], ['ИНН', r.inn], ['ОГРНИП', r.ogrnip]];
    var reg = [r.data_registracii, r.organ_registracii].filter(Boolean).join(', ');
    if (reg) s.push(['Регистрация', reg]);
    if (r.adres_dlya_pisem) s.push(['Адрес для писем и претензий', r.adres_dlya_pisem]);
    var email = /@deloskop\.ru$/i.test(r.email || '') ? r.email : 'help@deloskop.ru';
    s.push(['Электронная почта', { email: email }]);
    s.push(['НДС', NDS]);
    return s;
  }

  function ispolnitel(r) {
    return godny(r) ? 'индивидуальный предприниматель ' + r.fio.trim() + ' (ОГРНИП ' + r.ogrnip + ', ИНН ' + r.inn + ')' : null;
  }

  // Только textContent и createElement — никакой вставки HTML из ответа сервера.
  function tablica(doc, s) {
    var wrap = doc.createElement('div'); wrap.className = 'table-wrap';
    var t = doc.createElement('table'); t.className = 'table';
    var tb = doc.createElement('tbody');
    s.forEach(function (row) {
      var tr = doc.createElement('tr'), a = doc.createElement('td'), b = doc.createElement('td');
      a.textContent = row[0];
      if (row[1] && row[1].email) {
        var l = doc.createElement('a'); l.href = 'mailto:' + row[1].email; l.textContent = row[1].email; b.appendChild(l);
      } else b.textContent = row[1];
      tr.appendChild(a); tr.appendChild(b); tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t);
    return wrap;
  }

  function primenit(doc, r) {
    var s = stroki(r);
    if (!s) return 0;
    var n = 0;
    [].forEach.call(doc.querySelectorAll('[data-rekv="tablica"]'), function (el) {
      el.parentNode.replaceChild(tablica(doc, s), el); n++;
    });
    var isp = ispolnitel(r);
    [].forEach.call(doc.querySelectorAll('[data-rekv="ispolnitel"]'), function (el) { el.textContent = isp; n++; });
    return n;
  }

  function zapustit(doc) {
    if (!doc.querySelector('[data-rekv]')) return;
    // beta-v1: в открытой бете реквизиты ИП на сайт не выводим (решение владельца 29.09.2026)
    var rezhim = doc.querySelector('meta[name="deloskop-rezhim"]');
    if (rezhim && rezhim.getAttribute('content') === 'beta') return;
    var host = (typeof location !== 'undefined' && location.hostname) || '';
    var API = /(^|\.)deloskop\.ru$/.test(host) ? 'https://api.deloskop.ru' : '';
    if (!API && typeof location !== 'undefined' && location.protocol === 'file:') return;
    fetch(API + '/api/rekvizity', { headers: { Accept: 'application/json' } })
      .then(function (x) { return x.ok ? x.json() : null; })
      .then(function (r) { primenit(doc, r); })
      .catch(function () { /* нет ответа — остаётся «появятся после регистрации» */ });
  }

  return { godny: godny, stroki: stroki, ispolnitel: ispolnitel, primenit: primenit, zapustit: zapustit, POLYA: POLYA };
});
