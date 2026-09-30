/*!
 * Делоскоп · «Папка к договору» v1 (Ночные 30.09 23:05, п. 177 / следующий шаг после лестницы п. 173).
 * Зачем: бухгалтер проверил контрагента — Паспорт, отметки самопроверки, лестница «что запросить по сумме» —
 * а к договору нужна одна папка: Паспорт + приложения по номерам + опись «№, что, откуда, когда, кто».
 * Опись собирается здесь, в браузере, из того, что заказчик уже ввёл на странице; без сети и хранилищ.
 * Правила (держит tests/papka.test.js):
 *  • Паспорт — основной документ, приложения нумеруются с 1;
 *  • номер, который заказчик сам вписал в отметке («Снимок — приложение № 3»), сохраняется; остальным — свободные номера по порядку;
 *  • один номер у двух документов — предупреждение на экране, не молчим;
 *  • отметка с выпиской ЕГРЮЛ с ЭП закрывает пункт лестницы «Выписка ЕГРЮЛ с ЭП» — одна строка, не две;
 *  • пункты лестницы, которые исполняются в самом Паспорте (отметка, «Решение о сделке»), отдельными приложениями не считаем;
 *  • «проверить не удалось» без снимка — не приложение (прикладывать нечего);
 *  • ни «гарантий», ни «суд примет»: опись — перечень документов заказчика; Делоскоп их не получал и не проверял.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Papka = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSIYA = 'Папка v1.1';
  var OGOVORKA = 'Опись составлена заказчиком Паспорта в своём браузере. Делоскоп эти документы не получал и не проверял; в отпечаток SHA-256 Паспорта опись не входит.';
  var PODSKAZKA = 'Подпишите каждый документ номером из описи и сложите по порядку за Паспортом. Пустые клетки «когда» — впишите от руки, когда документ получен.';
  var MAX_ZAPROS = 20;
  // v1.1 (Ночные 01.10 01:05, п. 180): подсказка про выписку с ЭП и строка «ЗСК-дневника».
  var EP_PODSKAZKA = 'скачайте PDF на egrul.nalog.ru — у него электронная подпись ФНС; в «Когда получен» впишите дату скачивания';
  var EP_DATA = 'если PDF скачан в другой день — исправьте дату от руки';
  var ZSK_SSYLKA = 'cbr.ru — проверка по ИНН';
  function zskUrl(u) { return /^https:\/\/(www\.)?cbr\.ru\/counteraction_m_ter\/platform_zsk\//i.test(String(u || '').trim()); }
  function dnejTekst(n) { var d = n % 10, s = n % 100; return n + ' ' + (d === 1 && s !== 11 ? 'день' : d >= 2 && d <= 4 && (s < 12 || s > 14) ? 'дня' : 'дней'); }
  // «ЗСК-дневник»: след сверки с Банком России — из отметки заказчика; жёлтый уровень публично не узнать, поэтому о нём ни слова «нет».
  function zskStroka(otm) {
    var o = (otm || []).filter(function (x) { return x && x.ok && zskUrl(x.url); })[0];
    if (!o) return { est: false, tekst: 'ЗСК: у Банка России не сверяли. Это полминуты — ' + ZSK_SSYLKA + '; отметьте результат в разделе «Стоп-листы».' };
    var kogda = stroka(o.kogda || o.data, 40), d = +o.dnej > 0 ? ' Сверка была ' + dnejTekst(+o.dnej) + ' назад.' : '';
    var t = o.rez === 'net' ? 'ЗСК: по сервису Банка России на ' + kogda + ' высокий уровень риска не найден (отметка заказчика).' :
      o.rez === 'est' ? 'ЗСК: на ' + kogda + ' у Банка России есть сведения о высоком уровне риска (отметка заказчика) — до оплаты разберитесь.' :
      'ЗСК: на ' + kogda + ' проверить у Банка России не удалось — вернитесь к этому до оплаты.';
    return { est: true, rez: o.rez, kogda: kogda, dnej: +o.dnej || 0, tekst: t + d + ' Сведения обновляются ежедневно — в день оплаты проверьте ещё раз.' };
  }

  function host(u) { var m = /^https?:\/\/(?:www\.)?([a-z0-9.-]+)/i.exec(String(u || '').trim()); return m ? m[1].toLowerCase() : ''; }
  function stroka(v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 200); }
  function prilozhenij(n) {
    var d = n % 10, s = n % 100;
    return n + ' ' + (d === 1 && s !== 11 ? 'приложение' : d >= 2 && d <= 4 && (s < 12 || s > 14) ? 'приложения' : 'приложений');
  }

  // vvod: { pasport: {nomer, data, otpechatok, nazvanie, inn}, otmetki: [P.otmetka(...)], lestnica: Lestnica.stupen(...).spisok, zaprosili: 'текст' }
  function opis(vvod) {
    vvod = vvod || {};
    var pas = vvod.pasport || {};
    var stroki = [], preduprezhdeniya = [];
    var otm = (vvod.otmetki || []).filter(function (o) { return o && o.ok; }).slice().sort(function (a, b) { return a.razdel - b.razdel; });
    var otmStroki = [];

    otm.forEach(function (o) {
      var svoj = /^\d{1,3}$/.test(String(o.pril || '')) && +o.pril > 0 ? String(+o.pril) : '';
      if (!svoj && !o.ep && o.rez === 'ne_udalos') return; // прикладывать нечего
      var chto = o.ep ? 'Выписка ЕГРЮЛ в PDF с электронной подписью ФНС' :
        'Снимок экрана: ' + stroka(o.tekst, 160).replace(/^Проверено вами [^—]+— /, '').replace(/\.$/, '');
      var r = { n: svoj, svoj: !!svoj, chto: chto, otkuda: stroka(o.adres || o.url, 200), kogda: stroka(o.kogda || o.data, 40),
        kto: stroka(o.dolzhnost, 80), vid: 'otmetka', razdel: o.razdel, ep: !!o.ep, host: host(o.url || o.adres), ls: [],
        primechanie: 'отметка в разделе ' + o.razdel + (svoj ? '' : ' — номер присвоен описью, подпишите им документ') +
          (o.ep ? '; ' + EP_DATA : '') + (zskUrl(o.url) ? '; ЗСК — сверьте ещё раз в день оплаты' : '') };
      otmStroki.push(r);
      stroki.push(r);
    });

    // Отметка закрывает пункт лестницы с тем же первоисточником: одна строка, не две.
    // Выписка с ЭП — пункт «Выписка ЕГРЮЛ с ЭП»; снимок ЕГРЮЛ — пункт «Статус в ЕГРЮЛ» (а если его нет — любой пункт того же сайта).
    var ls = (vvod.lestnica || []).filter(Boolean);
    var estEp = ls.some(function (x) { return x.k === 'egrul_ep'; });
    function hostyIz(x) { return (x.gde || []).map(function (g) { return host(g.u); }); }
    function najti(x, hosty) {
      var kand = otmStroki.filter(function (r) { return hosty.indexOf(r.host) >= 0; });
      if (x.k === 'egrul_ep') return kand.filter(function (r) { return r.ep; })[0] || null;
      return kand.filter(function (r) { return !r.ls.length && (!r.ep || !estEp); })[0] ||
        kand.filter(function (r) { return r.ep; })[0] || null; // выписка с ЭП показывает и статус — та же строка
    }
    var lsNomera = [];
    (vvod.lestnica || []).forEach(function (x, i) {
      if (!x) { lsNomera[i] = null; return; }
      if (x.k === 'v_pasporte') { lsNomera[i] = 'в Паспорте'; return; }
      var hosty = hostyIz(x), ostalos = hosty.slice(), gde = (x.gde || []).slice();
      // Пункт с несколькими первоисточниками («приставы и арбитраж») закрывается, только когда отмечены все.
      hosty.forEach(function (h, j) {
        if (!h) { ostalos[j] = 'svoj'; return; } // ссылка на наш сервис («Проверь счёт») — отметки там нет
        var o = najti(x, [h]);
        if (o) { o.ls.push(x.stupen); ostalos[j] = null; gde[j] = null; if (hosty.length === 1) lsNomera[i] = o; }
      });
      if (hosty.length && ostalos.every(function (h) { return !h; })) {
        if (!lsNomera[i]) lsNomera[i] = otmStroki.filter(function (r) { return r.ls.indexOf(x.stupen) >= 0 && hosty.indexOf(r.host) >= 0; })[0];
        return;
      }
      var chast = gde.filter(Boolean).length < (x.gde || []).length;
      var t = stroka(x.t, 220), otKontr = /^От контрагента:\s*/.test(t);
      var r = { n: '', svoj: false, chto: (otKontr ? t.replace(/^От контрагента:\s*/, '').replace(/^./, function (c) { return c.toUpperCase(); }) : t) +
          (chast ? ' — ещё не отмечено: ' + gde.filter(Boolean).map(function (g) { return g.t; }).join(', ') : ''),
        otkuda: otKontr ? 'от контрагента' : gde.filter(Boolean).map(function (g) { return g.t; }).join(', ') || 'ваша компания',
        kogda: '', kto: '', vid: 'lestnica', stupen: x.stupen, primechanie: 'ступень ' + x.stupen + ' лестницы' + (x.k === 'egrul_ep' ? '; ' + EP_PODSKAZKA : '') };
      lsNomera[i] = r;
      stroki.push(r);
    });
    otmStroki.forEach(function (r) {
      if (!r.ls.length) return;
      var st = r.ls.filter(function (v, i, a) { return a.indexOf(v) === i; });
      r.primechanie += '; пункт' + (r.ls.length > 1 ? 'ы' : '') + ' лестницы, ступен' + (st.length > 1 ? 'и ' : 'ь ') + st.join(' и ');
    });

    String(vvod.zaprosili || '').split(/[,;\n]+/).map(function (t) { return stroka(t, 120); }).filter(Boolean)
      .filter(function (t, i, a) { return a.indexOf(t) === i; }).slice(0, MAX_ZAPROS).forEach(function (t) {
        stroki.push({ n: '', svoj: false, chto: t.replace(/^./, function (c) { return c.toUpperCase(); }), otkuda: 'от контрагента',
          kogda: '', kto: '', vid: 'zapros', primechanie: 'из поля «Запросили у контрагента»' });
      });

    // Номера: свои — как вписал заказчик; повтор — предупреждение; остальным — свободные по порядку.
    var zanyato = {};
    stroki.forEach(function (r) {
      if (!r.svoj) return;
      if (zanyato[r.n]) preduprezhdeniya.push('Номер ' + r.n + ' указан дважды — в разделах ' + zanyato[r.n].razdel + ' и ' + r.razdel + '. Исправьте номер в одной из отметок.');
      else zanyato[r.n] = r;
    });
    var sled = 1;
    stroki.forEach(function (r) {
      if (r.svoj) return;
      while (zanyato[String(sled)]) sled++;
      r.n = String(sled); zanyato[r.n] = r; sled++;
    });
    stroki.sort(function (a, b) { return (+a.n - +b.n) || (a.svoj === b.svoj ? 0 : a.svoj ? -1 : 1); });
    var nomera = stroki.map(function (r) { return +r.n; });
    var max = nomera.length ? Math.max.apply(null, nomera) : 0, propuski = [];
    for (var k = 1; k <= max; k++) if (nomera.indexOf(k) < 0) propuski.push(k);
    if (propuski.length) preduprezhdeniya.push('Пропущены номера: ' + propuski.join(', ') + ' — проверьте номера в отметках, иначе в папке будут «дыры».');

    stroki.forEach(function (r) { delete r.host; delete r.ls; delete r.ep; });
    var zagolovok = 'Опись приложений к Паспорту контрагента' + (pas.nomer ? ' № ' + stroka(pas.nomer, 40) : '') + (pas.data ? ', сведения на ' + stroka(pas.data, 40) : '');
    var kompaniya = [stroka(pas.nazvanie, 160), pas.inn ? 'ИНН ' + stroka(pas.inn, 12) : ''].filter(Boolean).join(' · ');
    return {
      ok: true, versiya: VERSIYA, zagolovok: zagolovok, kompaniya: kompaniya,
      otpechatok: stroka(pas.otpechatok, 40),
      stroki: stroki,
      lsNomera: lsNomera.map(function (x) { return x == null ? null : typeof x === 'string' ? x : 'прил. № ' + x.n; }),
      itogo: stroki.length,
      itogoTekst: stroki.length ? 'Всего ' + prilozhenij(stroki.length) + ' на ____ листах' : 'Приложений пока нет: отметьте самопроверку в разделах или введите сумму сделки — лестница подскажет, что приложить.',
      preduprezhdeniya: preduprezhdeniya,
      zsk: zskStroka(otm),
      podskazka: PODSKAZKA, ogovorka: OGOVORKA
    };
  }

  return { EP_PODSKAZKA: EP_PODSKAZKA, EP_DATA: EP_DATA, zskStroka: zskStroka, dnejTekst: dnejTekst, VERSIYA: VERSIYA, OGOVORKA: OGOVORKA, PODSKAZKA: PODSKAZKA, MAX_ZAPROS: MAX_ZAPROS, opis: opis, prilozhenij: prilozhenij };
});
