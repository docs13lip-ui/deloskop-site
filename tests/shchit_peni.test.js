// [Ночные запуски] 28.10 — shchit-peni-v1 (п. 412 Очереди): у долга по налогам в «Что сделать» — ссылка на Разбор № 30
// (ВС № 306-ЭС26-4683: срок по пеням за старый период — от последней уточнёнки и решения по ней). Строка — дословно [Право] 28.10.
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/shchit.js');
const URL = '/praktika/nalogi/utochnenka-i-peni-ens/';
const otvet = (signals) => ({ checked_at: '2026-10-28T12:00:00+03:00', company: { inn: '7707083893', name_short: 'ООО «Своя»', status: 'ACTIVE', reg_date: '2018-04-01' }, signals });

test('долг по налогам → шаг «Сверьте ЕНС» со ссылкой «Пени по старым периодам — проверьте уточнёнки»', () => {
  const R = S.razbor(otvet([{ title: 'Задолженность по налогам', status: 'bad', detail: '120 000 ₽' }]));
  const sh = R.shagi.find((s) => s.kind === 'dolg');
  assert.ok(sh, 'шаг по долгу есть');
  assert.ok(sh.eshche && sh.eshche.href === URL, 'ссылка на Разбор № 30');
  assert.strictEqual(sh.eshche.t, 'Пени по старым периодам — проверьте уточнёнки');
  assert.ok(!/гарантир|обязательно отмен|незаконн/i.test(sh.t + ' ' + sh.eshche.t), 'без обещания исхода');
});

test('без долга по налогам ссылки на разбор о пенях нет', () => {
  const R = S.razbor(otvet([{ title: 'Массовый адрес регистрации', status: 'warn', detail: 'Да' }]));
  assert.ok(!R.shagi.some((s) => s.eshche && s.eshche.href === URL));
});
