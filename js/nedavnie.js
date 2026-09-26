/* Делоскоп — «Недавние проверки» на этом устройстве.
   Хранится только в браузере человека (localStorage), на сервер не уходит.
   Нет доступа к хранилищу (приватный режим, запрет cookies) — список просто пустой. */
(function (w) {
  'use strict';
  var KEY = 'dlk_nedavnie', MAX = 5;
  var LVL = { low: 'Низкий риск', medium: 'Средний риск', high: 'Высокий риск' };

  function read() {
    try {
      var a = JSON.parse(w.localStorage.getItem(KEY) || '[]');
      return Array.isArray(a) ? a.filter(function (x) { return x && /^\d{10}(\d{2})?$/.test(x.inn); }) : [];
    } catch (e) { return []; }
  }
  function write(a) { try { w.localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }

  function add(r) {
    if (!r || !/^\d{10}(\d{2})?$/.test(String(r.inn || '')) || /^0+$/.test(r.inn)) return;
    var item = {
      inn: String(r.inn),
      name: String(r.name || '').slice(0, 160),
      level: LVL[r.level] ? r.level : '',
      id: /^[A-Za-z0-9_-]{8,24}$/.test(r.id || '') ? r.id : '',
      t: Date.now()
    };
    var a = read().filter(function (x) { return x.inn !== item.inn; });
    a.unshift(item);
    write(a.slice(0, MAX));
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function when(t) {
    try { return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); } catch (e) { return ''; }
  }

  /* Рисует список в el. Пустой список — el скрывается. Возвращает число записей. */
  function render(el) {
    if (!el) return 0;
    var a = read();
    if (!a.length) { el.hidden = true; el.innerHTML = ''; return 0; }
    el.hidden = false;
    el.innerHTML = '<h2 class="ned__h">Недавние проверки на этом устройстве</h2><ul class="ned__list">' +
      a.map(function (x) {
        var href = x.id ? '/report.html?id=' + encodeURIComponent(x.id) : '/?inn=' + encodeURIComponent(x.inn);
        return '<li><a href="' + href + '"><b>' + esc(x.name || ('ИНН ' + x.inn)) + '</b>' +
          '<span>ИНН ' + esc(x.inn) + (x.t ? ' · ' + esc(when(x.t)) : '') + '</span></a>' +
          (x.level ? '<i class="ned__lvl ned__lvl--' + x.level + '">' + LVL[x.level] + '</i>' : '') + '</li>';
      }).join('') + '</ul><button type="button" class="ned__clear">Очистить список</button>';
    el.querySelector('.ned__clear').onclick = function () { write([]); render(el); };
    return a.length;
  }

  w.Nedavnie = { add: add, list: read, render: render, KEY: KEY };
})(window);
