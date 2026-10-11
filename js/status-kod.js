/*!
 * Делоскоп · статус юрлица словами — по коду состояния ЕГРЮЛ (company.state_code, API status-kody).
 * status-tochno-v1 [команда] 10.10.2026: DaData кладёт и ликвидацию (101, 102), и предстоящее исключение
 * (105–108, 110) в один статус LIQUIDATING. Код в ответе есть — значит, пишем точно, а не «ликвидируется или исключается».
 * Названия — те же, что в «Что изменилось» (js/dinamika.js nazvSt, заголовки [команда] 03.10) и в справочнике
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
  // pasport-reorg-v1 [команда] 10.10: форма реорганизации по коду СЮЛСТ (data/statusy-egryul.json, группа reorganizaciya) —
  // короткий пересказ названия из справочника, без новых юридических формулировок. Название статуса (nazv) не меняем.
  var REORG_FORMA = {
    '121': 'преобразование', '122': 'слияние', '123': 'разделение', '124': 'присоединение к' + NB + 'другому юрлицу',
    '125': 'разделение одновременно с' + NB + 'присоединением', '129': 'сочетание нескольких форм, после которого компания прекратит деятельность',
    '131': 'выделение', '132': 'присоединение к' + NB + 'ней других юрлиц', '133': 'присоединение одновременно с' + NB + 'разделением',
    '134': 'присоединение одновременно с' + NB + 'выделением', '136': 'выделение одновременно с' + NB + 'присоединением',
    '139': 'сочетание нескольких форм, после которого компания продолжит деятельность'
  };
  // reorgForma('REORGANIZING', '124') → 'присоединение к другому юрлицу'; другой статус или неизвестный код — ''
  function reorgForma(st, k) { k = kod(k); return st === 'REORGANIZING' && REORG_FORMA[k] ? REORG_FORMA[k] : ''; }
  // pasport-likvidaciya-v1 [команда] 10.10: что делать кредитору при ликвидации и исключении — тексты [команда]
  // из data/statusy-egryul.json (поля sdelat и norma групп; тест сверяет дословно). Новых формулировок нет.
  var KREDITORU = {
    likvidaciya: { tekst: "Компания ликвидируется — после записи о ликвидации банк закроет счёт. Новые сделки — нет; по текущим — заявите требование ликвидатору в срок.", norma: "ст. 61–64 ГК РФ" },
    isklyuchenie: { tekst: "Новых авансов не платите. Если компания вам должна — возражение в налоговую нужно подать в течение 3 месяцев со дня публикации в «Вестнике государственной регистрации», по коду 108 — 6 месяцев. Дату публикации проверьте на vestnik-gosreg.ru.", norma: "ст. 21.1 и 21.3 129-ФЗ" },
    isklyuchena: { tekst: "Компания исключена из ЕГРЮЛ. Последствия — как при ликвидации (п. 2 ст. 64.2 ГК РФ): договор с ней не заключайте и не платите. Оспорить исключение в суде — в течение года (п. 8 ст. 22 129-ФЗ). Долг ООО можно требовать с директора или участников, если не оплачен по их вине (п. 3.1 ст. 3 14-ФЗ).", norma: "п. 2–3 ст. 64.2 ГК РФ; п. 3.1 ст. 3 14-ФЗ" }
  };
  // kreditoru('LIQUIDATING', '101') → { vid, tekst, norma }; без кода или при другом статусе — null
  function kreditoru(st, k) { var v = vid(st, k); return v && KREDITORU[v] ? { vid: v, tekst: KREDITORU[v].tekst, norma: KREDITORU[v].norma } : null; }
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

  return { nazv: nazv, fraza: fraza, izOtveta: izOtveta, vid: vid, kod: kod, reorgForma: reorgForma, REORG_FORMA: REORG_FORMA, kreditoru: kreditoru, KREDITORU: KREDITORU, LIKV: LIKV, ISKL: ISKL, ISKLYUCHENA: ISKLYUCHENA };
});
