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
 * организации; в Метрику — только вид ввода и вид выбора (poisk_tip, poisk_vybor), без текста и ИНН.
 *
 * scena-poiska-v1 (13.11.2026, «поиск в 3D, строка по центру»): окно — во весь экран, строка по центру,
 * за ней — сцена (js/scena.js: фон с глубиной, знак, лупа, щит). Пакет сцены js/b/scena.* грузится только после первого
 * открытия окна; закрыли окно — 0 кадров. Нет WebGL — остаётся CSS-кадр (два кольца и мягкий свет). В сцену уходят только
 * три числа состояния (ждёт / распознано / опечатка) — ни текст, ни ИНН. */
(function () {
  'use strict';
  var P = window.DlkPoisk;
  if (!P || window.DlkPoiskOkno) return;
  var API = /(^|\.)deloskop\.ru$/.test(location.hostname) ? 'https://api.deloskop.ru' : '';

  // Стили окна — здесь, а не в общем css: страницам без поиска они не нужны. Цвета — токены дизайн-системы.
  var CSS = '' +
    'dialog.pso{position:fixed;inset:0;margin:0;width:100vw;max-width:100vw;height:100vh;height:100dvh;max-height:100dvh;padding:0;border:0;border-radius:0;overflow:hidden;display:block;color:var(--ink,#0D2247);font-family:var(--font,system-ui,sans-serif);' +
    'background:radial-gradient(60% 46% at 50% 18%,rgba(217,180,90,.20),transparent 70%),radial-gradient(40% 34% at 14% 78%,rgba(217,180,90,.10),transparent 70%),radial-gradient(38% 32% at 88% 70%,rgba(22,114,63,.08),transparent 70%),var(--bg,#F5F1E6)}' +
    'dialog.pso:not([open]){display:none}' +
    'dialog.pso::backdrop{background:var(--bg,#F5F1E6)}' +
    '.pso__gl{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;opacity:0;transition:opacity .6s ease}' +
    '.pso--gl .pso__gl{opacity:1}' +
    '.pso__sc{position:relative;z-index:1;height:100%;overflow:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;align-items:center;padding:clamp(16px,5vh,56px) 16px 24px;box-sizing:border-box}' +
    '.pso__zn{flex:none;position:relative;display:flex;align-items:center;justify-content:space-between;width:min(560px,100%);height:clamp(120px,24vh,240px);pointer-events:none}' +
    '.pso__zn::before,.pso__zn::after{content:"";position:absolute;top:50%;left:50%;height:46%;aspect-ratio:1;border-radius:50%;border:max(4px,.5vh) solid var(--ink,#0D2247);transform:translate(-80%,-50%)}' +
    '.pso__zn::after{border-color:var(--accent,#12305F);transform:translate(-20%,-50%)}' +
    '.pso--gl .pso__zn::before,.pso--gl .pso__zn::after{visibility:hidden}' +
    '.pso__m{flex:none;width:clamp(72px,20vw,120px);aspect-ratio:1}' +
    '.pso__h{flex:none;margin:4px 0 20px;font:700 clamp(28px,4.2vw,46px)/1.08 var(--font-display,var(--font,system-ui));letter-spacing:-.02em;text-align:center;text-wrap:balance}' +
    '.pso__ryad{flex:none;position:relative;width:min(760px,100%)}' +
    '.pso__b{position:absolute;top:50%;width:clamp(160px,17vw,250px);aspect-ratio:1;transform:translateY(-50%);pointer-events:none}' +
    '.pso__b--lu{right:calc(100% + 3.5vw)}.pso__b--sh{left:calc(100% + 3.5vw)}' +
    '.pso__f{display:flex;align-items:center;gap:12px;margin:0;padding:10px 10px 10px 22px;border-radius:28px;border:1px solid var(--line,#E3DDCD);background:var(--card,#fff);box-shadow:0 18px 60px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.35)}' +
    '.pso__f:focus-within{border-color:var(--accent,#12305F);box-shadow:0 18px 60px rgba(0,0,0,.16),0 0 0 4px rgba(217,180,90,.22),inset 0 1px 0 rgba(255,255,255,.35)}' +
    '.pso__f svg{flex:none;color:var(--ink-2,#55555A)}' +
    '.pso__i{flex:1;min-width:0;border:0;outline:0;background:none;color:inherit;font:500 20px/1.3 var(--font,system-ui);padding:12px 0}' +
    '.pso__i::placeholder{color:var(--muted,#86868B)}' +
    '.pso__x{flex:none;border:1px solid var(--line,#E3DDCD);background:none;color:var(--ink-2,#55555A);border-radius:10px;padding:6px 10px;font:500 12px/1 var(--font,system-ui);cursor:pointer;min-height:36px}' +
    '.pso__x:hover{color:var(--ink,#0D2247);border-color:var(--ink-2,#55555A)}' +
    '.pso__x:focus-visible,.pso .ps-ex button:focus-visible{outline:3px solid var(--accent,#12305F);outline-offset:2px}' +
    '.pso .sugg{position:static;flex:0 1 auto;width:min(760px,100%);box-sizing:border-box;margin:12px 0 0;padding:6px;list-style:none;overflow:visible;max-height:none;border-radius:28px;border:1px solid var(--line,#E3DDCD);background:var(--card,#fff);box-shadow:0 18px 60px rgba(0,0,0,.12)}' +
    '.pso .sugg:empty{display:none}' +
    '@supports ((backdrop-filter:blur(2px)) or (-webkit-backdrop-filter:blur(2px))){.pso--gl .pso__f,.pso--gl .sugg{background:color-mix(in srgb,var(--card,#fff) 74%,transparent);-webkit-backdrop-filter:blur(22px) saturate(1.35);backdrop-filter:blur(22px) saturate(1.35)}}' +
    '.pso .sugg li{padding:10px 14px;border-radius:16px;cursor:pointer;display:flex;flex-direction:column;gap:2px}' +
    '.pso .sugg li[aria-selected="true"],.pso .sugg li.ps-row:hover{background:var(--bg,#F5F1E6)}' +
    '.pso .sugg b{font-weight:600;font-size:17px;color:var(--ink,#0D2247)}.pso .sugg span{font-size:13px;color:var(--ink-2,#55555A)}' +
    '.pso .sugg li.ps-row{position:relative;padding-right:84px}.pso .sugg li.ps-row--info{cursor:default}.pso .sugg li.ps-row--info b{font-weight:500}' +
    '.pso .sugg li.ps-seen{flex-direction:row;flex-wrap:wrap;align-items:center;gap:6px 8px;cursor:default;padding:8px 12px 6px;font-size:13px;color:var(--ink-2,#55555A)}' +
    '.pso .ps-chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px;font-weight:600;font-size:13px;background:var(--accent-soft,#ECEFF6);color:var(--accent,#12305F)}' +
    '.pso .ps-chip i{width:7px;height:7px;border-radius:50%;background:currentColor}' +
    '.pso .ps-seen--err .ps-chip{background:var(--warn-bg,#FFF4E0);color:var(--warn,#9A5B00)}' +
    '.pso .sugg li.ps-gh{cursor:default;padding:10px 12px 2px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#5B6783)}' +
    '.pso .ps-tag{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-style:normal;font-size:12px;color:var(--muted,#5B6783);border:1px solid var(--line,#E3DDCD);border-radius:999px;padding:2px 8px;white-space:nowrap}' +
    '.pso .ps-tag--ent{color:var(--ink,#0D2247);border-color:var(--accent,#12305F)}' +
    '.pso .ps-tag--warn{color:var(--warn,#9A5B00);border-color:currentColor}.pso .ps-tag--niz{position:static;transform:none;align-self:flex-start;margin-top:4px}' +
    '.pso .sugg li.ps-ex{flex-direction:row;flex-wrap:wrap;gap:8px;cursor:default;padding:6px 12px 10px}' +
    '.pso .ps-ex button{border:1px solid var(--line,#E3DDCD);background:transparent;color:var(--ink-2,#55555A);border-radius:999px;padding:7px 13px;font:inherit;font-size:13px;cursor:pointer;min-height:36px}' +
    '.pso .ps-ex button:hover{color:var(--ink,#0D2247);border-color:var(--accent,#12305F)}' +
    '.pso__n{flex:none;margin:14px 0 0;padding:0 8px;font-size:12px;color:var(--muted,#5B6783);text-align:center}' +
    '.pso__n kbd{font:inherit;border:1px solid var(--line,#E3DDCD);border-radius:6px;padding:1px 6px;margin-right:4px}' +
    '@media (min-width:1180px){.pso__m{display:none}.pso__zn{justify-content:center}}' +
    '@media (max-width:1179px){.pso__b{display:none}}' +
    '@media (max-width:640px){.pso__sc{padding:calc(10px + env(safe-area-inset-top)) 12px 16px}.pso__zn{height:104px}.pso__h{margin:0 0 14px}.pso__f{gap:10px;padding:6px 6px 6px 14px;border-radius:16px}.pso__i{font-size:17px}.pso__n{display:none}' +
    '.pso__x{font-size:0;width:40px;min-height:40px;padding:0;border-color:transparent}.pso__x::before{content:"\\00D7";font-size:24px;line-height:1}' +
    '.pso .sugg{border-radius:16px}.pso .sugg li{border-radius:10px}.pso .sugg li.ps-row{padding-right:12px}.pso .ps-tag--ent{display:none}.pso .ps-tag{position:static;transform:none;align-self:flex-start;margin-top:4px}}' +
    '@media (max-height:560px){.pso__zn{height:76px}.pso__h{font-size:24px;margin-bottom:10px}}' +
    '@media (prefers-reduced-motion:no-preference){dialog.pso[open] .pso__h,dialog.pso[open] .pso__ryad,dialog.pso[open] .sugg{animation:pso-v .32s cubic-bezier(.2,.7,.2,1) both}dialog.pso[open] .pso__ryad{animation-delay:.05s}dialog.pso[open] .sugg{animation-delay:.1s}@keyframes pso-v{from{opacity:0;transform:translateY(10px)}}}' +
    '@media (prefers-reduced-motion:reduce){.pso__gl{transition:none}}';

  var dlg, form, input, list, sc, SC = null, scZhdet = false, SOST = { focus: 0, exact: false, err: false }, rows = [], items = [], sel = -1, PR = null, razdely = null, pustoe = false, tmr = 0, lastQ = '', tipByl = '', kto = null;

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
      PR = null; pustoe = true; SOST.focus = 0; SOST.exact = false; SOST.err = false;
      var nd = nedavnie().filter(function (x) { return x && /^\d{10}$/.test(x.inn); }).slice(0, 3);
      rows = nd.map(function (x) { return { inn: x.inn, imya: x.name || x.inn, t: x.name, s: '' }; });
      items = rows; sel = -1; list.innerHTML = P.htmlPusto(nd); otmetit(); return;
    }
    pustoe = false;
    PR = P.razobrat(q, razdely || []);
    SOST.exact = !!PR.exact; SOST.err = !!PR.err; SOST.focus = PR.exact ? 1 : .6;
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
      '<canvas class="pso__gl" aria-hidden="true"></canvas>' +
      '<div class="pso__sc">' +
      '<div class="pso__zn" aria-hidden="true"><i class="pso__m pso__m--lu"></i><i class="pso__m pso__m--sh"></i></div>' +
      '<p class="pso__h" id="pso-h">Что проверяем?</p>' +
      '<div class="pso__ryad"><i class="pso__b pso__b--lu" aria-hidden="true"></i>' +
      '<form class="pso__f" role="search" method="dialog">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>' +
      '<input class="pso__i" type="text" name="q" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" maxlength="300"' +
      ' placeholder="ИНН, название, счёт или вопрос" aria-label="ИНН, название, счёт или вопрос" role="combobox" aria-controls="pso-l" aria-autocomplete="list" aria-expanded="true">' +
      '<button class="pso__x" type="button" aria-label="Закрыть поиск">Esc</button></form>' +
      '<i class="pso__b pso__b--sh" aria-hidden="true"></i></div>' +
      '<ul class="sugg" id="pso-l" role="listbox" aria-label="Что нашлось"></ul>' +
      '<p class="pso__n"><kbd>Enter</kbd>первое действие · <kbd>↑</kbd><kbd>↓</kbd>выбрать · <kbd>Esc</kbd>закрыть</p>' +
      '</div>';
    document.body.appendChild(dlg);
    form = dlg.querySelector('form'); input = dlg.querySelector('input'); list = dlg.querySelector('ul'); sc = dlg.querySelector('.pso__sc');
    dlg.querySelector('.pso__x').addEventListener('click', function () { zakryt(); });
    dlg.addEventListener('close', function () { clearTimeout(tmr); if (SC) SC.vkl(false); if (kto && kto.focus) try { kto.focus(); } catch (e) {} });
    // нажатие мимо строки и списка (на сцену) — закрыть
    dlg.addEventListener('mousedown', function (e) { if (e.target === dlg || e.target === sc) zakryt(); });
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
  // Сцена: пакет js/b/scena.* — только после первого открытия окна; адрес — у значка лупы в шапке (data-scena-src).
  // Не загрузился, нет WebGL — окно работает как есть, на CSS-кадре.
  function scena() {
    if (SC) { SC.vkl(true); return; }
    if (scZhdet || !window.WebGLRenderingContext) return;
    var kn = document.querySelector('[data-scena-src]'), src = kn && kn.getAttribute('data-scena-src');
    if (!src || !/^\/js\/b\/scena\.[0-9a-f]+\.js$/.test(src)) return;
    scZhdet = true;
    var s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = function () {
      if (!window.DlkScena || SC) return;
      try {
        SC = window.DlkScena({ cv: dlg.querySelector('.pso__gl'), mark: dlg.querySelector('.pso__zn'), box: form, pole: input,
          lupa: [dlg.querySelector('.pso__b--lu'), dlg.querySelector('.pso__m--lu')], shit: [dlg.querySelector('.pso__b--sh'), dlg.querySelector('.pso__m--sh')],
          sost: function () { return SOST; }, netGL: function () { dlg.classList.remove('pso--gl'); } });
        if (SC.est()) { dlg.classList.add('pso--gl'); SC.vkl(dlg.open); }
      } catch (e) {}
    };
    document.head.appendChild(s);
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
    scena();
    goal('poisk_okno');
  }
  function zakryt(uhod) { if (!dlg || !dlg.open) return; if (uhod) kto = null; try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); } }

  // zamer() — цифры сцены на этом устройстве (для приёмки): цена кадра, размер холста, качество; текста запроса там нет
  window.DlkPoiskOkno = { otkryt: otkryt, zakryt: zakryt, kuda: kuda, vidVybora: vidVybora, zamer: function () { return SC ? SC.zamer() : ''; } };
  // шапка нажала значок раньше, чем пакет догрузился, — открываем сразу
  var zhdet = window.__dlkPoiskZhdet;
  window.__dlkPoiskZhdet = null;
  if (typeof zhdet === 'function') zhdet();
})();
