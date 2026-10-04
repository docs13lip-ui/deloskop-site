/*
 * Делоскоп — «Паспорт 490 ₽ в один шаг»: кнопка Паспорта контрагента по состояниям
 * (ТЗ [Продукт] 02.10.2026, claude/Продукт_Паспорт_490_в_один_шаг_однофамилец_02.10.md, разд. 1.1, 1.3, 1.4).
 *
 * Состояния (тексты — дословно из ТЗ; цены и названия — только из /tarify/tarify.json, в коде чисел нет):
 *   beta    — бета: «Паспорт контрагента» + «В бете — бесплатно. После 13.10 — 490 ₽ или в тарифе «Старт».» Кнопки оплаты нет.
 *   gost    — гость / бесплатный: «Паспорт на дату сделки — 490 ₽» + «Без подписки. PDF с QR-кодом, хранится в Кабинете.» + «3 проверки — 990 ₽».
 *   paket   — есть пакет: «Сформировать Паспорт» + «Осталось N из 3 · до ДД.ММ.ГГГГ».
 *   tarif   — «Старт» и выше: «Сформировать Паспорт» + «Входит в ваш тариф».
 *   gotov   — Паспорт на эту дату уже есть: «Открыть Паспорт № …» + «Сформирован ДД.ММ.ГГГГ в ЧЧ:ММ».
 * Лист оплаты (разд. 1.2) — js/pasport-oplata.js: кнопка гостя открывает его поверх отчёта (счёт — прямо в листе);
 * без модуля или <dialog> — прежний переход в форму счёта (/schet/?produkt=pasport_razovyj); ссылка пакета — /schet/?produkt=paket_pasportov.
 * Метрика (разд. 1.4): pasport_cta_view{mesto, sost} при показе, pasport_cta_click{mesto, sost} по нажатию.
 * ИНН и e-mail в параметры не передаём (ИНН ИП — персональные данные, 152-ФЗ).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PasportCta = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NB = '\u00a0';
  var TARIFY_URL = '/tarify/tarify.json';
  var PLATNYE = { start: 1, pro: 1, business: 1, biznes: 1, team: 1 };
  var KONEC_BETY = '13.10';

  function rub(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽';
  }
  function z(n) { return (n < 10 ? '0' : '') + n; }
  function dataRu(v) {
    if (!v) return '';
    var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[3] + '.' + m[2] + '.' + m[1];
    return /^\d{2}\.\d{2}\.\d{4}$/.test(String(v)) ? String(v) : '';
  }
  function vremyaRu(v) {
    // только дата («2026-10-04») — без времени: полночь UTC иначе вышла бы «в 03:00» (vremya-proverki-v1)
    if (/^\s*\d{4}-\d{2}-\d{2}\s*$/.test(String(v || ''))) return dataRu(String(v).trim());
    var d = new Date(v);
    if (!v || isNaN(d)) return '';
    // время — по Москве (UTC+3, без перехода на летнее время)
    var m = new Date(d.getTime() + 3 * 3600 * 1000);
    return z(m.getUTCDate()) + '.' + z(m.getUTCMonth() + 1) + '.' + m.getUTCFullYear() + ' в ' + z(m.getUTCHours()) + ':' + z(m.getUTCMinutes());
  }

  // Что нужно из tarify.json: цена разового Паспорта, пакет (штук и цена), название первого платного тарифа.
  function iz(T) {
    if (!T || !T.pasport_razovyj || !(T.pasport_razovyj.cena_rub > 0)) return null;
    var p = T.paket_pasportov || {};
    var start = (T.tarify || []).filter(function (t) { return t.id === 'start'; })[0];
    return {
      beta: T.beta === true,
      cena: T.pasport_razovyj.cena_rub,
      paketShtuk: p.shtuk > 0 ? p.shtuk : null,
      paketCena: p.cena_rub > 0 ? p.cena_rub : null,
      start: start ? start.nazvanie : null
    };
  }

  /* sostoyanie({tarify, beta, user, gotov}) → {sost, knopka, stroka, ssylka?:{t, href}, href}
   * tarify — разобранный iz(tarify.json); beta — режим страницы (meta deloskop-rezhim), он главнее;
   * user — ответ /api/me .user (plan, paket:{ostalos, vsego, do}); gotov — {nomer, sformirovan, url}. */
  function sostoyanie(o) {
    o = o || {};
    var T = o.tarify, u = o.user || null, inn = String(o.inn || '').replace(/\D/g, '');
    var put = '/pasport/kontragent/?inn=' + inn;
    var g = o.gotov;
    if (g && g.nomer) {
      var kogda = vremyaRu(g.sformirovan);
      return { sost: 'gotov', knopka: 'Открыть Паспорт № ' + g.nomer, stroka: kogda ? 'Сформирован ' + kogda : '', href: g.url || put };
    }
    if (o.beta || (T && T.beta)) {
      var s = 'В бете — бесплатно.';
      if (T && T.start) s += ' После ' + KONEC_BETY + ' — ' + rub(T.cena) + ' или в тарифе «' + T.start + '».';
      return { sost: 'beta', knopka: 'Паспорт контрагента', stroka: s, href: put };
    }
    var plan = u && u.plan ? String(u.plan) : '';
    if (PLATNYE[plan]) return { sost: 'tarif', knopka: 'Сформировать Паспорт', stroka: 'Входит в ваш тариф', href: put };
    var pk = u && u.paket;
    if (pk && pk.ostalos > 0) {
      var vsego = pk.vsego > 0 ? pk.vsego : (T && T.paketShtuk) || pk.ostalos;
      var dd = dataRu(pk['do']);
      return { sost: 'paket', knopka: 'Сформировать Паспорт', stroka: 'Осталось ' + pk.ostalos + ' из ' + vsego + (dd ? ' · до ' + dd : ''), href: put };
    }
    if (!T) return { sost: 'nejzvestno', knopka: 'Паспорт контрагента', stroka: '', href: put };
    var r = { sost: 'gost', knopka: 'Паспорт на дату сделки — ' + rub(T.cena), stroka: 'Без подписки. PDF с QR-кодом, хранится в Кабинете.', href: '/schet/?produkt=pasport_razovyj' };
    if (T.paketShtuk && T.paketCena) r.ssylka = { t: T.paketShtuk + ' проверки — ' + rub(T.paketCena), href: '/schet/?produkt=paket_pasportov' };
    return r;
  }

  // ---------- браузер ----------
  var kesh = null;
  function zagruzit(doc) {
    if (kesh) return kesh;
    var w = doc && doc.defaultView;
    var el = doc && doc.getElementById && doc.getElementById('tarify-data');
    if (el) { try { kesh = Promise.resolve(JSON.parse(el.textContent)); return kesh; } catch (e) { /* дальше — по сети */ } }
    kesh = w && w.fetch ? w.fetch(TARIFY_URL).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
    return kesh;
  }
  function betaStranicy(doc) {
    return !!(doc && doc.querySelector && doc.querySelector('meta[name="deloskop-rezhim"][content="beta"]'));
  }
  function cel(w, imya, p) { try { if (w && w.dlkGoal) w.dlkGoal(imya, p); } catch (e) { /* Метрика не мешает */ } }

  // Нарисовать состояние на уже стоящей кнопке a (полоса вывода листа или карточка /company/).
  function primenit(a, s, mesto, nazvanie) {
    var doc = a.ownerDocument, w = doc.defaultView;
    if (nazvanie) a.setAttribute('data-naz', String(nazvanie).slice(0, 200));
    a.textContent = s.knopka;
    a.setAttribute('href', s.href);
    a.setAttribute('data-sost', s.sost);
    var box = a.parentNode && a.parentNode.querySelector('.pcta[data-dlya="' + (a.getAttribute('data-cel') || '') + '"]');
    if (box) box.parentNode.removeChild(box);
    if (s.stroka || s.ssylka) {
      box = doc.createElement('p');
      box.className = 'pcta';
      box.setAttribute('data-dlya', a.getAttribute('data-cel') || '');
      if (s.stroka) box.appendChild(doc.createTextNode(s.stroka));
      if (s.ssylka) {
        if (s.stroka) box.appendChild(doc.createTextNode(' '));
        var l = doc.createElement('a');
        l.href = s.ssylka.href; l.textContent = s.ssylka.t;
        box.appendChild(l);
      }
      a.parentNode.insertBefore(box, a.nextSibling);
    }
    cel(w, 'pasport_cta_view', { mesto: mesto, sost: s.sost });
    if (!a.getAttribute('data-pcta')) {
      a.setAttribute('data-pcta', '1');
      a.addEventListener('click', function (e) {
        var sost = a.getAttribute('data-sost') || '';
        cel(w, 'pasport_cta_click', { mesto: mesto, sost: sost });
        // гость: лист оплаты поверх отчёта (js/pasport-oplata.js); не открылся — обычный переход по ссылке
        if (sost !== 'gost' || !w.PasportOplata || e.ctrlKey || e.metaKey || e.shiftKey || e.button > 0) return;
        e.preventDefault();
        var href = a.getAttribute('href');
        w.PasportOplata.otkryt({ nazvanie: a.getAttribute('data-naz') || '', doc: doc }).then(function (ok) { if (!ok) w.location.href = href; });
      });
    }
    return s;
  }

  /* mount(a, {inn, mesto, nazvanie?, user?, gotov?}) → Promise<состояние>. Сразу — бета или «Паспорт контрагента»,
   * после загрузки tarify.json и /api/me — точное состояние. Ошибка сети — кнопка остаётся как была. */
  function mount(a, o) {
    o = o || {};
    if (!a || !a.ownerDocument) return Promise.resolve(null);
    var doc = a.ownerDocument, beta = betaStranicy(doc), mesto = o.mesto || 'list';
    var user = o.user ? Promise.resolve(o.user) : (beta || !o.api ? Promise.resolve(null)
      : doc.defaultView.fetch(o.api + '/api/me', { credentials: 'include' }).then(function (r) { return r.json(); }).then(function (j) { return j && j.user || null; }).catch(function () { return null; }));
    return Promise.all([zagruzit(doc), user]).then(function (x) {
      return primenit(a, sostoyanie({ tarify: iz(x[0]), beta: beta, user: x[1], gotov: o.gotov, inn: o.inn }), mesto, o.nazvanie);
    }).catch(function () { return null; });
  }

  return { sostoyanie: sostoyanie, iz: iz, rub: rub, dataRu: dataRu, vremyaRu: vremyaRu, mount: mount, primenit: primenit, KONEC_BETY: KONEC_BETY };
});
