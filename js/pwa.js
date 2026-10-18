/* Делоскоп — приложение на телефоне (pwa-v1, 12.10.2026).
   1) Регистрирует /sw.js (оболочка и экран «Нет сети»; ответы API не кэшируются — см. sw.js).
   2) Тихая подсказка «Установить» (Android, Chrome/Яндекс Браузер — событие beforeinstallprompt)
      и «На экран Домой» (iPhone/iPad, Safari). Правила: не на первой странице визита, не раньше 5 секунд,
      не в установленном приложении, не в админке, не чаще раза в 14 дней (после «Не сейчас» или показа).
   Цели Метрики (только с согласия — js/metrika.js): pwa_pokaz, pwa_ustanovit, pwa_ustanovleno, {vid}. */
(function (w, d) {
  'use strict';
  var KEY = 'dlk_pwa';           // {t: время последнего показа, ok: установлено}
  var SCHET = 'dlk_pwa_str';     // просмотры страниц в этом визите
  var PAUZA = 14 * 864e5;
  var n = w.navigator;

  if ('serviceWorker' in n && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    w.addEventListener('load', function () { n.serviceWorker.register('/sw.js').catch(function () {}); });
  }

  function chitat() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function zapisat(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
  function cel(imya, vid) { try { if (w.dlkGoal) w.dlkGoal(imya, { vid: vid }); } catch (e) {} }

  // pwa-v1.1: внутри приложения Делоскопа для Android/iPhone (User-Agent «DeloskopApp/…» или мост Capacitor) — подсказки нет
  var vPrilozhenii = /DeloskopApp\//.test(n.userAgent || '') || !!(w.Capacitor && w.Capacitor.isNativePlatform && w.Capacitor.isNativePlatform());
  if (vPrilozhenii) { try { d.documentElement.setAttribute('data-prilozhenie', '1'); } catch (e) {} }
  var ustanovleno = vPrilozhenii || (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) || n.standalone === true;
  if (ustanovleno || /^\/admin/.test(location.pathname)) return;

  var str = 0;
  try { str = (+sessionStorage.getItem(SCHET) || 0) + 1; sessionStorage.setItem(SCHET, String(str)); } catch (e) {}

  function mozhno() {
    var s = chitat();
    if (s.ok) return false;
    if (s.t && Date.now() - s.t < PAUZA) return false;
    if (str < 2) return false;
    var ck = d.querySelector('.ck-bar'); // сначала человек отвечает про cookies — две плашки разом не показываем
    return !(ck && !ck.hidden && ck.offsetParent !== null);
  }

  var ua = n.userAgent || '';
  var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && n.maxTouchPoints > 1);
  var safari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|YaBrowser|OPiOS/.test(ua);
  var otlozhennoe = null;

  function stil() {
    if (d.getElementById('pwa-stil')) return;
    var s = d.createElement('style');
    s.id = 'pwa-stil';
    s.textContent =
      '.pwa{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:900;max-width:480px;margin:0 auto;' +
      'display:flex;gap:14px;align-items:flex-start;padding:16px 16px 16px 18px;background:var(--surface,#fff);color:var(--ink,#1D1D1F);' +
      'border-radius:28px;box-shadow:0 1px 2px rgba(29,29,31,.04),0 12px 32px rgba(29,29,31,.12);font:400 15px/1.45 var(--font,Onest,-apple-system,Roboto,Arial,sans-serif);' +
      'transform:translateY(16px);opacity:0;transition:transform 240ms cubic-bezier(.2,.7,.2,1),opacity 240ms}' +
      '.pwa--on{transform:none;opacity:1}' +
      '.pwa__ik{flex:none;width:44px;height:44px;border-radius:10px}' +
      '.pwa__t{flex:1;min-width:0}.pwa__t b{display:block;font-weight:600;font-size:17px;margin-bottom:2px}' +
      '.pwa__t p{margin:0;color:var(--ink-2,#48484C)}' +
      '.pwa__kn{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}' +
      '.pwa__da{min-height:44px;padding:0 18px;border:0;border-radius:999px;background:var(--accent,#0B63E5);color:#fff;font-weight:600;font-size:15px;line-height:1;font-family:inherit;cursor:pointer}' +
      '.pwa__da:hover{background:var(--accent-hover,#084BB0)}' +
      '.pwa__net{min-height:44px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:var(--accent,#0B63E5);font-weight:600;font-size:15px;line-height:1;font-family:inherit;cursor:pointer}' +
      '.pwa__x{flex:none;width:44px;height:44px;margin:-10px -10px 0 0;border:0;border-radius:50%;background:transparent;color:var(--muted,#6B6B70);cursor:pointer;display:grid;place-items:center}' +
      '.pwa__sh{display:inline-block;width:16px;height:16px;vertical-align:-2px;margin:0 2px}' +
      '@media (prefers-reduced-motion:reduce){.pwa{transition:none}}';
    d.head.appendChild(s);
  }

  var SHARE = '<svg class="pwa__sh" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function pokazat(vid) {
    if (d.querySelector('.pwa')) return;
    stil();
    var el = d.createElement('div');
    el.className = 'pwa';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Делоскоп на экране телефона');
    var tekst = vid === 'ios'
      ? '<b>Делоскоп на экране «Домой»</b><p>Нажмите ' + SHARE + '«Поделиться» внизу Safari, затем «На экран „Домой“». Проверка по&nbsp;ИНН&nbsp;— в&nbsp;одно касание.</p>'
      : '<b>Делоскоп на экране телефона</b><p>Проверка по&nbsp;ИНН в&nbsp;одно касание, работает и&nbsp;при плохой сети.</p>' +
        '<div class="pwa__kn"><button class="pwa__da" type="button">Установить</button><button class="pwa__net" type="button">Не сейчас</button></div>';
    el.innerHTML = '<img class="pwa__ik" src="/apple-touch-icon.png" alt="" width="44" height="44"><div class="pwa__t">' + tekst + '</div>' +
      (vid !== 'ios' ? '' : '<button class="pwa__x" type="button" aria-label="Скрыть на 14 дней"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>');
    d.body.appendChild(el);
    zapisat({ t: Date.now() });
    cel('pwa_pokaz', vid);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('pwa--on'); }); });

    function ubrat() { el.classList.remove('pwa--on'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260); }
    var x = el.querySelector('.pwa__x');
    if (x) x.onclick = ubrat;
    var net = el.querySelector('.pwa__net');
    if (net) net.onclick = ubrat;
    var da = el.querySelector('.pwa__da');
    if (da) da.onclick = function () {
      cel('pwa_ustanovit', vid);
      ubrat();
      if (!otlozhennoe) return;
      otlozhennoe.prompt();
      otlozhennoe.userChoice.then(function (r) { if (r && r.outcome === 'accepted') zapisat({ t: Date.now(), ok: 1 }); }).catch(function () {});
      otlozhennoe = null;
    };
    d.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { ubrat(); d.removeEventListener('keydown', esc); } });
  }

  function pozzhe(vid) { setTimeout(function () { if (mozhno()) pokazat(vid); }, 5000); }

  w.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); // своя тихая подсказка вместо системной полосы
    otlozhennoe = e;
    var grubyj = w.matchMedia && w.matchMedia('(pointer: coarse)').matches;
    if (grubyj) pozzhe('android');
  });
  w.addEventListener('appinstalled', function () {
    zapisat({ t: Date.now(), ok: 1 });
    cel('pwa_ustanovleno', ios ? 'ios' : 'android');
    var el = d.querySelector('.pwa');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });
  if (safari) {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { pozzhe('ios'); });
    else pozzhe('ios');
  }
  w.DlkPwa = { pokazat: pokazat, mozhno: mozhno }; // для проверок
})(window, document);
