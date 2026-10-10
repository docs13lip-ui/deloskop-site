// status-tochno-v1 (10.10.2026, [Ночные-3]): у ликвидации (101, 102) и предстоящего исключения (105–108, 110)
// в ответе /api/check один статус LIQUIDATING. Код состояния есть — шапка отчёта, вывод «Условий сделки», Щит,
// Паспорт и PDF-досье пишут точно; кода нет — прежний общий текст. Названия совпадают с «Что изменилось» (js/dinamika.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const SK = require('../js/status-kod.js');
const U = require('../js/usloviya.js');
const KOREN = path.join(__dirname, '..');
const NB = ' ';

const otvet = (status, kod) => ({ checked_at: '2026-10-10T06:30:00+03:00', risk_level: 'high',
  company: { inn: '7700000104', name_short: 'ООО «Закат»', status, state_code: kod, reg_date: '2012-01-01', kind: 'LEGAL' }, signals: [] });

test('коды → названия: 101/102 ликвидируется, 105–108 и 110 — исключение, 407… — исключена; без кода — как раньше', () => {
  assert.strictEqual(SK.nazv('LIQUIDATING', '101'), 'ликвидируется');
  assert.strictEqual(SK.nazv('LIQUIDATING', 102), 'ликвидируется');
  for (const k of ['105', '106', '107', '108', '110']) assert.strictEqual(SK.nazv('LIQUIDATING', k), 'готовится исключение из' + NB + 'ЕГРЮЛ', k);
  for (const k of ['407', '414', '415', '418', '420']) assert.strictEqual(SK.nazv('LIQUIDATED', k), 'исключена из' + NB + 'ЕГРЮЛ', k);
  assert.strictEqual(SK.nazv('LIQUIDATING', ''), 'ликвидируется или исключается из' + NB + 'ЕГРЮЛ');
  assert.strictEqual(SK.nazv('LIQUIDATING', '111'), 'ликвидируется или исключается из' + NB + 'ЕГРЮЛ', 'неизвестный для LIQUIDATING код — общий текст');
  assert.strictEqual(SK.nazv('ACTIVE', '101'), 'действующая', 'код без статуса LIQUIDATING не меняет действующую');
  assert.strictEqual(SK.nazv('REORGANIZING', '124'), 'реорганизация');
  assert.strictEqual(SK.izOtveta({ status: 'LIQUIDATING', state_code: '106' }, { zaglavnaya: true }), 'Готовится исключение из' + NB + 'ЕГРЮЛ');
});

test('те же названия, что в «Что изменилось» (js/dinamika.js nazvSt) и группах справочника кодов', () => {
  const din = fs.readFileSync(path.join(KOREN, 'js/dinamika.js'), 'utf8');
  assert.ok(din.includes("return 'исключена из' + NB + 'ЕГРЮЛ'"));
  assert.ok(din.includes("'готовится исключение из' + NB + 'ЕГРЮЛ' : 'ликвидируется'"));
  const D = JSON.parse(fs.readFileSync(path.join(KOREN, 'data/statusy-egryul.json'), 'utf8'));
  const po = (g) => D.kody.filter((k) => k.gruppa === g).map((k) => k.kod).sort().join(',');
  assert.strictEqual(po('likvidaciya'), Object.keys(SK.LIKV).sort().join(','));
  assert.strictEqual(po('isklyuchenie'), Object.keys(SK.ISKL).sort().join(','));
  assert.strictEqual(po('isklyuchena'), Object.keys(SK.ISKLYUCHENA).sort().join(','));
});

test('вывод «Условий сделки»: причина по коду, тон и заголовок прежние', () => {
  const a = U.decide(otvet('LIQUIDATING', '101'));
  const b = U.decide(otvet('LIQUIDATING', '106'));
  const c = U.decide(otvet('LIQUIDATING', undefined));
  const txt = (d) => JSON.stringify(d);
  assert.ok(txt(a).includes('компания ликвидируется'), txt(a).slice(0, 300));
  assert.ok(!txt(a).includes('или ФНС готовит её исключение'));
  assert.ok(txt(b).includes('ФНС готовит исключение компании из'));
  assert.ok(txt(c).includes('компания ликвидируется или ФНС готовит её исключение из ЕГРЮЛ'));
  assert.strictEqual(a.headline, c.headline);
  assert.strictEqual(a.tone, c.tone);
});

test('Паспорт: строка «Статус» по коду', () => {
  const P = require('../js/pasport-kontragenta.js');
  const p = P.sobrat(otvet('LIQUIDATING', '105'), { segodnya: new Date('2026-10-10T06:30:00+03:00') });
  assert.ok(JSON.stringify(p).includes('Готовится исключение из'), 'нет точного статуса в Паспорте');
});

test('модуль подключён раньше потребителей на всех страницах отчёта', () => {
  for (const [f, posle] of [['index.html', 'usloviya.js'], ['report.html', 'pasport-kontragenta.js'], ['pasport/kontragent/index.html', 'usloviya.js'], ['indeks/index.html', 'usloviya.js']]) {
    const s = fs.readFileSync(path.join(KOREN, f), 'utf8');
    const i = s.indexOf('/js/status-kod.js'), j = s.indexOf('/js/' + posle);
    assert.ok(i > 0 && i < j, f + ': status-kod.js не подключён до ' + posle);
  }
});

test('Щит: строка выхода из бизнеса по коду', () => {
  const S = require('../js/shchit.js');
  const z = S.razbor(otvet('LIQUIDATING', '102'), { usloviya: U });
  assert.ok(JSON.stringify(z).includes('Компания ликвидируется'), JSON.stringify(z).slice(0, 400));
  assert.ok(!JSON.stringify(z).includes('или ФНС готовит её исключение'));
});
