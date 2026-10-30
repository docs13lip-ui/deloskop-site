// doverie-2b (30.10.2026) — /sravnit/: суды по единому словарю источников и правилу «устарело».
// Воспроизведение на 5afb005c + doverie-2: пакет /js/b/sravnit.* не содержал js/istochniki.js — DlkImya.ispravitOtvet не вызывал
// dopolnit, и строка «Арбитражные суды» по живому ответу 30.10 (Альфа-Банк, 7728168971: картотека на 12.10, 0 незавершённых дел
// ответчиком) была зелёной «Незавершённых дел ответчиком нет» по сведениям 18-дневной давности. А просто добавить dopolnit было нельзя:
// он переводит status «polucheno» → found / not_found / stale, и прежняя ySudy показала бы у всех «Не проверяли».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const S = require('../js/sravnenie.js');
const I = require('../js/istochniki.js');
const sp = (s) => String(s).replace(/ /g, ' ');

function otvet(sudy, checked) {
  return {
    company: { inn: '7728168971', kind: 'LEGAL', name_short: 'АО «Альфа»', status: 'ACTIVE', reg_date: '1998-01-20' },
    risk_level: 'low', signals: [{ id: 'status', title: 'Статус', status: 'ok', detail: 'Действующая' }], zsk: { level: 'low', title: 'Низкая' },
    dossier: { kpi: [] }, checked_at: checked || '2026-10-30',
    damia: { sudy: sudy, polnota: { provereno: 3, iz: 7 } }
  };
}
const sudy = (n, data) => ({ nazvanie: 'Арбитражные суды', istochnik: 'Картотека арбитражных дел (через DaMIA)', status: 'polucheno', sostoyanie: 'found',
  data_svedeniy: data, itog: 'Компания — ответчик в ' + n + ' незавершённых делах.', dannye: { vsego: 500, otvetchik: 24, otvetchik_nezaversheno: n } });
const stroka = (r) => S.stroki(r, r, {}).find((x) => x.k === 'sudy').a;

test('пакет /sravnit/: js/istochniki.js раньше js/imya.js (иначе dopolnit не вызывается)', () => {
  const p = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'partials', 'sborka.json'), 'utf8')).pakety.sravnit;
  assert.ok(p.indexOf('js/istochniki.js') >= 0, 'istochniki.js в пакете sravnit');
  assert.ok(p.indexOf('js/istochniki.js') < p.indexOf('js/imya.js'));
});

test('воспроизведение: 0 дел ответчиком по сведениям 18-дневной давности — не «чисто», а «данные устарели» (сырой и дополненный ответ)', () => {
  for (const r of [otvet(sudy(0, '2026-10-12T16:41+03:00')), I.dopolnit(otvet(sudy(0, '2026-10-12T16:41+03:00')))]) {
    const y = stroka(r);
    assert.strictEqual(y.t, 'Данные устарели');
    assert.strictEqual(y.ton, 'neutral', 'неизвестное — нейтрально, не зелёное');
    assert.ok(y.nepr, 'в подсчёт отметок не входит');
    assert.match(sp(y.pod), /сведения на 12\.10\.2026 могли измениться/);
  }
});

test('найденные дела в устаревших сведениях — видны (warn) с датой и «могли измениться»', () => {
  const y = stroka(I.dopolnit(otvet(sudy(4, '2026-10-14T04:08+03:00'))));
  assert.strictEqual(sp(y.t), 'Ответчик в 4 незавершённых делах');
  assert.strictEqual(y.ton, 'warn');
  assert.strictEqual(sp(y.pod), 'всего дел: 500 · на 14.10.2026, могли измениться');
});

test('свежие сведения (≤ 7 дней) — как раньше: «нет» зелёным, после dopolnit тоже', () => {
  const y = stroka(I.dopolnit(otvet(sudy(0, '2026-10-27T10:00+03:00'))));
  assert.strictEqual(sp(y.t), 'Незавершённых дел ответчиком нет');
  assert.strictEqual(y.ton, 'ok');
  assert.ok(!/могли измениться/.test(y.pod));
});

test('замороженный источник без ответа — «Не проверяли: источник сейчас не обновляется», без «обновите завтра»', () => {
  const r = I.dopolnit(otvet({ nazvanie: 'Арбитражные суды', status: 'ne_provereno', sostoyanie: 'not_checked',
    prichina: 'сегодня источник недоступен для новых проверок — обновите отчёт завтра' }));
  const y = stroka(r);
  assert.strictEqual(y.t, 'Не проверяли');
  assert.match(sp(y.pod), /^источник сейчас не обновляется — проверьте сами в картотеке kad\.arbitr\.ru$/);
  assert.ok(!/завтра/.test(y.pod));
});

test('устаревшее с одной стороны и свежее с другой — не «расходятся» (пробел в данных)', () => {
  const a = I.dopolnit(otvet(sudy(0, '2026-10-12T16:41+03:00')));
  const b = I.dopolnit(otvet(sudy(0, '2026-10-28T10:00+03:00')));
  const x = S.stroki(a, b, {}).find((z) => z.k === 'sudy');
  assert.strictEqual(x.a.ton, 'neutral');
  assert.strictEqual(x.b.ton, 'ok');
  assert.ok(!x.raznye);
});
