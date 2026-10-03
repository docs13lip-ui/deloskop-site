// Ф8 (Ночные 30.09): Паспорт не говорит «нет» без реестра и даты — node --test tests/pasport_bez_net.test.js
// Паспорт — платный документ с отпечатком: «дисквалифицированных нет» из пустого поля DaData было бы утверждением от нашего имени без проверки.
'use strict';
const test = require('node:test');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const U = require(path.join(ROOT, 'js', 'usloviya.js'));
const IV = require(path.join(ROOT, 'js', 'indeks-vorota.js'));
const E = require(path.join(ROOT, 'pasport', 'engine.js'));

function demo(sig, extra) {
  const r = JSON.parse(JSON.stringify(E.DEMO));
  r.checked_at = '2026-09-29T10:14:00+03:00';
  if (sig) r.signals = r.signals.filter((s) => !/Дисквалиф/.test(s.title)).concat(sig === 'bez' ? [] : [Object.assign({ title: 'Дисквалифицированные руководители', detail: 'нет' }, sig)]);
  return Object.assign(r, extra || {});
}
const sob = (r, o) => P.sobrat(r, Object.assign({ usloviya: U, indeksVorota: IV }, o || {}));
const rz = (p, id) => p.razdely.find((x) => x.id === id);
const diskvFakt = (p) => rz(p, 'lyudi').fakty.find((f) => /дисквалиф/i.test(f.tekst));
const nzStroka = (p) => rz(p, 'ne_znaem').fakty.find((f) => /^3\. /.test(f.tekst));

test('образец: «дисквалифицированных нет» из DaData (без даты) — не факт, а «не проверяли» в разделах 3 и 16', () => {
  const p = sob(demo());
  const l = rz(p, 'lyudi');
  assert.strictEqual(diskvFakt(p), undefined, 'в разделе 3 не должно быть строки «Дисквалифицированные — нет»');
  assert.match(l.chastichno, /реестр дисквалифицированных лиц ФНС не проверяли/);
  assert.ok(l.sam.some((a) => a.url === 'https://service.nalog.ru/disqualified.do'), 'дорога к реестру ФНС');
  assert.notStrictEqual(l.vyvod, 'Сведения получены, настораживающих отметок в этом разделе нет.');
  assert.match(l.vyvod, /Проверено не всё/);
  assert.ok(nzStroka(p) && /дисквалифицированных/.test(nzStroka(p).znachenie), 'строка в «Чего мы не знаем»');
  assert.deepStrictEqual(P.proverit(p), []);
});

test('строки дисквалификации нет вовсе — всё равно «не проверяли», а не молчание', () => {
  const p = sob(demo('bez'));
  assert.match(rz(p, 'lyudi').chastichno, /не проверяли/);
  assert.ok(nzStroka(p));
});

test('отметка источника (bad/warn) — факт, даже без даты; дорогу к реестру не навязываем', () => {
  [{ status: 'bad', detail: 'руководитель дисквалифицирован до 01.03.2027', as_of: '2026-09-01', source: 'ФНС' },
   { status: 'warn', detail: 'есть отметка', source: 'ЕГРЮЛ' }].forEach((sig) => {
    const p = sob(demo(sig));
    const f = diskvFakt(p);
    assert.ok(f && f.ton === sig.status, sig.status);
    assert.ok(!/дисквалифицированных/.test(rz(p, 'lyudi').chastichno || ''));
    assert.ok(p.itog.glavnoe.some((t) => /Дисквалиф/.test(t)), 'поднимается в главное');
  });
});

test('ответ реестра ФНС с датой — «не найдено на дату» законно; без даты — нет', () => {
  let p = sob(demo({ status: 'ok', source: 'ФНС, реестр дисквалифицированных лиц', as_of: '2026-09-27' }));
  assert.ok(diskvFakt(p) && diskvFakt(p).data === '2026-09-27');
  assert.ok(!nzStroka(p) || !/дисквалифицированных/.test(nzStroka(p).znachenie));
  p = sob(demo({ status: 'ok', source: 'ФНС, реестр дисквалифицированных лиц' }));
  assert.strictEqual(diskvFakt(p), undefined);
});

test('любое «нет» без даты сведений (кроме записи ЕГРЮЛ) — не факт; с датой — факт', () => {
  const r = demo();
  r.signals.push({ title: 'Недоимка по взносам', status: 'ok', detail: 'не обнаружена', source: 'ФНС' });
  let p = sob(r);
  const n = rz(p, 'nalogi');
  assert.ok(!n.fakty.some((f) => /Недоимка по взносам/.test(f.tekst)));
  assert.match(n.chastichno, /Недоимка по взносам.*без даты/);
  assert.deepStrictEqual(P.proverit(p), []);
  // с датой — законный факт; ЕГРЮЛ без даты — тоже (отсутствие записи в выписке на день получения)
  r.signals[r.signals.length - 1].as_of = '2026-09-01';
  p = sob(r);
  assert.ok(rz(p, 'nalogi').fakty.some((f) => /Недоимка по взносам/.test(f.tekst)));
  assert.ok(rz(p, 'rekvizity').fakty.some((f) => /Недостоверность/.test(f.tekst) && f.znachenie === 'отметок нет'));
});

test('руководителя нет в сведениях — раздел 3 «не проверяли» с причиной и ссылкой на реестр', () => {
  const r = demo('bez'); r.company.director_name = ''; r.company.director_post = '';
  const p = sob(r);
  const l = rz(p, 'lyudi');
  assert.strictEqual(l.status, 'not_checked');
  assert.match(l.prichina, /дисквалифицированных/);
  assert.ok(l.sam.length);
  assert.deepStrictEqual(P.proverit(p), []);
});

test('сторож: proverit ловит «нет» без даты, если оно просочится в раздел с первоисточником', () => {
  const p = sob(demo());
  rz(p, 'lyudi').fakty.push({ tekst: 'Дисквалифицированные руководители', znachenie: 'нет', ton: 'ok', data: null, istochnik: 'ФНС' });
  assert.ok(P.proverit(p).some((e) => /^3: «нет» без даты/.test(e)));
});

test('весь выход образца и вариантов: ни одного «нет» без даты в разделах со сведениями', () => {
  const vary = [demo(), demo('bez'), demo({ status: 'ok' }), demo({ status: 'info', detail: 'не значится' }), demo(null, { dostup: 'free' })];
  vary.forEach((r, i) => {
    const p = sob(r);
    p.razdely.filter((x) => x.vid === 'istochnik').forEach((x) => x.fakty.forEach((f) => {
      assert.ok(!P.netBezDaty(f.tekst, f.znachenie, f.ton, f.data, f.istochnik), 'вариант ' + i + ', раздел ' + x.n + ': ' + f.tekst + ' — ' + f.znachenie);
    }));
  });
});

test('версия документа поднята — Паспорта до и после правки различимы', () => {
  assert.strictEqual(P.VERSIYA, 'Паспорт v2.8');
});

test('Паспорт своей компании (/pasport/): «нет» без реестра и даты — в «Не проверяли», не в «Проверили — отметок не нашли»', () => {
  const r = JSON.parse(JSON.stringify(E.DEMO));
  r.signals.push({ title: 'Исполнительные производства', status: 'ok', detail: 'не найдены', source: 'ФССП' });
  let g = E.classify(r);
  assert.ok(g.ne.some((x) => /Дисквалиф/.test(x.title)));
  assert.ok(g.ne.some((x) => /Исполнительные/.test(x.title)));
  assert.ok(!g.clean.some((x) => /Дисквалиф|Исполнительные/.test(x.title)));
  assert.ok(g.clean.some((x) => /Недостоверность/.test(x.title)), 'ЕГРЮЛ «отметок нет» — остаётся');
  assert.ok(g.real.some((x) => /Долги по налогам/.test(x.title)) || g.clean.some((x) => /Долги по налогам/.test(x.title)), '«нет» с датой — остаётся');
  const h = E.headline(g);
  assert.ok(!/По открытым данным ФНС/.test(h.text));
  r.signals = r.signals.map((s) => /Дисквалиф/.test(s.title) ? Object.assign(s, { source: 'ФНС, реестр дисквалифицированных лиц', as_of: '2026-09-27' }) : s);
  g = E.classify(r);
  assert.ok(g.clean.some((x) => /Дисквалиф/.test(x.title)));
});
