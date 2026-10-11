// istochniki-v1 [Ночные запуски] 11.10 (решение владельца 11.10 16:25 «не урезать — подключить»): банкротство из ЕГРЮЛ
// и единый словарь блока приставов (API: загрузчик открытых данных ФССП). node --test tests/istochniki_bankrotstvo_fssp.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const K = path.join(__dirname, '..');
const I = require('../js/istochniki.js');
const IM = require('../js/imya.js');
const U = require('../js/usloviya.js');
const S = require('../js/sushchestvennoe.js');
const O = require('../js/otkuda.js');
const IO = require('../js/indeks-otvet.js');
IO.ustanovit(require('../indeks/metodika-v1.json'), require('../indeks/indeks.js'));
const bezNb = (h) => String(h).replace(/ /g, ' ');

const SEM = [['sudy', 'Арбитражные суды'], ['bankrotstvo', 'Банкротство'], ['fssp', 'Приставы'], ['priostanovki', 'Приостановки'],
  ['mery', 'Обеспечительные меры ФНС'], ['rnp', 'РНП'], ['kontrakty', 'Госконтракты']];
function damia() {
  const d = { versiya: 'damia-v1.4', polnota: { provereno: 0, iz: 7 } };
  SEM.forEach(([k, n]) => { d[k] = { nazvanie: n, status: 'ne_provereno', sostoyanie: 'not_checked', prichina: 'в открытой бете не подключён', proverit_samim: 'https://example.org/' + k, istochnik: 'DaMIA' }; });
  return d;
}
// Форма живого ответа /api/check 11.10.2026 (damia-v1.4); компания вымышленная
function otvet(status, detail, over) {
  return Object.assign({
    company: { inn: '7700000001', ogrn: '1027700000001', kind: 'LEGAL', name_short: 'ООО "ПРИМЕР"', status, reg_date: '2010-09-05', okved: '47.91', invalid: false, address_invalid: false },
    risk_level: 'low', verdict: 'Работать можно. Серьёзных признаков риска не найдено.', checked_at: '2026-10-11T22:23:00Z',
    signals: [{ id: 'status', title: 'Статус', status: status === 'ACTIVE' ? 'ok' : 'bad', detail, source: 'ЕГРЮЛ/ЕГРИП', as_of: null },
      { id: 'tax_debt', title: 'Задолженность по налогам', status: 'ok', detail: 'Нет', source: 'ФНС, открытые данные', as_of: '01.09.2026' }],
    damia: damia(),
    dossier: { kpi: [{ label: 'Выручка за 2025', value: 48.2e6 }], charts: { revenue: [{ year: 2024, value: 40e6 }, { year: 2025, value: 48.2e6 }] }, sections: [] }
  }, over || {});
}

test('действующая компания: «Банкротство» — не найдено по ЕГРЮЛ, дата проверки по Москве, оговорка про ЕФРСБ', () => {
  const r = I.dopolnit(otvet('ACTIVE', 'Действующая'));
  const b = r.damia.bankrotstvo;
  assert.strictEqual(b.status, 'not_found');
  assert.strictEqual(b.sostoyanie, 'not_found');
  assert.strictEqual(b.istochnik, 'ЕГРЮЛ ФНС');
  assert.strictEqual(b.data_svedeniy, '2026-10-12'); // 22:23 UTC = 01:23 МСК следующего дня
  assert.match(bezNb(b.itog), /Отметки о банкротстве в ЕГРЮЛ нет; сообщения ЕФРСБ не проверяли/);
  assert.strictEqual(b.proverit_samim, 'https://example.org/bankrotstvo'); // ссылку API сохраняем
  assert.deepStrictEqual(r.damia.polnota, { provereno: 1, iz: 7 });
});

test('вывод «Условий сделки»: банкротство уходит из «Не проверяли», суды и приставы — остаются', () => {
  const r = I.dopolnit(otvet('ACTIVE', 'Действующая'));
  assert.deepStrictEqual(U.neProverenyKlyuchevye(r), ['арбитражные суды', 'приставы']);
  assert.deepStrictEqual(U.vVyvode(r), ['sudy', 'fssp']);
});

test('банкрот: «Банкротство» найдено, в «Существенных фактах» не дублирует «Статус», в «Все данные» — с ссылкой на ЕФРСБ', () => {
  const r = I.dopolnit(otvet('BANKRUPT', 'В процессе банкротства'));
  assert.strictEqual(r.damia.bankrotstvo.status, 'found');
  const f = S.fakty(r);
  assert.ok(!f.spisok.concat(f.eshche).some(x => x.k === 'damia_bankrotstvo'), 'строка банкротства не повторяет «Статус»');
  const g = S.glubina(r).razdely.find(x => x.zag === 'Внешние реестры');
  const row = g.stroki.find(x => x[0] === 'Банкротство');
  assert.match(bezNb(row[1]), /Процедура банкротства — отметка в ЕГРЮЛ/);
  assert.strictEqual(row[2], 'bad');
  assert.strictEqual(row[4], 'ЕГРЮЛ ФНС');
});

test('ответ API с проверкой ЕФРСБ не перетираем; ИП, ликвидированная и пустой статус — без подстановки', () => {
  const r1 = otvet('ACTIVE', 'Действующая');
  r1.damia.bankrotstvo = { nazvanie: 'Банкротство', status: 'not_found', istochnik: 'ЕФРСБ', data_svedeniy: '2026-10-11' };
  assert.strictEqual(I.dopolnit(r1).damia.bankrotstvo.istochnik, 'ЕФРСБ');
  const ip = otvet('ACTIVE', 'Действующий'); ip.company.kind = 'INDIVIDUAL'; ip.company.inn = '770000000012';
  assert.strictEqual(I.dopolnit(ip).damia.bankrotstvo.status, 'ne_provereno');
  const lq = I.dopolnit(otvet('LIQUIDATED', 'Ликвидирована'));
  assert.strictEqual(lq.damia.bankrotstvo.status, 'not_applicable');
  const pust = otvet('', ''); pust.signals = [];
  assert.strictEqual(I.dopolnit(pust).damia.bankrotstvo.status, 'ne_provereno');
});

test('общая точка: DlkImya.ispravitOtvet дополняет ответ (главная, Паспорт, PDF — один путь)', () => {
  const r = IM.ispravitOtvet(otvet('ACTIVE', 'Действующая'));
  assert.strictEqual(r.damia.bankrotstvo.status, 'not_found');
  assert.strictEqual(r.company.name_short, 'ООО «ПРИМЕР»');
});

test('«Откуда данные»: банкротство — ответил, «по отметке в ЕГРЮЛ, сообщения ЕФРСБ не проверяли»', () => {
  const o = O.istochniki(I.dopolnit(otvet('ACTIVE', 'Действующая')));
  const x = o.spisok.find(s => s.k === 'damia:bankrotstvo');
  assert.strictEqual(x.status, 'ok');
  assert.strictEqual(bezNb(x.dop), 'по отметке в ЕГРЮЛ, сообщения ЕФРСБ не проверяли');
  assert.match(bezNb(O.html(I.dopolnit(otvet('ACTIVE', 'Действующая')))), /дела о банкротстве; по отметке в ЕГРЮЛ/);
});

test('Индекс: банкротство из ЕГРЮЛ полноту «Федресурс и ЕФРСБ» не даёт; ответ приставов — даёт', () => {
  const r = I.dopolnit(otvet('ACTIVE', 'Действующая'));
  assert.strictEqual(IO.izOtveta(r).dostupno.fedresurs, false);
  r.damia.fssp = { nazvanie: 'Приставы', status: 'not_found', istochnik: 'ФССП, открытые данные', data_svedeniy: '2026-10-10', tochnost: 'inn' };
  I.dopolnit(r);
  assert.strictEqual(r.damia.fssp.sostoyanie, 'not_found');
  assert.strictEqual(IO.izOtveta(r).dostupno.fssp, true);
  assert.ok(!U.neProverenyKlyuchevye(r).includes('приставы'));
});

test('Индекс: остаток у приставов больше 5 % выручки — фактор «Долги у приставов»; меньше — нет', () => {
  const r = otvet('ACTIVE', 'Действующая');
  r.damia.fssp = { nazvanie: 'Приставы', status: 'found', itog: '3 открытых производства · остаток 3 млн ₽', summa_ostatka: 3e6, chislo: 3, istochnik: 'ФССП, открытые данные', data_svedeniy: '2026-10-10', tochnost: 'inn' };
  assert.strictEqual(IO.izOtveta(I.dopolnit(r)).fakty.pristavy_krupnye, true);
  r.damia.fssp.summa_ostatka = 1e6;
  assert.ok(!IO.izOtveta(r).fakty.pristavy_krupnye);
});

test('приставы по названию и адресу (в наборе ФССП нет ИНН): пометка точности и ссылка «проверьте сами»', () => {
  const r = otvet('ACTIVE', 'Действующая');
  r.damia.fssp = { nazvanie: 'Приставы', status: 'not_found', itog: 'Открытых исполнительных производств нет', istochnik: 'ФССП, открытые данные', data_svedeniy: '2026-10-10', tochnost: 'naimenovanie_adres', proverit_samim: 'https://fssp.gov.ru/iss/ip/' };
  const row = S.glubina(I.dopolnit(r)).razdely.find(x => x.zag === 'Внешние реестры').stroki.find(x => x[0] === 'Приставы');
  assert.match(bezNb(row[1]), /сопоставили по названию и адресу/);
  assert.strictEqual(row[3], 'https://fssp.gov.ru/iss/ip/');
});

test('istochniki.js подключён раньше imya.js на всех страницах, где разбирают ответ проверки', () => {
  const stranicy = ['index.html', 'report.html', 'cabinet.html', 'pasport/index.html', 'pasport/kontragent/index.html', 'proverit-schet/index.html', 'delopis/index.html'];
  for (const p of stranicy) {
    const h = fs.readFileSync(path.join(K, p), 'utf8');
    const a = h.indexOf('/js/istochniki.js'), b = h.indexOf('/js/imya.js');
    assert.ok(a > 0 && b > a, p);
  }
});
