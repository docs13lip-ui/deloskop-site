// sudy-v1 [Ночные запуски] 11.10 (решения владельца 11.10 16:50 и 16:55 — арбитраж через DaMIA, «как у лидеров, но лучше»):
// словарь API damia v1.4 (status polucheno/ne_provereno + sostoyanie) → словарь сайта (status found/not_found/…)
// и строка-вывод «Арбитражных судов» из analitika. node --test tests/sudy_slovar.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const I = require('../js/istochniki.js');
const S = require('../js/sushchestvennoe.js');
const O = require('../js/otkuda.js');
const IO = require('../js/indeks-otvet.js');
IO.ustanovit(require('../indeks/metodika-v1.json'), require('../indeks/indeks.js'));
const NB = ' ';

// Блок «Арбитражные суды», как его отдаст API с ключом DaMIA (damia-v1.4 + sudy-v1); компания вымышленная
function sudyNajdeno(over) {
  return Object.assign({
    nazvanie: 'Арбитражные суды', istochnik: 'Картотека арбитражных дел (через DaMIA)', status: 'polucheno', status_tekst: 'получено',
    sostoyanie: 'found', data_svedeniy: '2026-10-11T18:20+03:00', podzagolovok: 'Суды общей юрисдикции не проверяли',
    proverit_samim: 'https://kad.arbitr.ru/',
    itog: 'Компания — ответчик в 3 незавершённых делах на 3,1 млн ₽. Сведения на 11.10.2026, 18:20.',
    znachenie: 'Признак риска: крупные иски могут закончиться взысканием и арестом счетов. Откройте карточки дел — стадия и суть важнее суммы.',
    analitika: {
      versiya: 'sudy-v1',
      svodka: 'Ответчик: 4' + NB + 'дела за' + NB + '12' + NB + 'месяцев на' + NB + '3,1' + NB + 'млн' + NB + '₽ — 2' + NB + 'по договорам от других компаний. Истец: 2' + NB + 'дела на' + NB + '8' + NB + 'млн' + NB + '₽.',
      dolya_vyruchki: { dolya: 0.1575, god: 2025, ton: 'warn', porogi: 'chernovik', tekst: 'Иски к компании в незавершённых делах — 3,1' + NB + 'млн' + NB + '₽, это 16' + NB + '% выручки за' + NB + '2025' + NB + 'год.' },
      trend: { rost: true, poslednie_3m: 3, srednee_ranshe: 0.33, tekst: 'Исков к компании стало больше: 3 за последние 3' + NB + 'месяца, раньше в среднем 0,3 за такой же срок.' },
      chto_sdelat: [{ id: 'dogovor', soglasovano: false, tekst: 'черновик' }, { id: 'nalog', soglasovano: true, tekst: 'согласованный совет', ssylka: '/proverit-schet/' }],
      ne_sou: 'Суды общей юрисдикции не проверяем.'
    }
  }, over || {});
}
function otvet(dm, status) {
  return {
    company: { inn: '7700000001', ogrn: '1027700000001', kind: 'LEGAL', name_short: 'ООО "ПРИМЕР"', status: status || 'ACTIVE', reg_date: '2010-09-05', okved: '47.91' },
    risk_level: 'low', checked_at: '2026-10-11T15:23:00Z',
    signals: [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая', source: 'ЕГРЮЛ/ЕГРИП', as_of: null }],
    damia: Object.assign({ versiya: 'damia-v1.4', polnota: { provereno: 1, iz: 7 } }, dm)
  };
}

test('polucheno/found → status found, прежнее слово — в status_api', () => {
  const r = I.dopolnit(otvet({ sudy: sudyNajdeno() }));
  assert.strictEqual(r.damia.sudy.status, 'found');
  assert.strictEqual(r.damia.sudy.status_api, 'polucheno');
});

test('polucheno/not_found → not_found; ne_provereno → not_checked с прежним sostoyanie', () => {
  const r = I.dopolnit(otvet({
    sudy: { nazvanie: 'Арбитражные суды', status: 'polucheno', sostoyanie: 'not_found', itog: 'дел нет', data_svedeniy: '2026-10-11T18:20+03:00' },
    fssp: { nazvanie: 'Приставы', status: 'ne_provereno', sostoyanie: 'not_checked', prichina: 'эти реестры мы пока не проверяем' },
    rnp: { nazvanie: 'РНП', status: 'ne_provereno', prichina: 'сведения по ИП пока не показываем', sostoyanie: 'not_applicable' }
  }));
  assert.strictEqual(r.damia.sudy.status, 'not_found');
  assert.strictEqual(r.damia.fssp.status, 'not_checked');
  assert.strictEqual(r.damia.fssp.sostoyanie, 'not_checked');
  assert.strictEqual(r.damia.rnp.status, 'not_applicable');
});

test('уже в словаре сайта (found/not_found от загрузчика ФССП) — не трогаем', () => {
  const f = { nazvanie: 'Приставы', status: 'found', sostoyanie: 'found', chislo: 2 };
  const r = I.dopolnit(otvet({ fssp: f }));
  assert.strictEqual(r.damia.fssp.status, 'found');
  assert.ok(!('status_api' in r.damia.fssp));
});

test('строка-вывод судов: сводка + доля выручки + тренд; прежний итог сохранён', () => {
  const r = I.dopolnit(otvet({ sudy: sudyNajdeno() }));
  const b = r.damia.sudy;
  assert.ok(b.itog.startsWith('Ответчик: 4' + NB + 'дела за' + NB + '12' + NB + 'месяцев'));
  assert.ok(b.itog.includes('16' + NB + '% выручки за' + NB + '2025' + NB + 'год.'));
  assert.ok(b.itog.includes('Исков к компании стало больше'));
  assert.ok(b.itog_prezhnij.startsWith('Компания — ответчик в 3 незавершённых делах'));
  assert.deepStrictEqual(b.chto_sdelat.map((x) => x.id), ['nalog'], 'черновики [Право] клиенту не показываем');
  const r2 = I.dopolnit(r); // повторный вызов — без двойного текста
  assert.strictEqual(r2.damia.sudy.itog, b.itog);
});

test('доля выручки «bad» → уровень bad; без аналитики или с ошибкой — прежний итог', () => {
  const s = sudyNajdeno();
  s.analitika.dolya_vyruchki.ton = 'bad';
  assert.strictEqual(I.dopolnit(otvet({ sudy: s })).damia.sudy.uroven, 'bad');
  const bez = sudyNajdeno({ analitika: { oshibka: 'KeyError' } });
  assert.ok(I.dopolnit(otvet({ sudy: bez })).damia.sudy.itog.startsWith('Компания — ответчик в 3'));
});

test('«Откуда данные»: найденные дела — «●» с датой, а не «ответа нет»', () => {
  const r = I.dopolnit(otvet({ sudy: sudyNajdeno() }));
  const o = O.istochniki(r, {});
  const x = o.spisok.find((v) => v.k === 'damia:sudy');
  assert.strictEqual(x.status, 'ok');
  assert.strictEqual(x.znak, '●');
});

test('«Существенные факты»: суды — среди найденного, не в «Не проверяли»', () => {
  const r = I.dopolnit(otvet({ sudy: sudyNajdeno() }));
  const f = S.fakty ? S.fakty(r) : S.sobrat(r);
  const txt = JSON.stringify(f);
  assert.ok(txt.includes('Ответчик: 4'), 'сводка судов в фактах');
  assert.ok(!/Не проверяли[^"]*арбитражные суды/.test(txt));
});

test('Индекс: суды с ответом учтены как реестр', () => {
  const r = I.dopolnit(otvet({ sudy: sudyNajdeno() }));
  assert.ok(I.uchten(r.damia.sudy));
});

test('ЕГРЮЛ «банкрот», картотека «должником нет» → блок «Банкротство» по ЕГРЮЛ', () => {
  const r = otvet({ bankrotstvo: { nazvanie: 'Банкротство', status: 'polucheno', sostoyanie: 'not_found', itog: 'дел о банкротстве не найдено' } }, 'BANKRUPT');
  r.signals[0].detail = 'В процедуре банкротства';
  I.dopolnit(r);
  assert.strictEqual(r.damia.bankrotstvo.status, 'found');
  assert.strictEqual(r.damia.bankrotstvo.iz_egryul, true);
});
