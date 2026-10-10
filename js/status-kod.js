/*!
 * Делоскоп · статус юрлица словами — по коду состояния ЕГРЮЛ (company.state_code, API status-kody).
 * status-tochno-v1 [Ночные-3] 10.10.2026: DaData кладёт и ликвидацию (101, 102), и предстоящее исключение
 * (105–108, 110) в один статус LIQUIDATING. Код в ответе есть — значит, пишем точно, а не «ликвидируется или исключается».
 * Названия — те же, что в «Что изменилось» (js/dinamika.js nazvSt, заголовки [Право] 03.10) и в справочнике
 * data/statusy-egryul.json; новых юридических формулировок здесь нет. Нет кода — прежний общий текст.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StatusKod = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NB = ' ';
  var LIKV = { '101': 1, '102': 1 };
  var ISKL = { '105': 1, '106': 1, '107': 1, '108': 1, '110': 1 };
  var ISKLYUCHENA = { '407': 1, '414': 1, '415': 1, '418': 1, '420': 1 };
  // Короткое название (шапка отчёта, Паспорт, PDF) — строчными
  var OBSHCHEE = { ACTIVE: 'действующая', LIQUIDATING: 'ликвидируется или исключается из' + NB + 'ЕГРЮЛ', LIQUIDATED: 'ликвидирована', BANKRUPT: 'банкротство', REORGANIZING: 'реорганизация' };
  // Фраза о компании (причина вывода, Щит)
  var FRAZA = { LIQUIDATING: 'компания ликвидируется или ФНС готовит её исключение из' + NB + 'ЕГРЮЛ', LIQUIDATED: 'компания ликвидирована', BANKRUPT: 'идёт банкротство', REORGANIZING: 'идёт реорганизация' };

  function kod(v) { var k = String(v == null ? '' : v).trim(); return /^\d{3}$/.test(k) ? k : ''; }
  function vid(st, k) {
    k = kod(k);
    if (ISKLYUCHENA[k]) return 'isklyuchena';
    if (st === 'LIQUIDATING' && ISKL[k]) return 'isklyuchenie';
    if (st === 'LIQUIDATING' && LIKV[k]) return 'likvidaciya';
    return '';
  }
  function cap(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }

  // nazv('LIQUIDATING', '101') → 'ликвидируется'; {zaglavnaya: true} → с заглавной
  function nazv(st, k, o) {
    var v = vid(st, k);
    var t = v === 'isklyuchena' ? 'исключена из' + NB + 'ЕГРЮЛ' : v === 'isklyuchenie' ? 'готовится исключение из' + NB + 'ЕГРЮЛ' : v === 'likvidaciya' ? 'ликвидируется' : (OBSHCHEE[st] || st || '');
    return o && o.zaglavnaya ? cap(t) : t;
  }
  // fraza('LIQUIDATING', '106') → 'ФНС готовит исключение компании из ЕГРЮЛ'
  function fraza(st, k, o) {
    var v = vid(st, k);
    var t = v === 'isklyuchena' ? 'компания исключена из' + NB + 'ЕГРЮЛ' : v === 'isklyuchenie' ? 'ФНС готовит исключение компании из' + NB + 'ЕГРЮЛ' : v === 'likvidaciya' ? 'компания ликвидируется' : (FRAZA[st] || '');
    return o && o.zaglavnaya ? cap(t) : t;
  }
  // По ответу /api/check: company → короткое название
  function izOtveta(c, o) { c = c || {}; return c.status ? nazv(c.status, c.state_code, o) : ''; }

  return { nazv: nazv, fraza: fraza, izOtveta: izOtveta, vid: vid, kod: kod, LIKV: LIKV, ISKL: ISKL, ISKLYUCHENA: ISKLYUCHENA };
});
