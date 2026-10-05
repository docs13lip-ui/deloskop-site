// Шесть подставленных ответов /api/check для tests/otsrochka_pokupatelyu.test.js (go, cap, cap+malo, post, stop, LIQUIDATED).
// Компании вымышленные, ИНН — 77000000xx; данных реальных компаний и ИП здесь нет.
'use strict';
var NOW = '2026-10-05T09:00:00+03:00';
function sig(title, status, detail) { return { title: title, status: status, detail: detail || '' }; }
function resp(o) {
  return Object.assign({ checked_at: NOW, risk_level: 'low', company: { inn: '7700000090', name_short: 'ООО «Тест»', status: 'ACTIVE', reg_date: '2015-03-01' }, signals: [] }, o || {});
}
module.exports = {
  go: resp({ dossier: { kpi: [{ label: 'Выручка', value: 52000000 }] } }),
  cap: resp({ risk_level: 'medium', company: { inn: '7700000091', name_short: 'ООО «Юный»', status: 'ACTIVE', reg_date: '2026-03-01' },
    signals: [sig('Руководитель сменился недавно', 'warn', 'Внимание')] }),
  capMalo: resp({ risk_level: 'medium', company: { inn: '7700000092', name_short: 'ООО «Малый»', status: 'ACTIVE', reg_date: '2018-03-01' },
    dossier: { kpi: [{ label: 'Выручка', value: 400000 }] }, signals: [sig('Руководитель сменился недавно', 'warn', 'Внимание')] }),
  post: resp({ risk_level: 'medium', company: { inn: '7700000093', name_short: 'ООО «Должник»', status: 'ACTIVE', reg_date: '2016-03-01' },
    signals: [sig('Задолженность по налогам', 'bad', '412 000 ₽')] }),
  stop: resp({ risk_level: 'high', company: { inn: '7700000094', name_short: 'ООО «Адрес»', status: 'ACTIVE', reg_date: '2016-03-01' },
    signals: [sig('Недостоверные сведения в ЕГРЮЛ', 'bad', 'Адрес')] }),
  liquidated: resp({ company: { inn: '7700000095', name_short: 'ООО «Былое»', status: 'LIQUIDATED', reg_date: '2010-01-01' } })
};
