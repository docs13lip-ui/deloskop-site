/*!
 * Делоскоп · Щит · сборщик файлов 1CClientBankExchange.
 * Нужен для кнопки «Посмотреть на примере» и для автотестов.
 * Демо-компания вымышленная: реквизиты не принадлежат реальным организациям.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DeloskopShieldDemo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function pad(n) { return ('0' + n).slice(-2); }
  function fmt(t) { var d = new Date(t); return pad(d.getUTCDate()) + '.' + pad(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); }

  /**
   * doc: {type, date, sum, out:true|false, cpInn, cpName, cpAcc, purpose, kbk}
   */
  function build1C(o) {
    var L = [
      '1CClientBankExchange', 'ВерсияФормата=1.03', 'Кодировка=Windows', 'Отправитель=Бухгалтерия предприятия',
      'Получатель=', 'ДатаСоздания=' + fmt(o.to), 'ВремяСоздания=10:00:00',
      'ДатаНачала=' + fmt(o.from), 'ДатаКонца=' + fmt(o.to), 'РасчСчет=' + o.account,
      'Документ=Платежное поручение',
      'СекцияРасчСчет', 'ДатаНачала=' + fmt(o.from), 'ДатаКонца=' + fmt(o.to), 'РасчСчет=' + o.account,
      'НачальныйОстаток=' + (o.opening || 0).toFixed(2), 'ВсегоПоступило=0.00', 'ВсегоСписано=0.00',
      'КонечныйОстаток=' + (o.closing || 0).toFixed(2), 'КонецРасчСчет'
    ];
    o.docs.forEach(function (d, i) {
      var me = ['ИНН ' + o.inn + ' ' + o.name, o.inn, o.account];
      var cp = ['ИНН ' + (d.cpInn || '') + ' ' + (d.cpName || ''), d.cpInn || '', d.cpAcc || '40702810900000000001'];
      var payer = d.out ? me : cp, rcpt = d.out ? cp : me;
      L.push('СекцияДокумент=' + (d.type || 'Платежное поручение'));
      L.push('Номер=' + (i + 1), 'Дата=' + fmt(d.date), 'Сумма=' + d.sum.toFixed(2));
      L.push('ПлательщикСчет=' + payer[2]);
      if (d.out) L.push('ДатаСписано=' + fmt(d.date));
      L.push('Плательщик=' + payer[0], 'ПлательщикИНН=' + payer[1], 'Плательщик1=' + payer[0].replace(/^ИНН \d* /, ''), 'ПлательщикРасчСчет=' + payer[2]);
      L.push('ПолучательСчет=' + rcpt[2]);
      if (!d.out) L.push('ДатаПоступило=' + fmt(d.date));
      L.push('Получатель=' + rcpt[0], 'ПолучательИНН=' + rcpt[1], 'Получатель1=' + rcpt[0].replace(/^ИНН \d* /, ''), 'ПолучательРасчСчет=' + rcpt[2]);
      L.push('ВидОплаты=01', 'Очередность=5');
      if (d.kbk) L.push('СтатусСоставителя=01', 'ПоказательКБК=' + d.kbk, 'ОКАТО=45000000');
      else L.push('СтатусСоставителя=', 'ПоказательКБК=');
      var p = d.purpose || '';
      if (p.length > 80) { L.push('НазначениеПлатежа=' + p.slice(0, 80), 'НазначениеПлатежа1=' + p.slice(80)); }
      else L.push('НазначениеПлатежа=' + p);
      L.push('КонецДокумента');
    });
    L.push('КонецФайла');
    return L.join('\r\n');
  }

  function D(y, m, d) { return Date.UTC(y, m - 1, d); }

  /** Демо: ООО «Пример» — оптовая торговля, июль–сентябрь 2026. */
  function demo() {
    var docs = [], y = 2026;
    var buyers = [
      ['7701000001', 'ООО «Северный ветер»'], ['7701000002', 'ООО «Колос»'], ['7701000003', 'ООО «Горизонт плюс»']
    ];
    [7, 8, 9].forEach(function (m, mi) {
      // выручка: 3 поступления в месяц
      [3, 13, 23].forEach(function (day, k) {
        var dt = D(y, m, day); while ([0, 6].indexOf(new Date(dt).getUTCDay()) >= 0) dt += 86400000;
        docs.push({ out: false, date: dt, sum: 1150000 + k * 80000 + mi * 60000, cpInn: buyers[k][0], cpName: buyers[k][1], purpose: 'Оплата по договору поставки № ' + (12 + k) + ' за товар. В т.ч. НДС 22%' });
      });
      docs.push({ out: true, date: D(y, m, 5), sum: 1450000, cpInn: '7702000010', cpName: 'ООО «Опт-Снаб»', purpose: 'Оплата по счёту за товар. В т.ч. НДС 22%' });
      docs.push({ out: true, date: D(y, m, 6), sum: 95000, cpInn: '7702000011', cpName: 'ООО «Складской двор»', purpose: 'Аренда склада за ' + ['июль', 'август', 'сентябрь'][mi] + ' 2026 г. В т.ч. НДС 22%' });
      docs.push({ out: true, date: D(y, m, 10), sum: 2600, cpInn: '7702000012', cpName: 'ПАО «Связь»', purpose: 'Услуги связи и интернет. В т.ч. НДС 22%' });
      docs.push({ out: true, date: D(y, m, 28), sum: 18000 + mi * 1000, kbk: '18201061201010000510', cpInn: '7727406020', cpName: 'Казначейство России (ФНС России)', cpAcc: '03100643000000018500', purpose: 'Единый налоговый платёж' });
      docs.push({ out: true, date: D(y, m, 25), sum: 240000, cpInn: '', cpName: 'Реестр зарплатного проекта', cpAcc: '40817810000000000077', purpose: 'Перечисление заработной платы за ' + ['июль', 'август', 'сентябрь'][mi] + ' по реестру № ' + (mi + 3) });
      // наличные: растут к сентябрю, часть — сразу после поступления
      docs.push({ out: true, type: 'Денежный чек', date: D(y, m, 14), sum: 380000 + mi * 260000, cpInn: '7700000001', cpName: 'ООО «Пример»', purpose: 'Выдача наличных на хозяйственные нужды' });
      docs.push({ out: true, type: 'Денежный чек', date: D(y, m, 24), sum: 150000 + mi * 90000, cpInn: '7700000001', cpName: 'ООО «Пример»', purpose: 'Снятие наличных. Прочие выдачи' });
    });
    docs.push({ out: true, type: 'Денежный чек', date: D(y, 9, 4), sum: 1200000, cpInn: '7700000001', cpName: 'ООО «Пример»', purpose: 'Выдача наличных под отчёт на закупку товара' });
    docs.push({ out: true, date: D(y, 9, 30), sum: 1490, cpInn: '7702000099', cpName: 'АО «Банк»', cpAcc: '70601810000000000001', purpose: 'Комиссия за обслуживание счёта за сентябрь' });
    return build1C({ inn: '7700000001', name: 'ООО «Пример»', account: '40702810000000000555', from: D(y, 7, 1), to: D(y, 9, 30), opening: 350000, closing: 1265000, docs: docs });
  }

  return { build1C: build1C, demo: demo, D: D };
});
