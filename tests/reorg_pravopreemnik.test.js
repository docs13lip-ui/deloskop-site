// reorg-pravopreemnik-v1 [Ночные-3] 10.10: реорганизация с прекращением (коды 122–125, 129) — «только по факту»
// до проверки правопреемника (позиция [Право] 10.10 10:07, разд. 3). Запуск: node --test tests/reorg_pravopreemnik.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const U = require('../js/usloviya.js');

const NOW = '2026-10-10T09:00:00+03:00';
function resp(kod, extra) {
  const c = { inn: '7700000000', name_short: 'ООО «Тест»', status: 'REORGANIZING', reg_date: '2012-03-01' };
  if (kod !== undefined) c.state_code = kod;
  return Object.assign({ checked_at: NOW, risk_level: 'low', company: c, signals: [],
    dossier: { kpi: [{ label: 'Выручка за 2025', value: 780000000 }] } }, extra || {});
}

test('коды с прекращением — ровно те, что в справочнике СЮЛСТ с «прекратит»', () => {
  const sp = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'statusy-egryul.json'), 'utf8'));
  const kody = sp.kody.filter((k) => k.gruppa === 'reorganizaciya' && /^12\d$/.test(k.kod) && k.kod !== '121').map((k) => k.kod).sort();
  assert.deepStrictEqual(U.REORG_PREKRASHCHENIE.slice().sort(), kody);
});

for (const kod of ['122', '123', '124', '125', '129']) {
  test('код ' + kod + ' → post, предел 0, правопреемник в заголовке и совете (оба направления)', () => {
    const v = U.decide(resp(kod), { amount: 500000 });
    assert.strictEqual(v.tone, 'post');
    assert.strictEqual(v.cap, 0);
    assert.strictEqual(v.headline, 'Только оплата по факту\u00a0— до проверки правопреемника');
    assert.match(v.advice, /правопреемник/);
    assert.match(v.advice, /п\. 2 ст\. 60 ГК РФ/);
    assert.match(v.kak.kak, /^Вперёд — 0 ₽: компания реорганизуется и прекратит существование, правопреемника мы не проверяли/);
    assert.match(v.prepay, /^Предоплату не вносите/);
    assert.doesNotMatch(v.headline + v.advice, /до\s*15/);
    const o = U.decide(resp(kod), { napravlenie: 'otgruzhaem', amount: 500000 });
    assert.strictEqual(o.tone, 'post');
    assert.strictEqual(o.headline, 'Только по предоплате\u00a0— до проверки правопреемника');
    assert.match(o.advice, /^Отсрочку не давайте/);
    assert.match(o.kak.kak, /В долг — 0 ₽: компания реорганизуется/);
  });
}

for (const kod of [undefined, '121', '131', '132', '139', '']) {
  test('реорганизация ' + (kod === undefined ? 'без кода' : 'с кодом «' + kod + '»') + ' — как раньше: cap с пределом', () => {
    const v = U.decide(resp(kod));
    assert.strictEqual(v.tone, 'cap');
    assert.ok(v.cap > 0);
    assert.doesNotMatch(v.headline, /правопреемник/);
    assert.doesNotMatch(v.advice, /правопреемник/);
  });
}

test('код 122 у действующей компании (статус не REORGANIZING) — не трогаем', () => {
  const r = resp('122'); r.company.status = 'ACTIVE';
  const v = U.decide(r);
  assert.strictEqual(v.tone, 'go');
});

test('стоп-признаки сильнее: ликвидация/ЗСК high остаются stop', () => {
  const v = U.decide(resp('124', { zsk: { level: 'high' } }));
  assert.strictEqual(v.tone, 'stop');
});

test('тексты — без запрещённых слов (38-ФЗ, 222-ФЗ) и без обещаний исхода', () => {
  const v = U.decide(resp('122'));
  const t = [v.headline, v.advice, v.kak.kak].join(' ');
  assert.doesNotMatch(t, /надёжн|надежн|лучш|гарантир|100\s*%/i);
});
