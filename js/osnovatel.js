// /osnovatel/ — честный счётчик мест и две фазы кнопки (claude/Арт-директор_основатель_26.09.md, 26.09.2026).
// GET /api/osnovatel → {vsego, zanyato, ostalos, priem_oplat} (API schet-v2). Место занимает только оплата.
// API не ответил (до выкладки schet-v2 — 404) → остаётся «Забронировать место», счётчика нет.
(function () {
  var MIN_POKAZ = 10; // «1 из 300» выглядит как пустой зал — до 10 оплат счётчик не показываем
  var API = location.hostname.endsWith('deloskop.ru') ? 'https://api.deloskop.ru' : '';
  var $ = function (s) { return document.querySelector(s); };
  var chislo = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };

  function primenit(j) {
    if (!j || typeof j.vsego !== 'number' || typeof j.zanyato !== 'number') return;
    var btn = $('[data-osn-btn]'), note = $('[data-osn-note]'), seats = $('[data-osn-seats]');
    var ostalos = typeof j.ostalos === 'number' ? j.ostalos : j.vsego - j.zanyato;
    if (seats && j.zanyato >= MIN_POKAZ) {
      $('[data-osn-zanyato]').textContent = chislo(j.zanyato);
      $('[data-osn-vsego]').textContent = chislo(j.vsego);
      $('[data-osn-fill]').style.width = Math.min(100, j.zanyato / j.vsego * 100).toFixed(1) + '%';
      seats.hidden = false;
    }
    if (!btn) return;
    if (ostalos <= 0) {
      btn.textContent = 'Места закончились';
      btn.setAttribute('aria-disabled', 'true');
      btn.removeAttribute('data-schet');
      btn.removeAttribute('href');
      if (note) note.innerHTML = 'Все 300 мест заняты. Обычные тарифы — на&nbsp;<a href="/tarify/">странице тарифов</a>.';
    } else if (j.priem_oplat === true) {
      btn.textContent = 'Получить счёт';
      if (note) note.textContent = 'Счёт на ИП или компанию. Доступ откроем в день поступления денег.';
    }
  }
  window.DlkOsnovatel = { primenit: primenit, MIN_POKAZ: MIN_POKAZ };

  if (!API && location.protocol === 'file:') return;
  fetch(API + '/api/osnovatel', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(primenit)
    .catch(function () {});
  if (window.dlkGoal) window.dlkGoal('pkg_view', { produkt: 'osnovatel' });
})();
