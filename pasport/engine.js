/*
 * Делоскоп · Паспорт добросовестности — логика без интерфейса.
 * Всё считается в браузере из ответа /api/check: заголовок, группы признаков, «отпечаток данных».
 * Подключается и в страницу (window.PasportEngine), и в тесты (require).
 */
(function (root) {
  'use strict';

  var STATUS = { ACTIVE: 'Действующая', LIQUIDATING: 'Ликвидируется', LIQUIDATED: 'Ликвидирована', BANKRUPT: 'Банкротство', REORGANIZING: 'Реорганизация' };

  // ИНН: 10 цифр — организация, 12 — предприниматель; контрольные цифры по алгоритму ФНС.
  function innValid(v) {
    var s = String(v || '').replace(/\D/g, '');
    function ch(w, n) { var t = 0; for (var i = 0; i < w.length; i++) t += w[i] * +s[i]; return t % 11 % 10 === +s[n]; }
    if (s.length === 10) return ch([2, 4, 10, 3, 5, 9, 4, 6, 8], 9);
    if (s.length === 12) return ch([7, 2, 4, 10, 3, 5, 9, 4, 6, 8], 10) && ch([3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8], 11);
    return false;
  }

  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  // Возраст компании словами: «4 года 8 месяцев», «7 месяцев».
  function age(regDate, now) {
    var r = new Date(regDate), n = now ? new Date(now) : new Date();
    if (isNaN(r) || r > n) return null;
    var months = (n.getFullYear() - r.getFullYear()) * 12 + (n.getMonth() - r.getMonth()) - (n.getDate() < r.getDate() ? 1 : 0);
    var y = Math.floor(months / 12), m = months % 12, parts = [];
    if (y) parts.push(y + ' ' + plural(y, 'год', 'года', 'лет'));
    if (m || !y) parts.push(m + ' ' + plural(m, 'месяц', 'месяца', 'месяцев'));
    return { months: months, text: parts.join(' ') };
  }

  // Отпечаток данных: короткий код, который меняется, только если поменялось что-то существенное.
  // Не криптография и не подпись — способ сразу увидеть, что бумажная копия устарела.
  var B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford: без I, L, O, U — не спутать при диктовке
  function fnv1a(str) {
    var h = 0x811C9DC5;
    var s = unescape(encodeURIComponent(str));
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function fingerprint(r) {
    var c = (r && r.company) || {};
    var sig = ((r && r.signals) || []).map(function (x) { return String(x.title || '').trim() + '|' + (x.status || ''); }).sort();
    var z = r && r.zsk ? 'zsk|' + (r.zsk.level || '') : '';
    var canon = [String(c.inn || ''), c.status || '', (r && r.risk_level) || '', z].concat(sig).join('\n');
    var h = fnv1a(canon) & 0x3FFFFFFF, out = '';
    for (var i = 0; i < 6; i++) { out = B32[h & 31] + out; h >>>= 5; }
    return out;
  }
  function fpPretty(code) { return code ? code.slice(0, 3) + '‑' + code.slice(3) : ''; }
  function fpNormalize(v) { return String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').slice(0, 6); }

  function ymd(d) {
    d = d ? new Date(d) : new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  }
  function parseYmd(s) {
    var m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d) || d.getMonth() !== +m[2] - 1 ? null : d;
  }

  // Сверка с бумажной копией: QR несёт дату печати и отпечаток на тот день.
  function compare(params, currentCode) {
    var f = fpNormalize(params && params.f), d = parseYmd(params && params.d);
    if (!f || f.length !== 6) return { state: 'none' };
    return { state: f === currentCode ? 'same' : 'changed', printed: d, printedCode: f };
  }

  var REAL = /числен|сотрудн|работник|уплач|налог|взнос|отч[её]т|бухгалт|доход|выручк|контракт|лиценз|МСП|малого/i;

  // Раскладываем признаки по смыслу для партнёра, а не для аналитика.
  function classify(r) {
    var c = (r && r.company) || {}, sig = (r && r.signals) || [];
    var out = { real: [], clean: [], info: [], ask: [], serious: [] };
    sig.forEach(function (x) {
      var item = { title: String(x.title || ''), detail: String(x.detail || ''), source: x.source || '', asOf: x.as_of || '' };
      if (x.status === 'bad') out.serious.push(item);
      else if (x.status === 'warn') out.ask.push(item);
      else if (x.status === 'ok') (REAL.test(item.title) ? out.real : out.clean).push(item);
      else out.info.push(item);
    });
    var a = c.reg_date ? age(c.reg_date, r && r.checked_at) : null;
    if (a) out.real.unshift({ title: 'Работает', detail: a.text + ' — с ' + new Date(c.reg_date).toLocaleDateString('ru-RU'), source: 'ЕГРЮЛ', asOf: '' , age: a.months });
    if (c.status && c.status !== 'ACTIVE') out.serious.unshift({ title: 'Статус в реестре', detail: STATUS[c.status] || c.status, source: 'ЕГРЮЛ', asOf: '' });
    if (r && r.zsk && r.zsk.level === 'high') out.serious.push({ title: 'Прогноз ЗСК', detail: r.zsk.title || 'высокий', source: 'оценка Делоскопа', asOf: '' });
    else if (r && r.zsk && r.zsk.level === 'medium') out.ask.push({ title: 'Прогноз ЗСК', detail: r.zsk.title || 'средний', source: 'оценка Делоскопа', asOf: '' });
    return out;
  }

  // Заголовок паспорта: одна честная фраза.
  function headline(groups) {
    var s = groups.serious.length, a = groups.ask.length;
    if (s) return { tone: 'bad', title: 'В реестрах есть серьёзные отметки', text: s + ' ' + plural(s, 'отметка', 'отметки', 'отметок') + (a ? ' и ещё ' + a + ' ' + plural(a, 'момент', 'момента', 'моментов') + ' для вопросов' : '') + '. Партнёр увидит это сам — лучше объяснить заранее.' };
    if (a) return { tone: 'warn', title: 'Есть ' + a + ' ' + plural(a, 'момент', 'момента', 'моментов') + ', о которых могут спросить', text: 'Серьёзных отметок нет. Ниже — что именно видно и что стоит подготовить для ответа.' };
    return { tone: 'ok', title: 'Реестры не видят причин для беспокойства', text: 'По открытым данным ФНС на сегодня ни одной отметки, которая настораживает банк или налоговую.' };
  }

  function passportUrl(origin, inn, code, date) {
    return (origin || 'https://deloskop.ru') + '/pasport/?inn=' + encodeURIComponent(inn) + '&d=' + ymd(date) + '&f=' + code;
  }

  // Вымышленная компания для предпросмотра: регион «00» не существует, совпадение с реальной фирмой исключено.
  var DEMO = {
    demo: true,
    checked_at: null,
    risk_level: 'low',
    risk_title: 'Низкий риск',
    company: {
      inn: '0012345673', kpp: '001201001', ogrn: '1210000012345', kind: 'LEGAL', status: 'ACTIVE',
      name_short: 'ООО «Образцовая мастерская»', name_full: 'Общество с ограниченной ответственностью «Образцовая мастерская»',
      reg_date: '2021-03-15', address: 'г. Образцовск, ул. Примерная, д. 1, офис 12',
      director_post: 'Генеральный директор', director_name: 'Примеров Иван Петрович',
      okved: '43.39', okved_name: 'Производство прочих отделочных и завершающих работ'
    },
    signals: [
      { title: 'Среднесписочная численность', status: 'ok', detail: '14 человек за 2025 год', source: 'ФНС, открытые данные', as_of: '2026-07-25' },
      { title: 'Уплаченные налоги и взносы', status: 'ok', detail: '6,8 млн ₽ за 2025 год', source: 'ФНС, открытые данные', as_of: '2026-07-25' },
      { title: 'Бухгалтерская отчётность', status: 'ok', detail: 'сдана за 2025 год', source: 'ГИР БО', as_of: '2026-04-01' },
      { title: 'Недостоверность адреса или руководителя', status: 'ok', detail: 'отметок нет', source: 'ЕГРЮЛ', as_of: '' },
      { title: 'Долги по налогам', status: 'ok', detail: 'нет', source: 'ФНС, открытые данные', as_of: '2026-09-01' },
      { title: 'Дисквалифицированные руководители', status: 'ok', detail: 'нет', source: 'ФНС', as_of: '' },
      { title: 'Массовый адрес', status: 'warn', detail: 'по адресу зарегистрировано 11 компаний — бизнес-центр', source: 'ФНС', as_of: '2026-09-01' },
      { title: 'Налоговые правонарушения', status: 'info', detail: 'штраф 1 000 ₽ за 2024 год, уплачен', source: 'ФНС, открытые данные', as_of: '2026-07-25' }
    ],
    zsk: { level: 'low', title: 'Низкая вероятность', cbr_url: 'https://cbr.ru/counteraction_m_ter/platform_zsk/' }
  };

  var api = {
    STATUS: STATUS, innValid: innValid, plural: plural, age: age,
    fingerprint: fingerprint, fpPretty: fpPretty, fpNormalize: fpNormalize,
    ymd: ymd, parseYmd: parseYmd, compare: compare,
    classify: classify, headline: headline, passportUrl: passportUrl, DEMO: DEMO
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PasportEngine = api;
})(typeof self !== 'undefined' ? self : this);
