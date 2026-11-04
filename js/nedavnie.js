/* Делоскоп — «Недавние проверки» на этом устройстве.
   Хранится только в браузере человека (localStorage), на сервер не уходит.
   Нет доступа к хранилищу (приватный режим, запрет cookies) — список просто пустой.
   pamyat-proverok-v1: пока включён счёт событий (js/schetchik.js, VKL), рядом лежит память dlk_pamyat —
   какие организации (только ИНН ЮЛ) и в какой день проверяли на этом устройстве, до 200 записей, 60 дней.
   Она только отличает первую проверку от повторной; сервер получает лишь вид события. */
(function (w) {
  'use strict';
  var KEY = 'dlk_nedavnie', MAX = 5;
  var LVL = { low: 'Без серьёзных сигналов', medium: 'Есть вопросы', high: 'Есть серьёзные сигналы' };

  function read() {
    try {
      var a = JSON.parse(w.localStorage.getItem(KEY) || '[]');
      return Array.isArray(a) ? a.filter(function (x) { return x && /^\d{10}(\d{2})?$/.test(x.inn); }) : [];
    } catch (e) { return []; }
  }
  function write(a) { try { w.localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }

  // pamyat-proverok-v1 (п. 460): знаменатель для M2 и возвраты R.
  // Раньше повтор искали в «Недавних» (5 компаний) — бухгалтер с 20 контрагентами выпадал из замера целиком.
  // Память: { d: { 'ИНН ЮЛ': номер дня }, vz: день последнего «возврата» }. День, а не время: точнее не нужно.
  var PAMYAT = 'dlk_pamyat', PAMYAT_MAX = 200, PAMYAT_DNEJ = 60, DEN = 864e5;
  function denIz(t) { return Math.floor(Number(t) / DEN); }
  function pamyatChist(p, den) {
    var o = { d: {}, vz: 0 }, src = p && typeof p === 'object' && p.d && typeof p.d === 'object' ? p.d : {}, a = [];
    if (p && typeof p.vz === 'number' && p.vz <= den) o.vz = p.vz;
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k) || !/^\d{10}$/.test(k)) continue;
      var v = src[k];
      if (typeof v === 'number' && v === Math.floor(v) && den - v >= 0 && den - v <= PAMYAT_DNEJ) a.push([k, v]);
    }
    a.sort(function (x, y) { return y[1] - x[1]; });
    for (var i = 0; i < a.length && i < PAMYAT_MAX; i++) o.d[a[i][0]] = a[i][1];
    return o;
  }
  // Вернулось устройство, где 3–30 дней назад проверяли компанию, — один раз в день.
  function pamyatVozvrat(p, den) {
    var o = pamyatChist(p, den), vidy = [];
    if (o.vz !== den) for (var k in o.d) {
      var x = den - o.d[k];
      if (x >= 3 && x <= 30) { vidy.push('vozvrat_3_30'); o.vz = den; break; }
    }
    return { p: o, vidy: vidy };
  }
  // Проверка организации: впервые на устройстве (за 60 дней) → proverka_novaya; 7–60 дней назад → perepoverka_7_60;
  // в тот же день или раньше 7 дней — ничего. ИП (12 цифр) и пример 0000000000 — мимо памяти и счёта.
  function pamyatProverka(p, inn, den) {
    inn = String(inn || '');
    if (!/^\d{10}$/.test(inn) || /^0+$/.test(inn)) return null;
    var r = pamyatVozvrat(p, den), o = r.p, byl = o.d[inn], x = den - byl;
    if (byl === undefined) r.vidy.push('proverka_novaya');
    else if (x >= 7 && x <= 60) r.vidy.push('perepoverka_7_60');
    delete o.d[inn];
    var d = {}; d[inn] = den;
    var stary = Object.keys(o.d).sort(function (a, b) { return o.d[b] - o.d[a]; }).slice(0, PAMYAT_MAX - 1);
    for (var i = 0; i < stary.length; i++) d[stary[i]] = o.d[stary[i]];
    o.d = d;
    return r;
  }

  // Сначала запись, потом события: хранилище недоступно или переполнено — ни памяти, ни событий, ни ошибок.
  function pamyatShag(f) {
    try {
      if (typeof w.dlkSchitaem !== 'function' || !w.dlkSchitaem() || typeof w.dlkSobytie !== 'function') return;
      var p = null;
      try { p = JSON.parse(w.localStorage.getItem(PAMYAT) || 'null'); } catch (e) { p = null; }
      var r = f(p, denIz(Date.now()));
      if (!r) return;
      w.localStorage.setItem(PAMYAT, JSON.stringify(r.p));
      for (var i = 0; i < r.vidy.length; i++) w.dlkSobytie(r.vidy[i]);
    } catch (e) {}
  }

  function add(r) {
    if (!r || !/^\d{10}(\d{2})?$/.test(String(r.inn || '')) || /^0+$/.test(r.inn)) return;
    var item = {
      inn: String(r.inn),
      name: String(r.name || '').slice(0, 160),
      level: LVL[r.level] ? r.level : '',
      id: /^[A-Za-z0-9_-]{8,24}$/.test(r.id || '') ? r.id : '',
      t: Date.now()
    };
    // pamyat-proverok-v1 (метрики M2 и R): первую и повторную проверку отличает память dlk_pamyat
    // (200 организаций, 60 дней), а не этот список из 5. На сервер — только вид события. ИНН ИП (12 цифр) — мимо счёта.
    if (item.inn.length === 10) pamyatShag(function (p, den) { return pamyatProverka(p, item.inn, den); });
    var a = read().filter(function (x) { return x.inn !== item.inn; });
    a.unshift(item);
    write(a.slice(0, MAX));
  }

  // kavychki-v1: старые записи на устройстве — с прямыми кавычками из ЕГРЮЛ; показываем «ёлочками» (js/imya.js)
  function kav(t) { return w.DlkImya ? w.DlkImya.kavychki(t) : t; }
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
    pamyatShag(pamyatVozvrat); // открыл пустой отчёт с «Недавними» — тоже вернулся
    if (!el) return 0;
    var a = read();
    if (!a.length) { el.hidden = true; el.innerHTML = ''; return 0; }
    el.hidden = false;
    el.innerHTML = '<h2 class="ned__h">Недавние проверки на этом устройстве</h2><ul class="ned__list">' +
      a.map(function (x) {
        var href = x.id ? '/report.html?id=' + encodeURIComponent(x.id) : '/?inn=' + encodeURIComponent(x.inn);
        return '<li><a href="' + href + '"><b>' + esc(x.name ? kav(x.name) : ('ИНН ' + x.inn)) + '</b>' +
          '<span>ИНН ' + esc(x.inn) + (x.t ? ' · ' + esc(when(x.t)) : '') + '</span></a>' +
          (x.level ? '<i class="ned__lvl ned__lvl--' + x.level + '">' + LVL[x.level] + '</i>' : '') + '</li>';
      }).join('') + '</ul><button type="button" class="ned__clear">Очистить список</button>';
    // «Очистить» стирает и память проверок для счёта (pamyat-proverok-v1) — следов на устройстве не остаётся
    el.querySelector('.ned__clear').onclick = function () {
      write([]); try { w.localStorage.removeItem('dlk_pamyat'); } catch (e) {} render(el);
    };
    return a.length;
  }

  w.Nedavnie = { add: add, list: read, render: render, KEY: KEY,
    pamyat: { chist: pamyatChist, vozvrat: pamyatVozvrat, proverka: pamyatProverka, KEY: PAMYAT } };
})(window);
