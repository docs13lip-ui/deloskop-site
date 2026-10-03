/*
 * Делоскоп — экран «бесплатные проверки на сегодня закончились» (ответ API 429).
 * ТЗ [Продукт] 03.10.2026 17:37 (claude/Продукт_экран_лимита_3_проверок_03.10.md, разд. 2);
 * тексты — с правками [Право · Юрист 115-ФЗ] 03.10 18:10 (claude/Право_экран_лимита_взносы_директора_03.10.md, разд. 1).
 *
 * Один модуль на всех страницах, где проверка упирается в лимит: главная, /pasport/, /pasport/kontragent/,
 * /proverit-schet/, /delopis/, /kontragenty-iz-vypiski/. Текст `detail` из API НЕ выводим: в бете он зовёт
 * купить «Старт», который сейчас не продаётся (ч. 3 ст. 5 38-ФЗ).
 *
 * Бета (meta deloskop-rezhim=beta или tarify.json beta:true; нет tarify.json — тоже бета, без цен):
 *   цен, «Старта», «войдите» нет. После беты — цены только из /tarify/tarify.json.
 * «Войдите» не пишем нигде: вошедшим API лимит не поднимает (◐ ждёт ответа [Выкладки] по коду API).
 *
 * Отложенные ИНН — localStorage `dlk_otlozhennye`, до 5, ТОЛЬКО 10-значные ИНН организаций с верной
 * контрольной цифрой (12-значный ИНН ИП — персональные данные, не пишем). На сервер не уходит.
 * Метрика (через dlkGoal): limit_pokaz {stranica, beta}, limit_klik {kuda}, limit_otlozhennyj.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.dlkLimit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NB = ' ';
  var KEY = 'dlk_otlozhennye', MAX = 5, DNEJ = 30;
  var TARIFY_URL = '/tarify/tarify.json';
  var LIMIT = 3;
  var KONEC_BETY = 'по' + NB + '13' + NB + 'октября';

  var SSYLKI = [
    { kuda: 'schet', t: 'Проверить реквизиты счёта', href: '/proverit-schet/' },
    { kuda: 'skoraya', t: 'Скорая 115-ФЗ' + NB + '— план по' + NB + 'дням', href: '/skoraya-115-fz/' },
    { kuda: 'praktika', t: 'Разборы дел', href: '/praktika/' }
  ];

  function rub(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽'; }

  // контрольная цифра ИНН организации (10 цифр)
  function innOrg(s) {
    s = String(s == null ? '' : s).replace(/\D/g, '');
    if (!/^\d{10}$/.test(s) || /^0+$/.test(s)) return '';
    var k = [2, 4, 10, 3, 5, 9, 4, 6, 8], sum = 0;
    for (var i = 0; i < 9; i++) sum += k[i] * +s[i];
    return (sum % 11) % 10 === +s[9] ? s : '';
  }

  // Что нужно из tarify.json. Нет файла или в нём нет цен — null (показываем бета-вариант без цен).
  function iz(T) {
    if (!T) return null;
    var start = (T.tarify || []).filter(function (t) { return t && t.id === 'start'; })[0];
    var p = T.pasport_razovyj || {};
    return {
      beta: T.beta === true,
      start: start && start.mesyac > 0 ? { nazvanie: start.nazvanie || 'Старт', mesyac: start.mesyac } : null,
      pasport: p.cena_rub > 0 ? { nazvanie: p.nazvanie || 'Паспорт контрагента на дату сделки', cena: p.cena_rub } : null
    };
  }

  /* tekst({tarify, beta, inn, stranica, sohranen}) → {beta, zag, stroka, sohr, ssylkiZag, ssylki[], knopki[]}
   * tarify — iz(tarify.json) или null; beta — режим страницы (главнее файла); inn — что ввёл человек;
   * sohranen — ИНН записан в отложенные. */
  function tekst(o) {
    o = o || {};
    var T = o.tarify || null;
    var beta = !!(o.beta || !T || T.beta || !T.start);
    var inn = innOrg(o.inn);
    var r = {
      beta: beta,
      zag: 'На' + NB + 'сегодня ' + LIMIT + NB + 'бесплатные проверки закончились',
      stroka: '',
      sohr: o.sohranen && inn ? 'ИНН ' + inn + ' сохранили на' + NB + 'этом устройстве' + NB + '— завтра проверим одним нажатием.' : '',
      ssylkiZag: 'Что можно сделать прямо сейчас:',
      ssylki: SSYLKI.filter(function (s) { return s.kuda !== o.stranica; }),
      knopki: []
    };
    if (beta) {
      r.stroka = 'Завтра' + NB + '— снова ' + LIMIT + '. Пока идёт бета (' + KONEC_BETY + '), тарифы не' + NB + 'продаём и' + NB + 'счета не' + NB + 'выставляем.';
      return r;
    }
    r.stroka = 'Завтра' + NB + '— снова ' + LIMIT + '. Без лимита' + NB + '— в' + NB + 'тарифе «' + T.start.nazvanie + '» за' + NB + rub(T.start.mesyac) + ' в' + NB + 'месяц.';
    r.knopki.push({ kuda: 'tarify', t: 'Тарифы', href: '/tarify/#start', primary: true });
    if (inn && T.pasport) r.knopki.push({ kuda: 'pasport', t: T.pasport.nazvanie + NB + '— ' + rub(T.pasport.cena), href: '/schet/?produkt=pasport_razovyj', gost: true });
    return r;
  }

  // ---------- отложенные ИНН (localStorage) ----------
  function hran(w) { try { return w && w.localStorage ? w.localStorage : null; } catch (e) { return null; } }
  function spisok(w, now) {
    var ls = hran(w); if (!ls) return [];
    now = now || Date.now();
    try {
      var a = JSON.parse(ls.getItem(KEY) || '[]');
      if (!Array.isArray(a)) return [];
      return a.filter(function (x) { return x && innOrg(x.inn) === x.inn && x.t > 0 && now - x.t < DNEJ * 864e5; }).slice(0, MAX);
    } catch (e) { return []; }
  }
  function zapisat(w, a) { var ls = hran(w); if (!ls) return false; try { ls.setItem(KEY, JSON.stringify(a)); return true; } catch (e) { return false; } }
  function sohranit(w, inn, now) {
    inn = innOrg(inn);
    if (!inn) return false;
    var a = spisok(w, now).filter(function (x) { return x.inn !== inn; });
    a.unshift({ inn: inn, t: now || Date.now() });
    return zapisat(w, a.slice(0, MAX));
  }
  function ubratInn(w, inn) {
    var a = spisok(w), b = a.filter(function (x) { return x.inn !== String(inn); });
    if (b.length !== a.length) zapisat(w, b);
  }
  function denMsk(t) { return Math.floor((t + 3 * 36e5) / 864e5); }
  // Первый ИНН, отложенный вчера или раньше (по московскому дню). Сегодняшние не напоминаем — лимит ещё не обновился.
  function kNapominaniyu(w, now) {
    now = now || Date.now();
    var d = denMsk(now);
    var x = spisok(w, now).filter(function (x) { return denMsk(x.t) < d; })[0];
    if (!x) return null;
    var vchera = denMsk(x.t) === d - 1;
    return { inn: x.inn, t: x.t, tekst: (vchera ? 'Вчера не' + NB + 'успели проверить: ' : 'Не' + NB + 'успели проверить: ') + x.inn };
  }

  // ---------- браузер ----------
  var kesh = null;
  function tarifyZagruzit(doc) {
    if (kesh) return kesh;
    var w = doc && doc.defaultView;
    kesh = w && w.fetch ? w.fetch(TARIFY_URL).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
    return kesh;
  }
  function betaStranicy(doc) {
    return !!(doc && doc.querySelector && doc.querySelector('meta[name="deloskop-rezhim"][content="beta"]'));
  }
  function cel(w, imya, p) { try { if (w && w.dlkGoal) w.dlkGoal(imya, p); } catch (e) { /* Метрика не мешает */ } }

  var CSS = '.limit{margin-top:12px;background:var(--surface,#F5F5F2);border:1px solid var(--line,#E6E6E1);border-radius:16px;padding:16px 18px;font-size:15px;line-height:1.5;color:var(--ink,#1D1D1F);text-align:left;max-width:100%;box-sizing:border-box}' +
    '.limit__zag{font-size:17px;font-weight:600;line-height:1.35;margin:0 0 4px}' +
    '.limit p{margin:0 0 6px;font-size:15px;line-height:1.5;color:var(--ink2,#3A3A3C)}' +
    '.limit__sohr{color:var(--ink,#1D1D1F)}' +
    '.limit__ss{display:flex;flex-wrap:wrap;gap:4px 18px;margin:2px 0 0;padding:0;list-style:none}' +
    '.limit__ss a{color:var(--accent,#0B63E5);text-decoration:none}.limit__ss a:hover{text-decoration:underline}' +
    '.limit__kn{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}' +
    '.limit__kn a{display:inline-flex;align-items:center;min-height:44px;padding:10px 18px;border-radius:999px;font-weight:600;font-size:15px;text-decoration:none;box-sizing:border-box;max-width:100%}' +
    '.limit__kn .gh{border-radius:14px}.limit__kn .pr{background:var(--accent,#0B63E5);color:#fff}.limit__kn .gh{border:1px solid var(--line,#E6E6E1);color:var(--accent,#0B63E5);background:#fff}' +
    '.limit-vchera{margin-top:8px;font-size:15px;color:var(--ink2,#3A3A3C)}.limit-vchera button{font:inherit;border:0;background:none;padding:0;cursor:pointer}' +
    '.limit-vchera .go{color:var(--accent,#0B63E5)}.limit-vchera .x{color:var(--ink3,#8A8A8E);margin-left:12px;font-size:14px}';
  function stil(doc) {
    if (!doc || doc.getElementById('dlk-limit-css')) return;
    var s = doc.createElement('style'); s.id = 'dlk-limit-css'; s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  // Место для блока — отдельный div[data-limit]: после абзаца статуса (<p class="note"> и т. п.) или внутри div-места
  // (страница потом перезапишет место своим текстом — блок уйдёт вместе с ним, класс места не меняется).
  function mesto(uzel) {
    if (!uzel) return null;
    var doc = uzel.ownerDocument, d;
    if (uzel.tagName === 'P') {
      d = uzel.nextElementSibling;
      if (d && d.getAttribute('data-limit') === '1') return d;
      d = doc.createElement('div'); d.setAttribute('data-limit', '1');
      uzel.parentNode.insertBefore(d, uzel.nextSibling);
      return d;
    }
    uzel.innerHTML = '';
    d = doc.createElement('div'); d.setAttribute('data-limit', '1');
    uzel.appendChild(d);
    return d;
  }
  function ubrat(uzel) {
    if (!uzel) return;
    var d = uzel.tagName === 'P' ? uzel.nextElementSibling : uzel.querySelector('[data-limit="1"]');
    if (d && d.getAttribute('data-limit') === '1' && d.parentNode) d.parentNode.removeChild(d);
  }

  function el(doc, tag, cls, txt) { var e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function narisovat(box, r, o) {
    var doc = box.ownerDocument, w = doc.defaultView;
    box.innerHTML = '';
    box.className = 'limit';
    box.setAttribute('role', 'status');
    box.setAttribute('data-limit-beta', r.beta ? '1' : '0');
    box.appendChild(el(doc, 'p', 'limit__zag', r.zag));
    box.appendChild(el(doc, 'p', '', r.stroka));
    if (r.sohr) box.appendChild(el(doc, 'p', 'limit__sohr', r.sohr));
    if (o.dop) box.appendChild(el(doc, 'p', '', o.dop));
    if (r.knopki.length) {
      var kn = el(doc, 'div', 'limit__kn');
      r.knopki.forEach(function (k) {
        var a = el(doc, 'a', k.primary ? 'pr' : 'gh', k.t); a.href = k.href;
        a.addEventListener('click', function (e) {
          cel(w, 'limit_klik', { kuda: k.kuda });
          // Паспорт: лист оплаты поверх страницы (js/pasport-oplata.js), если он есть; иначе — форма счёта
          if (k.gost && w.PasportOplata && !(e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0)) {
            e.preventDefault();
            w.PasportOplata.otkryt({ nazvanie: o.nazvanie || '', doc: doc }).then(function (ok) { if (!ok) w.location.href = k.href; });
          }
        });
        kn.appendChild(a);
      });
      box.appendChild(kn);
    }
    if (r.ssylki.length) {
      box.appendChild(el(doc, 'p', '', r.ssylkiZag));
      var ul = el(doc, 'ul', 'limit__ss');
      r.ssylki.forEach(function (s) {
        var li = el(doc, 'li'), a = el(doc, 'a', '', s.t); a.href = s.href;
        a.addEventListener('click', function () { cel(w, 'limit_klik', { kuda: s.kuda }); });
        li.appendChild(a); ul.appendChild(li);
      });
      box.appendChild(ul);
    }
  }

  /* pokazat(uzel, {stranica, inn, nazvanie?, dop?}) → Promise. Сразу рисует бета-вариант (без цен),
   * затем — точный по tarify.json. uzel — div-место или абзац статуса (блок встанет после него). */
  function pokazat(uzel, o) {
    o = o || {};
    var box = mesto(uzel);
    if (!box) return Promise.resolve(null);
    var doc = box.ownerDocument, w = doc.defaultView;
    stil(doc);
    var sohranen = sohranit(w, o.inn);
    var beta = betaStranicy(doc);
    narisovat(box, tekst({ beta: true, inn: o.inn, stranica: o.stranica, sohranen: sohranen }), o);
    return tarifyZagruzit(doc).then(function (T) {
      var r = tekst({ tarify: iz(T), beta: beta, inn: o.inn, stranica: o.stranica, sohranen: sohranen });
      if (!r.beta) narisovat(box, r, o);
      cel(w, 'limit_pokaz', { stranica: o.stranica || '', beta: r.beta ? 1 : 0 });
      return r;
    }).catch(function () { return null; });
  }

  /* napomnit(uzel, proverit) — главная, строка под полем: «Вчера не успели проверить: ИНН ›».
   * proverit(inn) — обычная проверка; после успешной страница сама зовёт dlkLimit.proveren(inn). */
  function napomnit(uzel, proverit) {
    if (!uzel) return null;
    var doc = uzel.ownerDocument, w = doc.defaultView;
    var x = kNapominaniyu(w);
    if (!x) return null;
    stil(doc);
    var p = el(doc, 'p', 'limit-vchera');
    p.setAttribute('data-limit-vchera', '1');
    var b = el(doc, 'button', 'go', x.tekst + NB + '›'); b.type = 'button';
    b.addEventListener('click', function () { cel(w, 'limit_otlozhennyj'); if (p.parentNode) p.parentNode.removeChild(p); proverit(x.inn); });
    var u = el(doc, 'button', 'x', 'Убрать'); u.type = 'button';
    u.addEventListener('click', function () { ubratInn(w, x.inn); if (p.parentNode) p.parentNode.removeChild(p); });
    p.appendChild(b); p.appendChild(u);
    uzel.parentNode.insertBefore(p, uzel.nextSibling);
    return x;
  }
  // Проверка прошла — ИНН больше не «отложенный».
  function proveren(inn, w) { ubratInn(w || (typeof window !== 'undefined' ? window : null), String(inn || '').replace(/\D/g, '')); }

  return {
    tekst: tekst, iz: iz, innOrg: innOrg, rub: rub,
    spisok: spisok, sohranit: sohranit, kNapominaniyu: kNapominaniyu, ubratInn: ubratInn,
    pokazat: pokazat, napomnit: napomnit, proveren: proveren, ubrat: ubrat, mesto: mesto,
    KEY: KEY, MAX: MAX, LIMIT: LIMIT
  };
});
