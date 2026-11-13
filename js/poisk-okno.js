/* Делоскоп — та же строка поверх любой страницы (poisk-v2-b, 13.11.2026).
 *
 * Значок лупы в шапке, «/» и Ctrl+K (⌘K) открывают окно с той же строкой, что на главной: тот же разбор ввода
 * (js/poisk.js — DlkPoisk), те же группы, Enter делает первое. На главной окна нет — шапка просто ставит курсор
 * в строку проверки (js/shapka.js). Пакет js/b/poisk-okno.* грузится только по первому нажатию (или наведению
 * на значок), страницам он ничего не стоит.
 *
 * Куда ведёт выбор: компания или ИНН — /?inn=<ИНН> (главная сразу проверяет); «Проверить «название»» — /?inn=<текст>#poisk
 * (главная подставит текст и покажет подсказки ЕГРЮЛ); раздел или инструмент — его адрес.
 * Принципы те же: текст запроса не храним и никуда не шлём, кроме подсказок ЕГРЮЛ по названию; в списках — только
 * организации; в Метрику — только вид ввода и вид выбора (poisk_tip, poisk_vybor), без текста и ИНН. */
(function () {
  'use strict';
  var P = window.DlkPoisk;
  if (!P || window.DlkPoiskOkno) return;
  var API = /(^|\.)deloskop\.ru$/.test(location.hostname) ? 'https://api.deloskop.ru' : '';

  // Стили окна — здесь, а не в общем css: страницам без поиска они не нужны. Цвета — токены дизайн-системы.
  var CSS = '' +
    'dialog.pso{position:fixed;inset:0;margin:min(12vh,112px) auto auto;width:min(640px,calc(100vw - 32px));max-height:calc(100dvh - min(12vh,112px) - 24px);padding:0;border:0;border-radius:28px;background:var(--card,#fff);color:var(--ink,#1D1D1F);font-family:var(--font,system-ui,sans-serif);box-shadow:0 24px 80px rgba(0,0,0,.22);overflow:hidden;display:flex;flex-direction:column}' +
    'dialog.pso:not([open]){display:none}' +
    'dialog.pso::backdrop{background:rgba(17,17,19,.32);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}' +
    '.pso__f{display:flex;align-items:center;gap:12px;padding:14px 14px 14px 20px;border-bottom:1px solid var(--line,#E6E6E1);margin:0}' +
    '.pso__f svg{flex:none;color:var(--ink-2,#55555A)}' +
    '.pso__i{flex:1;min-width:0;border:0;outline:0;background:none;color:inherit;font:500 20px/1.3 var(--font,system-ui);padding:8px 0}' +
    '.pso__i::placeholder{color:var(--muted,#86868B)}' +
    '.pso__x{flex:none;border:1px solid var(--line,#E6E6E1);background:none;color:var(--ink-2,#55555A);border-radius:8px;padding:4px 8px;font:500 12px/1 var(--font,system-ui);cursor:pointer;min-height:28px}' +
    '.pso__x:hover{color:var(--ink,#1D1D1F);border-color:var(--ink-2,#55555A)}' +
    '.pso__x:focus-visible,.pso .ps-ex button:focus-visible{outline:3px solid var(--accent,#0B63E5);outline-offset:2px}' +
    '.pso .sugg{position:static;box-shadow:none;border-radius:0;margin:0;padding:6px;list-style:none;overflow:auto;flex:1 1 auto;max-height:none;background:none}' +
    '.pso .sugg li{padding:10px 12px;border-radius:10px;cursor:pointer;display:flex;flex-direction:column;gap:2px}' +
    '.pso .sugg li[aria-selected="true"],.pso .sugg li.ps-row:hover{background:var(--bg,#F5F5F2)}' +
    '.pso .sugg b{font-weight:600;font-size:17px;color:var(--ink,#1D1D1F)}.pso .sugg span{font-size:13px;color:var(--ink-2,#55555A)}' +
    '.pso .sugg li.ps-row{position:relative;padding-right:84px}.pso .sugg li.ps-row--info{cursor:default}.pso .sugg li.ps-row--info b{font-weight:500}' +
    '.pso .sugg li.ps-seen{flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px 8px;cursor:default;padding:8px 12px 6px;font-size:13px;color:var(--ink-2,#55555A)}' +
    '.pso .ps-chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px;font-weight:600;font-size:13px;background:var(--accent-soft,#EAF1FD);color:var(--accent,#0B63E5)}' +
    '.pso .ps-chip i{width:7px;height:7px;border-radius:50%;background:currentColor}' +
    '.pso .ps-seen--err .ps-chip{background:var(--warn-bg,#FFF4E0);color:var(--warn,#9A5B00)}' +
    '.pso .sugg li.ps-gh{cursor:default;padding:10px 12px 2px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#66666B)}' +
    '.pso .ps-tag{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-style:normal;font-size:12px;color:var(--muted,#66666B);border:1px solid var(--line,#E6E6E1);border-radius:999px;padding:2px 8px;white-space:nowrap}' +
    '.pso .ps-tag--ent{color:var(--ink,#1D1D1F);border-color:var(--accent,#0B63E5)}' +
    '.pso .ps-tag--warn{color:var(--warn,#9A5B00);border-color:currentColor}.pso .ps-tag--niz{position:static;transform:none;align-self:flex-start;margin-top:4px}' +
    '.pso .sugg li.ps-ex{flex-direction:row;flex-wrap:wrap;gap:8px;cursor:default;padding:6px 12px 10px}' +
    '.pso .ps-ex button{border:1px solid var(--line,#E6E6E1);background:transparent;color:var(--ink-2,#55555A);border-radius:999px;padding:7px 13px;font:inherit;font-size:13px;cursor:pointer;min-height:36px}' +
    '.pso .ps-ex button:hover{color:var(--ink,#1D1D1F);border-color:var(--accent,#0B63E5)}' +
    '.pso__n{margin:0;padding:10px 20px 12px;border-top:1px solid var(--line,#E6E6E1);font-size:12px;color:var(--muted,#66666B)}' +
    '.pso__n kbd{font:inherit;border:1px solid var(--line,#E6E6E1);border-radius:6px;padding:1px 6px;margin-right:4px}' +
    '@media (max-width:640px){dialog.pso{margin:0;width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0}.pso__f{padding:10px 12px 10px 16px;padding-top:calc(10px + env(safe-area-inset-top))}.pso__n{display:none}' +
    '.pso .sugg li.ps-row{padding-right:12px}.pso .ps-tag--ent{display:none}.pso .ps-tag{position:static;transform:none;align-self:flex-start;margin-top:4px}}' +
    '@media (prefers-reduced-motion:no-preference){dialog.pso[open]{animation:pso-v .18s cubic-bezier(.2,.7,.2,1)}@keyframes pso-v{from{opacity:0;transform:translateY(-8px) scale(.985)}}}';

  var dlg, form, input, list, rows = [], items = [], sel = -1, PR = null, razdely = null, pustoe = false, tmr = 0, lastQ = '', tipByl = '', kto = null;

  function goal(c, p) { if (window.dlkGoal) try { window.dlkGoal(c, p); } catch (e) {} }
  function nedavnie() { try { return window.Nedavnie ? window.Nedavnie.list() : JSON.parse(localStorage.getItem('dlk_nedavnie') || '[]'); } catch (e) { return []; } }
  function razd() {
    if (razdely) return;
    razdely = [];
    fetch('/data/poisk-razdely.json').then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) { razdely = j.razdely || []; if (input.value.trim()) risovat(); }).catch(function () {});
  }
  function otmetit() {
    [].forEach.call(list.querySelectorAll('[role=option]'), function (li) {
      var on = +li.dataset.i === sel;
      li.setAttribute('aria-selected', on);
      var t = li.querySelector('.ps-tag--ent');
      if (t && !on) t.remove();
      if (on) {
        input.setAttribute('aria-activedescendant', li.id);
        if (li.scrollIntoView) li.scrollIntoView({ block: 'nearest' });
        if (!pustoe && !li.querySelector('.ps-tag') && P.deystvie(rows[sel])) { var e = document.createElement('em'); e.className = 'ps-tag ps-tag--ent'; e.textContent = 'Enter ↵'; li.appendChild(e); }
      }
    });
    if (sel < 0) input.removeAttribute('aria-activedescendant');
  }
  function risovat() {
    var q = input.value;
    if (!q.trim()) {
      PR = null; pustoe = true;
      var nd = nedavnie().filter(function (x) { return x && /^\d{10}$/.test(x.inn); }).slice(0, 3);
      rows = nd.map(function (x) { return { inn: x.inn, imya: x.name || x.inn, t: x.name, s: '' }; });
      items = rows; sel = -1; list.innerHTML = P.htmlPusto(nd); otmetit(); return;
    }
    pustoe = false;
    PR = P.razobrat(q, razdely || []);
    rows = P.sobrat(PR, items); sel = P.pervoe(rows);
    list.innerHTML = P.html(PR, rows, sel); otmetit();
    if (PR.vid && PR.vid !== tipByl && PR.exact) { tipByl = PR.vid; goal('poisk_tip', { vid: PR.vid, mesto: 'okno' }); }
  }
  // Куда ведёт строка: адрес на этом сайте или '' (строка-пояснение)
  function kuda(r) {
    if (!r) return '';
    if (r.inn) return '/?inn=' + encodeURIComponent(r.inn);
    if (r.q) return '/?inn=' + encodeURIComponent(r.q) + '#poisk';
    if (r.href && /^\/(?!\/)/.test(r.href)) return r.href;
    return '';
  }
  function vidVybora(r) { return r.inn ? (r.imya ? 'kompaniya' : 'inn') : r.q ? 'nazvanie' : r.razdel ? 'razdel' : 'instrument'; }
  function vybrat(i, sposob) {
    var r = rows[i];
    if (r && r.dopisat) { goal('poisk_vybor', { vid: 'dopisat', mesto: 'okno', sposob: sposob, nomer: i }); input.value = r.q; input.focus(); input.dispatchEvent(new Event('input')); return true; }
    var u = kuda(r);
    if (!u) return false;
    goal('poisk_vybor', { vid: pustoe ? 'nedavnie' : vidVybora(r), mesto: 'okno', sposob: sposob, nomer: i });
    zakryt(true);
    location.href = u;
    return true;
  }
  // poisk-v2-d: тот же сервер, что у главной, — /api/poisk (банк по БИК, компании по ОКВЭД и названию); молчит — /api/suggest
  function podskazki() {
    clearTimeout(tmr);
    var q = input.value.trim(), qs = P.chtoSprosit ? P.chtoSprosit(PR, q) : '';
    items = [];
    if (!API || !qs) return;
    tmr = setTimeout(function () {
      lastQ = q;
      P.zapros(API, qs, fetch.bind(window))
        .then(function (j) {
          if (lastQ !== input.value.trim() || !dlg.open) return;
          items = P.otvet(PR, j, window.DlkImya ? window.DlkImya.kavychki : null, q);
          rows = P.sobrat(PR, items); sel = P.pervoe(rows); list.innerHTML = P.html(PR, rows, sel); otmetit();
        }).catch(function () {});
    }, 250);
  }
  function stroit() {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    dlg = document.createElement('dialog');
    dlg.className = 'pso';
    dlg.setAttribute('aria-label', 'Поиск по Делоскопу');
    dlg.innerHTML =
      '<form class="pso__f" role="search" method="dialog">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>' +
      '<input class="pso__i" type="text" name="q" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" maxlength="300"' +
      ' placeholder="ИНН, название, счёт или вопрос" aria-label="ИНН, название, счёт или вопрос" role="combobox" aria-controls="pso-l" aria-autocomplete="list" aria-expanded="true">' +
      '<button class="pso__x" type="button" aria-label="Закрыть поиск">Esc</button></form>' +
      '<ul class="sugg" id="pso-l" role="listbox" aria-label="Что нашлось"></ul>' +
      '<p class="pso__n"><kbd>Enter</kbd>первое действие · <kbd>↑</kbd><kbd>↓</kbd>выбрать · <kbd>Esc</kbd>закрыть</p>';
    document.body.appendChild(dlg);
    form = dlg.querySelector('form'); input = dlg.querySelector('input'); list = dlg.querySelector('ul');
    dlg.querySelector('.pso__x').addEventListener('click', function () { zakryt(); });
    dlg.addEventListener('close', function () { clearTimeout(tmr); if (kto && kto.focus) try { kto.focus(); } catch (e) {} });
    // нажатие мимо окна (на подложку) — закрыть
    dlg.addEventListener('mousedown', function (e) { if (e.target === dlg) zakryt(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); if (sel >= 0) vybrat(sel, 'enter'); });
    list.addEventListener('mousedown', function (e) {
      var b = e.target.closest('button[data-q]');
      if (b) { e.preventDefault(); input.value = b.getAttribute('data-q'); input.dispatchEvent(new Event('input')); input.focus(); return; }
      var li = e.target.closest('[role=option]');
      if (li) { e.preventDefault(); vybrat(+li.dataset.i, 'klik'); }
    });
    input.addEventListener('paste', function (e) {
      var cd = e.clipboardData, s = cd && cd.getData('text');
      if (!s || !/[\r\n\t]/.test(s)) return;
      e.preventDefault(); input.value = P.vstavka(input.value + ' ' + s); input.dispatchEvent(new Event('input'));
    });
    input.addEventListener('input', function () { razd(); items = []; risovat(); podskazki(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!rows.length) return;
        e.preventDefault();
        var n = rows.length, k = 0;
        do { sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; k++; } while (k < n && !pustoe && !P.deystvie(rows[sel]));
        otmetit();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (sel >= 0) vybrat(sel, 'enter');
      }
    });
  }
  function otkryt(otkuda) {
    if (!dlg) stroit();
    kto = otkuda || document.activeElement;
    if (dlg.open) { input.focus(); input.select(); return; }
    input.value = ''; items = []; tipByl = '';
    risovat();
    try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
    input.focus();
    razd();
    goal('poisk_okno');
  }
  function zakryt(uhod) { if (!dlg || !dlg.open) return; if (uhod) kto = null; try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); } }

  window.DlkPoiskOkno = { otkryt: otkryt, zakryt: zakryt, kuda: kuda, vidVybora: vidVybora };
  // шапка нажала значок раньше, чем пакет догрузился, — открываем сразу
  var zhdet = window.__dlkPoiskZhdet;
  window.__dlkPoiskZhdet = null;
  if (typeof zhdet === 'function') zhdet();
})();
