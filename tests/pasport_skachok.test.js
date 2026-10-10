// pasport-skachok-v1 [Ночные-3] 10.10.2026: «Скачок в отчётности» в Паспорте контрагента и PDF-досье —
// тот же расчёт и текст, что в «Динамике» экрана проверки (js/dinamika.js skachok, skachok-v1).
// Рост — справка в разделе 6; падение — «внимание»: раздел 6, «Главное» и «Что запросить». Запуск: node --test tests/pasport_skachok.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../js/dinamika.js');
const U = require('../js/usloviya.js');
const P = require('../js/pasport-kontragenta.js');
const KOREN = path.join(__dirname, '..');

const RYAD = (vals) => vals.map((v, i) => ({ year: 2021 + i, value: v }));
function otvet({ rev, aktDelta, aktValue = 212832135000 } = {}) {
  const kpi = [{ label: 'Выручка за 2025', value: rev ? rev[rev.length - 1] : 780000000 }];
  if (aktDelta !== undefined) kpi.push({ label: 'Активы', value: aktValue, delta: aktDelta, good_up: true });
  return { checked_at: '2026-10-10T21:30:00+03:00', risk_level: 'low', signals: [],
    company: { inn: '7700000777', ogrn: '1027700000777', kind: 'LEGAL', name_short: 'ООО «Тест»', status: 'ACTIVE', reg_date: '2010-03-01' },
    dossier: { kpi, charts: { revenue: rev ? RYAD(rev) : [], balance: { year: 2025, equity: 1, long_debt: 1, short_debt: 1 } } } };
}
const razdel = (p, id) => p.razdely.find((x) => x.id === id);
const fakt = (p, id, t) => ((razdel(p, id) || {}).fakty || []).find((f) => f.tekst === t);

test('рост активов ×3,9 (живой ответ 10.10) — справка в разделе 6 тем же текстом, что на экране проверки', () => {
  const r = otvet({ rev: [41e9, 42e9, 48e9, 51.26e9, 90.2e9], aktDelta: 294 });
  const p = P.sobrat(r, { usloviya: U, dinamika: D });
  const f = fakt(p, 'finansy', 'Скачок в отчётности');
  assert.ok(f, 'есть строка');
  assert.strictEqual(f.znachenie, D.skachok(r).tekst, 'текст — дословно из Динамики');
  assert.strictEqual(f.ton, 'info');
  assert.strictEqual(f.data, '2025-12-31');
  assert.match(f.istochnik, /ГИР БО/);
  assert.ok(!fakt(p, 'zaprosit', 'Пояснение к отчётности'), 'при росте вопрос не нужен');
  assert.ok(!p.itog.glavnoe.some((g) => /Скачок/.test(g)), 'рост — не в «Главном»');
});

test('падение выручки на 58 % — «внимание», в «Главном» и в «Что запросить»', () => {
  const p = P.sobrat(otvet({ rev: [100e6, 90e6, 38e6] }), { usloviya: U, dinamika: D });
  const f = fakt(p, 'finansy', 'Скачок в отчётности');
  assert.strictEqual(f.ton, 'warn');
  assert.match(f.znachenie, /на\s58\s%\sменьше/);
  assert.doesNotMatch(f.znachenie, /Перед авансом/, 'совет — в «Что запросить», не в итоге');
  assert.strictEqual(razdel(p, 'finansy').ton, 'warn');
  assert.ok(p.itog.glavnoe.some((g) => /^Скачок в отчётности: /.test(g)), 'есть в «Главном»');
  const z = fakt(p, 'zaprosit', 'Пояснение к отчётности');
  assert.ok(z);
  assert.strictEqual(z.znachenie.replace(/\u00a0/g, ' '), 'Попросите письменно объяснить, что изменилось в 2023 году: почему выручка сократилась вдвое и больше.');
});

test('skVniz: называет только упавшие показатели, род глагола по смыслу', () => {
  assert.strictEqual(P.skVniz([{ k: 'aktivy', kRaz: 0.38 }]), 'активы сократились вдвое и больше');
  assert.strictEqual(P.skVniz([{ k: 'revenue', kRaz: 0.4 }, { k: 'aktivy', kRaz: 0.3 }]), 'выручка и активы сократились вдвое и больше');
  assert.strictEqual(P.skVniz([{ k: 'revenue', kRaz: 2.5 }, { k: 'aktivy', kRaz: 0.3 }]), 'активы сократились вдвое и больше', 'выросшую выручку не называем');
});

test('без скачка, без модуля Динамики и у ИП — строки нет, Паспорт как раньше', () => {
  const p = P.sobrat(otvet({ rev: [10e6, 15e6, 19e6], aktDelta: 60 }), { usloviya: U, dinamika: D });
  assert.ok(!fakt(p, 'finansy', 'Скачок в отчётности'));
  const bez = P.sobrat(otvet({ rev: [100e6, 90e6, 38e6] }), { usloviya: U, dinamika: { skachok() { throw new Error('x'); } } });
  assert.ok(!fakt(bez, 'finansy', 'Скачок в отчётности'), 'ошибка модуля не ломает Паспорт');
  const ip = otvet({ rev: [100e6, 90e6, 38e6] }); ip.company.kind = 'INDIVIDUAL'; ip.company.inn = '770000000777';
  assert.strictEqual(P.sobrat(ip, { usloviya: U, dinamika: D }).ip, true);
});

test('PDF-досье: «Динамика» в report.html выводит строку скачка (Dinamika.html → htmlDinamika)', () => {
  const html = fs.readFileSync(path.join(KOREN, 'report.html'), 'utf8');
  assert.match(html, /Dinamika\.html\(R,\{balans:false\}\)/);
  const r = otvet({ rev: [41e9, 42e9, 48e9, 51.26e9, 90.2e9], aktDelta: 294 });
  r.dossier.charts.profit = RYAD([1e9, 2e9, -5e8, 2.4e9, 2.7e9]);
  assert.match(D.html(r, { balans: false }), /data-blok="skachok"/);
});

test('страница Паспорта подключает Динамику до Паспорта; тексты без превосходных степеней и обещаний', () => {
  const h = fs.readFileSync(path.join(KOREN, 'pasport/kontragent/index.html'), 'utf8');
  const a = h.indexOf('/js/dinamika.js'), b = h.indexOf('/js/pasport-kontragenta.js');
  assert.ok(a > 0 && b > a);
  const p = P.sobrat(otvet({ rev: [100e6, 90e6, 38e6] }), { usloviya: U, dinamika: D });
  const t = fakt(p, 'zaprosit', 'Пояснение к отчётности').znachenie + fakt(p, 'finansy', 'Скачок в отчётности').znachenie;
  assert.doesNotMatch(t, /лучш|надёжн|гарант|точно|обязательно|мошен/i);
});
