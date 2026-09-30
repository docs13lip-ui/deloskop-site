/*!
 * Делоскоп · «Лестница проверки по сумме сделки» v1 (Ночные 30.09 21:05, п. 173).
 * Основание: п. 16 письма ФНС от 10.03.2021 № БВ-4-7/3060@ — «степень предъявляемых требований к выбору контрагента
 * не может быть одинаковой» для разовой закупки на несущественную сумму и для дорогостоящего актива;
 * Определение ВС РФ от 14.05.2020 № 307-ЭС19-27597 — учитывать объём деятельности покупателя, регулярность сделок,
 * отклонение цены от рынка. Порогов в рублях закон не даёт — границы ступеней предложил Делоскоп, так и пишем на экране.
 * Считается в браузере, без сети и хранилищ: сумма, закупки и галочки остаются на странице.
 * Правила (держит tests/lestnica.test.js):
 *  • ступень по сумме: до 100 тыс. — 1, до 1 млн — 2, до 10 млн — 3, дальше — 4;
 *  • если известны годовые закупки клиента — по доле (< 1 % · < 5 % · < 20 % · дальше), но не ниже «ступени по сумме − 1»:
 *    крупная сумма не становится «мелочью» даже для большой компании;
 *  • признаки поднимают ступень: 1–2 признака — на одну, 3 и больше — на две; выше 4 не бывает;
 *  • сумма больше 100 000 ₽ — красная строка «только безналично» (п. 6 Указания Банка России № 3073-У);
 *  • ни «гарантий», ни «суд примет»: это ориентир объёма проверки, а не обещание исхода.
 *  • k — ключ для «Папки к договору» (js/papka.js): v_pasporte — пункт исполняется в самом Паспорте, отдельного приложения нет;
 *    egrul_ep — выписка ЕГРЮЛ с ЭП: если она уже отмечена в самопроверке, опись берёт её номер и дату.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Lestnica = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSIYA = 'Лестница v1';
  var OSNOVANIE = 'Чем значимее сделка, тем больше проверяют: п. 16 письма ФНС от 10.03.2021 № БВ‑4‑7/3060@ и Определение Верховного суда от 14.05.2020 № 307‑ЭС19‑27597.';
  var OGOVORKA = 'Порогов в рублях закон не устанавливает — границы ступеней предложил Делоскоп. Это ориентир Делоскопа для объёма проверки, а не требование закона и не обещание исхода спора.';
  var NALICHNYE = 'Наличными — нельзя: между компаниями и ИП по одному договору наличными можно заплатить не больше 100 000 ₽ (п. 6 Указания Банка России № 3073‑У). Эту сделку — только безналично.';
  var LIMIT_NALICHNYH = 100000;

  var GRANICY_RUB = [100000, 1000000, 10000000];   // < 100 тыс. — 1; < 1 млн — 2; < 10 млн — 3; дальше — 4
  var GRANICY_DOLYA = [0.01, 0.05, 0.20];          // < 1 % — 1; < 5 % — 2; < 20 % — 3; дальше — 4

  var STUPENI = [
    null,
    { n: 1, nazvanie: 'Обычная закупка', kogda: 'до 100 000 ₽ или меньше 1 % ваших закупок за год',
      sdelat: [
        { t: 'Статус в ЕГРЮЛ: компания действует, нет отметок о недостоверности, ликвидации и реорганизации', gde: [['egrul.nalog.ru', 'https://egrul.nalog.ru/']] },
        { t: 'Расчётный счёт в счёте на оплату совпадает с карточкой компании', gde: [['Проверь счёт', '/proverit-schet/']] },
        { t: 'Отметка о самопроверке в Паспорте: дата, время и адрес страницы с результатом', gde: [], k: 'v_pasporte' }
      ] },
    { n: 2, nazvanie: 'Заметная сделка', kogda: 'от 100 000 ₽ до 1 млн ₽ или 1–5 % закупок за год',
      sdelat: [
        { t: 'Выписка ЕГРЮЛ в PDF с электронной подписью ФНС — на дату сделки', gde: [['egrul.nalog.ru', 'https://egrul.nalog.ru/']], k: 'egrul_ep' },
        { t: 'Бухгалтерская отчётность за последний год: выручка, активы, есть ли движение', gde: [['bo.nalog.gov.ru', 'https://bo.nalog.gov.ru/']] },
        { t: 'Нет решений ФНС о приостановлении операций по счетам', gde: [['service.nalog.ru/bi.do', 'https://service.nalog.ru/bi.do']] },
        { t: 'Долги у приставов и арбитражные дела', gde: [['fssp.gov.ru', 'https://fssp.gov.ru/iss/ip'], ['kad.arbitr.ru', 'https://kad.arbitr.ru/']] },
        { t: 'Компании нет в реестре недобросовестных поставщиков', gde: [['zakupki.gov.ru', 'https://zakupki.gov.ru/epz/dishonestsupplier/search/results.html']] },
        { t: 'От контрагента: карточка с реквизитами и документ о полномочиях подписанта — решение о назначении или доверенность', gde: [] }
      ] },
    { n: 3, nazvanie: 'Существенная сделка', kogda: 'от 1 млн до 10 млн ₽ или 5–20 % закупок за год',
      sdelat: [
        { t: 'От контрагента: справка об исполнении обязанности по уплате налогов (КНД 1120101) с электронной подписью ФНС — он заказывает её сам в личном кабинете налогоплательщика', gde: [] },
        { t: 'Чем будут исполнять договор: люди, склад, транспорт; лицензия или членство в СРО, если работа этого требует', gde: [] },
        { t: '2–3 коммерческих предложения и короткая запись, почему выбрали этого поставщика', gde: [] }
      ] },
    { n: 4, nazvanie: 'Крупная или нетипичная сделка', kogda: 'от 10 млн ₽ или от 20 % закупок за год, покупка дорогого актива',
      sdelat: [
        { t: 'Осмотр склада, производства или имущества — акт с датой, адресом и фотографиями', gde: [] },
        { t: 'Документы на имущество, которым будут исполнять договор: собственность или аренда', gde: [] },
        { t: 'Кто стоит за компанией: учредители, связанные компании, бенефициары', gde: [] },
        { t: '«Решение о сделке» с подписью руководителя', gde: [], k: 'v_pasporte' }
      ] }
  ];

  // Признаки «ступенью выше» — из того же определения ВС и пп. 14–16 письма ФНС.
  var PRIZNAKI = [
    ['cena', 'Цена заметно ниже рынка'],
    ['pervaya', 'Первая сделка с этой компанией'],
    ['molodaya', 'Компании меньше 12 месяцев'],
    ['predoplata', 'Предоплата больше половины суммы'],
    ['okved', 'Работа не по профилю компании (ОКВЭД)'],
    ['posrednik', 'Посредник без своего склада, людей или техники']
  ];
  var IDS = PRIZNAKI.map(function (p) { return p[0]; });

  function chislo(v) {
    if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null;
    var s = String(v == null ? '' : v).replace(/[\s  ₽]/g, '').replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    var n = parseFloat(s); return n > 0 ? n : null;
  }
  function poGranicam(x, gr) { for (var i = 0; i < gr.length; i++) if (x < gr[i]) return i + 1; return gr.length + 1; }
  function rub(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function procent(d) { var p = d * 100; return (p < 1 ? String(Math.round(p * 100) / 100) : String(Math.round(p * 10) / 10)).replace('.', ',') + ' %'; }

  // vvod: { summa, zakupki, priznaki: ['cena', …] } → ступень, почему, что сделать (по нарастанию) и красная строка про наличные.
  function stupen(vvod) {
    vvod = vvod || {};
    var summa = chislo(vvod.summa), zakupki = chislo(vvod.zakupki);
    var pr = (vvod.priznaki || []).filter(function (id, i, a) { return IDS.indexOf(id) >= 0 && a.indexOf(id) === i; });
    if (!summa) return { n: null, summa: null, priznaki: pr, pochemu: 'Введите сумму сделки — покажем, какой объём проверки ей соразмерен.', spisok: [], nalichnye: null, osnovanie: OSNOVANIE, ogovorka: OGOVORKA };
    var poSumme = poGranicam(summa, GRANICY_RUB), baza = poSumme, pochemu;
    if (zakupki && zakupki >= summa) {
      var dolya = summa / zakupki, poDole = poGranicam(dolya, GRANICY_DOLYA);
      baza = Math.max(poDole, poSumme - 1);
      pochemu = 'Сумма ' + rub(summa) + ' — ' + procent(dolya) + ' ваших закупок за год' +
        (baza < poSumme ? '; по доле — на ступень ниже, чем по сумме (ниже чем на одну не опускаем: крупная сумма остаётся крупной)' : '');
    } else {
      pochemu = 'Сумма ' + rub(summa) + (zakupki ? ' — больше ваших закупок за год, считаем по сумме' : '');
    }
    var podnyat = pr.length >= 3 ? 2 : pr.length ? 1 : 0, n = Math.min(4, baza + podnyat);
    if (podnyat) pochemu += '; ' + (n > baza ? (n - baza === 2 ? 'на две ступени выше' : 'на ступень выше') + ' — ' : 'ступень уже высшая, но учтите: ') +
      PRIZNAKI.filter(function (p) { return pr.indexOf(p[0]) >= 0; }).map(function (p) { return p[1].toLowerCase(); }).join(', ');
    pochemu += '.';
    var spisok = [];
    for (var s = 1; s <= n; s++) STUPENI[s].sdelat.forEach(function (x) { spisok.push({ stupen: s, t: x.t, k: x.k || '', gde: x.gde.map(function (g) { return { t: g[0], u: g[1] }; }) }); });
    return { n: n, iz: 4, nazvanie: STUPENI[n].nazvanie, kogda: STUPENI[n].kogda, baza: baza, poSumme: poSumme, summa: summa, zakupki: zakupki,
      priznaki: pr, pochemu: pochemu, spisok: spisok, nalichnye: summa > LIMIT_NALICHNYH ? NALICHNYE : null, osnovanie: OSNOVANIE, ogovorka: OGOVORKA };
  }

  return { VERSIYA: VERSIYA, STUPENI: STUPENI, PRIZNAKI: PRIZNAKI, GRANICY_RUB: GRANICY_RUB, GRANICY_DOLYA: GRANICY_DOLYA,
    LIMIT_NALICHNYH: LIMIT_NALICHNYH, OSNOVANIE: OSNOVANIE, OGOVORKA: OGOVORKA, NALICHNYE: NALICHNYE, stupen: stupen, chislo: chislo };
});
