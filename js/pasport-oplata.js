/*
 * Делоскоп — «Паспорт 490 ₽ в один шаг», лист оплаты (ТЗ [Продукт] 02.10.2026,
 * claude/Продукт_Паспорт_490_в_один_шаг_однофамилец_02.10.md, разд. 1.2–1.4).
 *
 * Лист выезжает справа (на телефоне — снизу) поверх отчёта: человек не уходит с экрана проверки.
 * Внутри: «Паспорт контрагента на ДД.ММ.ГГГГ» + название из отчёта → 4 строки «что внутри» →
 * цена крупно (из /tarify/tarify.json, в коде чисел нет) + «без НДС» → способы оплаты → оговорка [Право].
 * Способы: онлайн-кнопки — только когда в tarify.json появится `sposoby` (провайдер ещё не подключён,
 * выдуманных кнопок не рисуем); всегда — «Компании и ИП — оплата по счёту»: прежняя форма счёта
 * (js/schet.js, без изменений) открывается прямо в листе.
 * В бете лист не открывается вовсе (кнопка в бете ведёт на бесплатный Паспорт — js/pasport-cta.js).
 * Метрика (разд. 1.4): oplata_start{produkt, sposob}; ИНН и e-mail в параметры не передаём (152-ФЗ).
 * Чистые функции (model, html) — без DOM и сети, их проверяет tests/pasport_oplata.test.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PasportOplata = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NB = '\u00a0';
  var TARIFY_URL = '/tarify/tarify.json';
  var SCHET_JS = '/js/schet.js';
  // Что внутри (разд. 1.2, дословно)
  var VNUTRI = [
    'Все признаки — с источником и датой',
    'Комментарий команды к сигналам, где он есть',
    'PDF с QR-кодом: проверить подлинность может любой',
    'Хранится в Кабинете — часть доказательств вашей осмотрительности'
  ];
  // Оговорка [Право] 02.10 12:30, разд. 1; номер пункта — по оферте с разовыми покупками (п. 3.7, oferta-razovye-v1)
  var OGOVORKA = 'Оплачивая, вы принимаете оферту (п.' + NB + '3.7). Если Паспорт не сформирован или в нём ошибка по нашей вине, исправим за 3 рабочих дня, не исправим — вернём оплату.';
  var PO_SCHETU = 'Компании и ИП — оплата по счёту';

  function rub(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽'; }
  function z(n) { return (n < 10 ? '0' : '') + n; }
  // дата «сегодня» по Москве (UTC+3) — Паспорт формируется на дату сделки
  function segodnya(now) {
    var d = new Date((now == null ? Date.now() : +new Date(now)) + 3 * 3600 * 1000);
    return z(d.getUTCDate()) + '.' + z(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* model(T, {nazvanie, now}) → null (бета / нет цены) или {zag, nazvanie, vnutri[], cena, nds, sposoby[], poSchetu, ogovorka, produkt}
   * T — разобранный tarify.json. sposoby — из T.sposoby: [{id, nazvanie, href}] только с адресом https. */
  function model(T, o) {
    o = o || {};
    if (!T || T.beta === true) return null;
    var p = T.pasport_razovyj;
    if (!p || !(p.cena_rub > 0)) return null;
    var sp = (Array.isArray(T.sposoby) ? T.sposoby : []).filter(function (s) {
      return s && s.nazvanie && /^https:\/\//.test(String(s.href || ''));
    }).map(function (s) { return { id: String(s.id || ''), nazvanie: String(s.nazvanie), href: String(s.href) }; });
    return {
      produkt: 'pasport_razovyj',
      zag: 'Паспорт контрагента на' + NB + segodnya(o.now),
      nazvanie: String(o.nazvanie || '').trim(),
      vnutri: VNUTRI.slice(),
      cena: rub(p.cena_rub),
      nds: 'без НДС',
      sposoby: sp,
      poSchetu: PO_SCHETU,
      ogovorka: OGOVORKA
    };
  }

  function html(m) {
    if (!m) return '';
    return '<header class="po-hd"><h2 class="po-zag" id="po-zag" tabindex="-1">' + esc(m.zag) + '</h2>' +
      (m.nazvanie ? '<p class="po-naz">' + esc(m.nazvanie) + '</p>' : '') + '</header>' +
      '<ul class="po-vn">' + m.vnutri.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      '<p class="po-cena"><b class="n">' + esc(m.cena) + '</b><span>' + esc(m.nds) + '</span></p>' +
      (m.sposoby.length ? '<div class="po-sp">' + m.sposoby.map(function (s, i) {
        return '<a class="btn' + (i === 0 ? ' p' : '') + '" href="' + esc(s.href) + '" data-sposob="' + esc(s.id) + '" rel="noopener">' + esc(s.nazvanie) + '</a>';
      }).join('') + '</div>' : '') +
      '<button type="button" class="po-schet' + (m.sposoby.length ? '' : ' po-schet--gl') + '" data-po-schet aria-expanded="false">' + esc(m.poSchetu) + '</button>' +
      '<div class="po-forma" data-po-forma hidden></div>' +
      '<p class="po-og">' + esc(m.ogovorka).replace('оферту', '<a href="/oferta/#razovye" target="_blank" rel="noopener">оферту</a>') + '</p>';
  }

  // ---------- браузер ----------
  var kesh = null, dlg = null, schetGruzim = null;
  function tarify(doc) {
    if (kesh) return kesh;
    var w = doc.defaultView, el = doc.getElementById && doc.getElementById('tarify-data');
    if (el) { try { kesh = Promise.resolve(JSON.parse(el.textContent)); return kesh; } catch (e) { /* дальше — по сети */ } }
    kesh = w && w.fetch ? w.fetch(TARIFY_URL).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
    return kesh;
  }
  function cel(w, imya, p) { try { if (w && w.dlkGoal) w.dlkGoal(imya, p); } catch (e) { /* Метрика не мешает */ } }
  function schet(doc) {
    var w = doc.defaultView;
    if (w.DeloskopSchet) return Promise.resolve(w.DeloskopSchet);
    if (schetGruzim) return schetGruzim;
    schetGruzim = new Promise(function (ok, ne) {
      var s = doc.createElement('script'); s.src = SCHET_JS; s.async = true;
      s.onload = function () { w.DeloskopSchet ? ok(w.DeloskopSchet) : ne(new Error('schet')); };
      s.onerror = function () { schetGruzim = null; ne(new Error('schet')); };
      doc.head.appendChild(s);
    });
    return schetGruzim;
  }

  /* otkryt({nazvanie, doc?}) → Promise<boolean>: true — лист открыт; false — открыть нельзя (бета, нет цены,
   * нет <dialog>) — тогда вызывающий оставляет обычный переход по ссылке на /schet/. */
  function otkryt(o) {
    o = o || {};
    var doc = o.doc || (typeof document !== 'undefined' ? document : null);
    if (!doc || !doc.defaultView || !doc.defaultView.HTMLDialogElement) return Promise.resolve(false);
    var w = doc.defaultView;
    return tarify(doc).then(function (T) {
      var m = model(T, { nazvanie: o.nazvanie });
      if (!m) return false;
      if (!dlg) {
        dlg = doc.createElement('dialog'); dlg.className = 'po';
        dlg.setAttribute('aria-labelledby', 'po-zag');
        doc.body.appendChild(dlg);
        dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
        dlg.addEventListener('close', function () { doc.documentElement.style.overflow = ''; });
      }
      dlg.classList.remove('po--schet');
      dlg.innerHTML = '<button type="button" class="po-x" aria-label="Закрыть">×</button>' + html(m);
      dlg.querySelector('.po-x').onclick = function () { dlg.close(); };
      Array.prototype.forEach.call(dlg.querySelectorAll('[data-sposob]'), function (a) {
        a.addEventListener('click', function () { cel(w, 'oplata_start', { produkt: 'razovyj', sposob: a.getAttribute('data-sposob') || '' }); });
      });
      var b = dlg.querySelector('[data-po-schet]'), box = dlg.querySelector('[data-po-forma]');
      b.onclick = function () {
        if (!box.hidden) return;
        cel(w, 'oplata_start', { produkt: 'razovyj', sposob: 'schet' });
        b.setAttribute('aria-expanded', 'true');
        schet(doc).then(function (S) {
          box.hidden = false; b.hidden = true; dlg.classList.add('po--schet');   // сумма — в форме счёта, без повтора
          var f = S.forma(box, { produkt: m.produkt }, true);
          try { f.fokus(); } catch (e) { /* фокус не обязателен */ }
        }).catch(function () { w.location.href = '/schet/?produkt=' + m.produkt; });
      };
      doc.documentElement.style.overflow = 'hidden';
      dlg.showModal();
      try { dlg.querySelector('#po-zag').focus(); } catch (e) { /* фокус не обязателен */ }
      return true;
    }).catch(function () { return false; });
  }

  return { model: model, html: html, otkryt: otkryt, segodnya: segodnya, rub: rub, VNUTRI: VNUTRI, OGOVORKA: OGOVORKA, PO_SCHETU: PO_SCHETU };
});
