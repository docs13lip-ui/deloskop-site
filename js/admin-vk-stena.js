// «Стена ВКонтакте» в админке — admin-chestno-v1, 16.11.2026.
// Сервер (запрос 57 в deloskop-api): GET /api/admin/vk/stena/status → {podklyuchena:false|true, …};
// начало входа через VK ID — переход на /api/admin/vk/stena/podklyuchit (только администратор).
// На странице — состояние словами и одна кнопка. Ключей, кодов и адресов возврата не показываем:
// текст сервера с адресом или длинной строкой-ключом отбрасывается, параметры возврата снимаются из адресной строки.
(function () {
  var STATUS = '/api/admin/vk/stena/status';
  var NACHALO = '/api/admin/vk/stena/podklyuchit';
  // как сервер может назвать срок — берём первое заполненное, своего не придумываем
  var SROK = ['do', 'podklyuchena_do', 'deystvuet_do', 'istekaet', 'expires_at'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dvuzn(n) { return (n < 10 ? '0' : '') + n; }
  // «16.11.2026 в 14:30» по Москве (UTC+3, без перехода на летнее время)
  function srok(s) {
    var d = new Date(s);
    if (!s || isNaN(d.getTime())) return '';
    var m = new Date(d.getTime() + 3 * 3600 * 1000);
    return dvuzn(m.getUTCDate()) + '.' + dvuzn(m.getUTCMonth() + 1) + '.' + m.getUTCFullYear() +
      ' в ' + dvuzn(m.getUTCHours()) + ':' + dvuzn(m.getUTCMinutes());
  }
  // подсказка сервера «что нужно» — только словами: без адресов и без похожего на ключ
  function bezopasno(t) {
    t = String(t == null ? '' : t).trim();
    if (!t || t.length > 300) return '';
    if (/:\/\/|www\.|[A-Za-z0-9_\-]{24,}/.test(t)) return '';
    return t;
  }

  // sost: {podklyuchena, …} — ответ сервера; null — не загрузилось
  function sostoyanie(sost, oshibka) {
    if (!sost || typeof sost !== 'object') {
      return { klass: 'vk-net-svyazi', slovo: 'Состояние стены сейчас не загрузилось',
        poyasnenie: oshibka ? 'Ответ сервера: ' + oshibka + '. Обновите страницу через минуту.' : 'Обновите страницу через минуту.', knopka: 'Подключить стену' };
    }
    var nuzhno = bezopasno(sost.chto_nuzhno || sost.prichina);
    if (sost.podklyuchena === true) {
      var k = '';
      for (var i = 0; i < SROK.length && !k; i++) k = srok(sost[SROK[i]]);
      return { klass: 'vk-da', slovo: k ? 'Стена подключена до ' + k : 'Стена подключена',
        poyasnenie: 'Посты из «Отложенных» сервер публикует сам.' + (nuzhno ? ' ' + nuzhno : ''), knopka: 'Подключить заново' };
    }
    return { klass: 'vk-net', slovo: 'Стена не подключена',
      poyasnenie: (nuzhno ? nuzhno + ' ' : '') + 'Пока посты во ВКонтакте ставим вручную. Подключение — вход через VK\u00a0ID под профилем администратора сообщества, около минуты.',
      knopka: 'Подключить стену' };
  }

  function risovat(el, sost, admin, api, oshibka) {
    var s = sostoyanie(sost, oshibka);
    el.className = 'vk-stena ' + s.klass;
    el.innerHTML = '<p class="vk-slovo"><span class="vk-tochka" aria-hidden="true"></span><b>' + esc(s.slovo) + '</b></p>' +
      '<p class="sub vk-poyasn">' + esc(s.poyasnenie) + '</p>' +
      (admin
        ? '<a class="btn primary" id="vkPodkl" href="' + esc(api + NACHALO) + '" rel="nofollow">' + esc(s.knopka) + '</a>'
        : '<p class="note">Подключить стену может только администратор.</p>');
    return s;
  }

  // параметры, с которыми сервер вернул на страницу после VK ID, — убрать из адреса (в них может быть код)
  function snyatVozvrat(loc, hist) {
    if (!loc || !loc.search || !hist || !hist.replaceState) return false;
    try { hist.replaceState(null, '', loc.pathname + (loc.hash || '')); return true; } catch (_) { return false; }
  }

  var DlkVkStena = {
    start: function (call, isAdmin, api) {
      var sek = document.getElementById('vkSek'), box = document.getElementById('vkBox');
      if (!sek || !box) return Promise.resolve();
      snyatVozvrat(window.location, window.history);
      function zagruzit() {
        return call(STATUS).then(function (j) {
          sek.hidden = false; risovat(box, j, isAdmin(), api);
        }, function (err) {
          sek.hidden = false; risovat(box, null, isAdmin(), api, err && err.status ? String(err.status) : '');
        });
      }
      // «Назад» из VK ID может вернуть страницу из кэша браузера — тогда спросить состояние заново
      if (window.addEventListener) window.addEventListener('pageshow', function (e) { if (e && e.persisted) zagruzit(); });
      return zagruzit();
    },
    _sostoyanie: sostoyanie,
    _risovat: risovat,
    _bezopasno: bezopasno,
    _srok: srok,
    _snyatVozvrat: snyatVozvrat,
    NACHALO: NACHALO,
    STATUS: STATUS
  };
  window.DlkVkStena = DlkVkStena;
})();
