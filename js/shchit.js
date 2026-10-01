/*!
 * Делоскоп · Щит — своя компания глазами банка и налоговой.
 * Работает поверх ответа /api/check, без запросов на сервер (как usloviya.js).
 * Признаки берёт из Usloviya.facts / Usloviya.kindOf — второго классификатора нет.
 * Три блока: «Как вас видит банк», «Как вас видит налоговая», «Что сделать сейчас» (до 3 шагов + «Следить»).
 * Тексты — ТЗ [Продукт] 01.10 (claude/Продукт_Щит_свой_взгляд_и_ответы_✎_01.10.md, разд. 2.3).
 * Ссылка на норму в скобках выводится только у строк, сверенных [Право] (sver: true) — флаг SVERENO.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Shchit = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  // Включить все нормы разом — после «да» [Право] на ◐-строки (или поставить sver: true у конкретной строки).
  var SVERENO = false;

  var CBR_ZSK = 'https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/';

  // b — «Как вас видит банк», n — «Как вас видит налоговая», s — «Что сделать».
  // Строка: { t: текст, norma: '(…)' — только у сверенных; sver: true — сверено [Право] / уже на живом }.
  var T = {
    zsk: {
      b: { t: 'По открытым данным у компании есть признаки, по которым банки относят клиентов к повышенному риску. Это наш прогноз, не статус Банка России.', sver: true },
      s: { t: 'Проверьте себя в сервисе Банка России — он показывает только «красную» зону. Если она есть, на заявление в МВК — 6 месяцев', norma: '(п. 1 ст. 7.8 115-ФЗ)', sver: true,
           href: CBR_ZSK, knopka: 'Проверить в сервисе Банка России', ext: true, eshche: { href: '/skoraya-115-fz/?s=zsk', t: 'План, если зона красная' } }
    },
    nedost: {
      b: { t: 'Отметка о недостоверности в ЕГРЮЛ — признак, на который банки обращают внимание в первую очередь.' },
      n: { t: 'Если не исправить, через 6 месяцев после отметки инспекция может исключить компанию из ЕГРЮЛ', norma: '(пп. «б» п. 5 ст. 21.1 129-ФЗ)', tolkoUL: true },
      s: { t: 'Подайте исправленные или подтверждающие сведения в инспекцию.', href: '/nalogi/nedostovernyj-adres-egryul/', knopka: 'Как снять недостоверность' }
    },
    mass: {
      b: { t: 'Массовый адрес или руководитель — признак, по которому банки ищут «технические» компании.' },
      n: { t: 'Массовый адрес или руководитель — признак, по которому инспекция ищет «технические» компании.' },
      s: { t: 'Держите под рукой договор аренды и фото офиса или вывески — их просят первыми.', href: '/nalogi/priznaki-tehnicheskoj-kompanii/', knopka: 'Признаки «технической» компании' }
    },
    young: {
      b: { t: 'У компании младше года нет истории — банк внимательнее к каждой крупной операции.' },
      s: { t: 'Первые месяцы — без транзита «пришло и ушло в тот же день»; к каждому крупному платежу — договор и акт.', href: '/115-fz/zapros-banka-po-115-fz-kak-otvetit/', knopka: 'Как отвечать на запрос банка' }
    },
    staff: {
      b: { t: 'Оборот без сотрудников банк сверяет с видом деятельности.' },
      n: { t: 'Работы и услуги без людей — частый вопрос о реальности сделок', norma: '(ст. 54.1 НК РФ)' },
      s: { t: 'Работаете с подрядчиками или самозанятыми — храните договоры и акты к каждому платежу.', href: '/nalogi/statya-54-1-nk-prostymi-slovami/', knopka: 'Статья 54.1 НК простыми словами' }
    },
    nagruzka: {
      b: { t: 'Налоги, малые по сравнению с оборотом, банки замечают.' },
      n: { t: 'Нагрузка ниже средней по отрасли — один из критериев отбора для выездной проверки.' },
      s: { t: 'Подготовьте короткое объяснение: сезонность, вложения, убыток прошлого года.' }
    },
    dolg: {
      b: { t: 'Долг по налогам может закончиться приостановкой операций по счёту', norma: '(ст. 76 НК РФ)' },
      n: { t: 'Долг растёт пенями каждый день.', sver: true },
      s: { t: 'Сверьте единый налоговый счёт в личном кабинете и погасите долг до требования.' }
    },
    fssp: {
      b: { t: 'По исполнительному листу банк спишет деньги со счёта сам.' },
      s: { t: 'Закройте долг и попросите постановление об окончании производства.' }
    },
    report: {
      n: { t: 'Нет отчётности и операций 12 месяцев — компанию могут исключить из ЕГРЮЛ как недействующую', norma: '(п. 1 ст. 21.1 129-ФЗ)', tolkoUL: true },
      s: { t: 'Сдайте отчётность, даже нулевую.' }
    },
    director: {
      b: { t: 'После смены руководителя банк обновляет сведения о клиенте и может запросить документы.' },
      s: { t: 'Обновите анкету в банке сами, не дожидаясь запроса.' }
    },
    // block / diskv / exit / rnp / fines / other — строка признака как есть, шаг — «Скорая».
    skoraya: { t: 'Если банк уже прислал запрос или ограничил счёт — план по дням.', sver: true, href: '/skoraya-115-fz/', knopka: 'Открыть план по дням' },
    sled: { t: 'Следить за своей компанией — сообщим, если в реестрах что-то изменится.', href: '/cabinet.html', knopka: 'Следить за компанией', sled: true }
  };
  // Куда идут признаки без своего текста: банк или налоговая.
  var KAK_EST = { block: 'b', rnp: 'b', other: 'b', diskv: 'n', exit: 'n', fines: 'n' };
  // Порядок шагов (ТЗ 2.3) + признаки «как есть» в конце.
  var PORYADOK = ['block', 'zsk', 'dolg', 'fssp', 'nedost', 'report', 'mass', 'staff', 'nagruzka', 'director', 'young', 'diskv', 'exit', 'rnp', 'other', 'fines'];
  var MAX_SHAGOV = 3;
  var ST = { LIQUIDATING: 'Компания ликвидируется или ФНС готовит её исключение из ЕГРЮЛ', LIQUIDATED: 'Компания ликвидирована', BANKRUPT: 'Идёт банкротство', REORGANIZING: 'Идёт реорганизация' };

  function tekst(x) { return x.norma && (x.sver || SVERENO) ? x.t + ' ' + x.norma + '.' : (/[.!?»]$/.test(x.t) ? x.t : x.t + '.'); }
  function reestr(t, ul) { return ul ? t : t.replace(/ЕГРЮЛ/g, 'ЕГРИП'); }   // у ИП свой реестр
  function U(o) { return (o && o.usloviya) || (root && root.Usloviya) || (typeof require === 'function' ? require('./usloviya.js') : null); }
  function dataRu(s) { var d = new Date(s || Date.now()); if (isNaN(d)) d = new Date(); function z(n) { return (n < 10 ? '0' : '') + n; } return z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear(); }
  function nbsp(t) { return String(t).replace(/(\d) (?=\d{3}(\D|$))/g, '$1\u00a0').replace(/ ₽/g, '\u00a0₽'); }
  function nazvanie(x) { var d = nbsp(String(x.detail || '').trim()); return /^(да|есть|внимание|нет данных|—|)$/i.test(d) ? x.title : x.title + ': ' + d.charAt(0).toLowerCase() + d.slice(1); }

  // razbor(r) → { banki, nalogovaya, shagi, chisto, neProvereno, ul, data }
  function razbor(r, o) {
    var Us = U(o); if (!Us) throw new Error('shchit: нет Usloviya');
    r = r || {};
    var f = Us.facts(r), np = Us.neProvereno(r, f), ul = f.kind !== 'INDIVIDUAL';
    var est = {};                                 // kind → строка признака (название · деталь) из ответа API
    f.list.forEach(function (x) { if (!est[x.kind] || x.status === 'bad') est[x.kind] = nazvanie(x); });
    if (f.zsk === 'high' || f.zsk === 'medium') est.zsk = 'Прогноз ЗСК — ' + (f.zsk === 'high' ? 'высокий' : 'средний') + ' · наша оценка';
    if ((f.warn.young || f.bad.young) && !est.young) est.young = 'Компании меньше года';
    if ((f.staff === 0 || f.staff === 1) && !est.staff) est.staff = f.staff ? 'В штате 1 человек' : 'В штате никого';
    if (ST[f.status] && !est.exit) est.exit = ST[f.status];

    var banki = [], nalogovaya = [], kinds = [];
    PORYADOK.forEach(function (k) {
      if (!est[k]) return;
      kinds.push(k);
      var t = T[k];
      if (t) {
        if (t.b && !(t.b.tolkoUL && !ul)) banki.push({ kind: k, priznak: est[k], pochemu: reestr(tekst(t.b), ul) });
        if (t.n && !(t.n.tolkoUL && !ul)) nalogovaya.push({ kind: k, priznak: est[k], pochemu: reestr(tekst(t.n), ul) });
      } else if (KAK_EST[k]) {
        (KAK_EST[k] === 'b' ? banki : nalogovaya).push({ kind: k, priznak: est[k], pochemu: '' });
      }
    });
    // ИП: признак report/nedost без строки в «налоговой» не теряется — показываем его хотя бы в банке как есть.
    kinds.forEach(function (k) {
      var vezde = banki.concat(nalogovaya).some(function (x) { return x.kind === k; });
      if (!vezde) banki.push({ kind: k, priznak: est[k], pochemu: '' });
    });

    var shagi = [], bylo = {};
    kinds.forEach(function (k) {
      if (shagi.length >= MAX_SHAGOV) return;
      var s = T[k] && T[k].s ? T[k].s : T.skoraya;
      var key = s === T.skoraya ? 'skoraya' : k;
      if (bylo[key]) return; bylo[key] = 1;
      shagi.push({ kind: key, t: tekst(s), href: s.href || '', knopka: s.knopka || '', ext: !!s.ext, eshche: s.eshche || null });
    });
    shagi.push({ kind: 'sled', t: T.sled.t, href: T.sled.href, knopka: T.sled.knopka, sled: true });

    return { banki: banki, nalogovaya: nalogovaya, shagi: shagi, chisto: !kinds.length, neProvereno: np, ul: ul, data: dataRu(r.checked_at), imya: f.name };
  }

  // Главное действие — одна кнопка: первый шаг со ссылкой, иначе «Следить».
  function glavnyj(R) { for (var i = 0; i < R.shagi.length; i++) if (R.shagi[i].href) return R.shagi[i]; return R.shagi[R.shagi.length - 1]; }

  // Короткий текст для «Скопировать разбор».
  function kratko(R) {
    var p = R.chisto ? 'Заметных признаков в открытых данных нет' : 'Признаков: ' + (R.banki.length + R.nalogovaya.length);
    var sh = R.shagi.filter(function (s) { return !s.sled; }).map(function (s, i) { return (i + 1) + '. ' + s.t; }).join(' ');
    return R.imya + ' — глазами банка и налоговой на ' + R.data + '. ' + p + '.' + (sh ? ' Что сделать: ' + sh : '');
  }

  var CSS = '' +
    '.shch{display:flex;flex-direction:column;gap:18px;color:var(--ink,#1D1D1F)}' +
    '.shch-oh{margin:0;font-size:13.5px;color:var(--muted,#6B6B70);max-width:68ch}' +
    '.shch-b{display:flex;flex-direction:column;gap:8px}' +
    '.shch-b h3{margin:0;font-size:17px;line-height:1.3;font-weight:600;letter-spacing:-.01em}' +
    '.shch-b ul,.shch-b ol{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px}' +
    '.shch-b li{background:var(--bg,#F5F5F2);border-radius:14px;padding:12px 14px;max-width:68ch}' +
    '.shch-b li b{display:block;font-size:15px;font-weight:600;line-height:1.35}' +
    '.shch-b li span{display:block;margin-top:3px;font-size:14.5px;line-height:1.45;color:var(--ink2,#48484C)}' +
    '.shch-b li a{font-size:14.5px}' +
    '.shch-sh{counter-reset:sh}' +
    '.shch-sh li{position:relative;padding-left:44px}' +
    '.shch-sh li:before{counter-increment:sh;content:counter(sh);position:absolute;left:14px;top:12px;width:20px;height:20px;border-radius:50%;background:var(--card,#fff);font-size:12.5px;font-weight:600;line-height:20px;text-align:center;color:var(--ink2,#48484C)}' +
    '.shch-sh li.shch-sled:before{content:"";background:var(--accent,#0B63E5);box-shadow:inset 0 0 0 6px var(--card,#fff)}' +
    '.shch-sh li span{margin-top:0;color:var(--ink,#1D1D1F)}' +
    '.shch-pusto{margin:0;font-size:15px;color:var(--ink2,#48484C);max-width:68ch}' +
    '.shch-ne{margin:0;font-size:14px;color:#8A5A00;background:#FFF6E0;border-radius:10px;padding:8px 10px;max-width:68ch}' +
    '.shch-k{display:inline-flex;align-items:center;justify-content:center;align-self:flex-start;border-radius:999px;background:var(--accent,#0B63E5);color:#fff!important;font-weight:600;font-size:15px;padding:12px 22px;min-height:44px;text-decoration:none;max-width:100%;text-align:center}' +
    '.shch-k:hover{background:var(--accent-hover,#084BB0)}';

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ssylka(href, t, ext, cls) { return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(t) + '</a>'; }

  function html(R) {
    function blok(zag, spisok) {
      if (!spisok.length) return '';
      return '<div class="shch-b"><h3>' + zag + '</h3><ul>' + spisok.map(function (x) {
        return '<li><b>' + esc(x.priznak) + '</b>' + (x.pochemu ? '<span>' + esc(x.pochemu) + '</span>' : '') + '</li>';
      }).join('') + '</ul></div>';
    }
    var g = glavnyj(R);
    var sh = '<div class="shch-b"><h3>Что сделать сейчас</h3><ol class="shch-sh">' + R.shagi.map(function (s) {
      var dop = [];
      if (s.href && s !== g) dop.push(ssylka(s.href, s.knopka, s.ext));
      if (s.eshche) dop.push(ssylka(s.eshche.href, s.eshche.t));
      return '<li' + (s.sled ? ' class="shch-sled"' : '') + '><span>' + esc(s.t) + (dop.length ? ' ' + dop.join(' · ') : '') + '</span></li>';
    }).join('') + '</ol></div>';
    var np = R.neProvereno && R.neProvereno.spisok && R.neProvereno.spisok.length ? '<p class="shch-ne">Не проверяли: ' + esc(R.neProvereno.spisok.join(', ')) + '. Это не значит, что их нет.</p>' : '';
    return '<section class="shch" aria-label="Ваша компания глазами банка и налоговой">' +
      '<p class="shch-oh">Это наша оценка по открытым данным, а не решение банка или инспекции. Банк видит ваши операции — мы нет.</p>' +
      (R.chisto ? '<p class="shch-pusto">В открытых данных заметных признаков не нашли. Это не гарантия: банк смотрит и на ваши операции.</p>' : '') +
      blok('Как вас видит банк', R.banki) + blok('Как вас видит налоговая', R.nalogovaya) + np + sh +
      ssylka(g.href, g.knopka, g.ext, 'shch-k') + '</section>';
  }

  // mount(el, r) — рисует разбор в el. Цель Метрики shchit_sled — клик по «Следить».
  function mount(el, r, o) {
    if (!r || !r.company || !r.company.inn) throw new Error('shchit: нет данных о компании');
    var doc = el.ownerDocument;
    if (!doc.getElementById('shch-css')) { var s = doc.createElement('style'); s.id = 'shch-css'; s.textContent = CSS; doc.head.appendChild(s); }
    var R = razbor(r, o);
    el.innerHTML = html(R);
    el.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href="/cabinet.html"]') : null;
      if (a && root && root.dlkGoal) root.dlkGoal('shchit_sled', { inn_dlina: String(r.company.inn).length });
    });
    return R;
  }

  return { razbor: razbor, mount: mount, html: html, kratko: kratko, glavnyj: glavnyj, T: T, SVERENO: SVERENO, MAX_SHAGOV: MAX_SHAGOV, PORYADOK: PORYADOK };
});
