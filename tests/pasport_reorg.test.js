// pasport-reorg-v1 [Ночные-3] 10.10.2026: Паспорт контрагента и PDF-досье при реорганизации.
// Форма реорганизации — по коду состояния ЕГРЮЛ (СЮЛСТ, data/statusy-egryul.json); у формы с прекращением компании
// (122–125, 129) в разделе «Предел аванса» — «Правопреемник»: тот же текст, что в совете «Условий сделки»
// (позиция [Право] 10.10, reorg-pravopreemnik-v1). Без кода — как раньше. Запуск: node --test tests/pasport_reorg.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const SK = require('../js/status-kod.js');
const U = require('../js/usloviya.js');
const P = require('../js/pasport-kontragenta.js');
const KOREN = path.join(__dirname, '..');

function otvet(st, kod) {
  const c = { inn: '7700000124', ogrn: '1027700000124', kind: 'LEGAL', name_short: 'ООО «Тест»', status: st, reg_date: '2012-03-01' };
  if (kod !== undefined) c.state_code = kod;
  return { checked_at: '2026-10-10T17:30:00+03:00', risk_level: 'low', company: c, signals: [],
    dossier: { kpi: [{ label: 'Выручка за 2025', value: 780000000 }] } };
}
const razdel = (p, id) => p.razdely.find((x) => x.id === id);
const fakt = (p, id, t) => (razdel(p, id).fakty || []).find((f) => f.tekst === t);

test('формы реорганизации — ровно коды группы reorganizaciya справочника, слово формы — из официального названия', () => {
  const D = JSON.parse(fs.readFileSync(path.join(KOREN, 'data/statusy-egryul.json'), 'utf8'));
  const kody = D.kody.filter((k) => k.gruppa === 'reorganizaciya');
  assert.deepStrictEqual(Object.keys(SK.REORG_FORMA).sort(), kody.map((k) => k.kod).sort());
  for (const k of kody) {
    const forma = SK.REORG_FORMA[k.kod].replace(/ /g, ' ');
    const slovo = forma.split(/[ ,]/)[0];
    const koren = slovo === 'сочетание' ? 'сочетании' : slovo.slice(0, 6);
    assert.ok(k.nazvanie.toLowerCase().includes(koren), k.kod + ': «' + koren + '» нет в «' + k.nazvanie + '»');
    if (k.kod === '129') assert.match(forma, /прекратит деятельность/);
    if (k.kod === '139') assert.match(forma, /продолжит деятельность/);
  }
});

test('reorgForma: только REORGANIZING и известный код; название статуса (nazv) не меняется', () => {
  assert.strictEqual(SK.reorgForma('REORGANIZING', '124'), 'присоединение к другому юрлицу');
  assert.strictEqual(SK.reorgForma('REORGANIZING', 122), 'слияние');
  assert.strictEqual(SK.reorgForma('REORGANIZING', ''), '');
  assert.strictEqual(SK.reorgForma('REORGANIZING', '999'), '');
  assert.strictEqual(SK.reorgForma('ACTIVE', '124'), '');
  assert.strictEqual(SK.reorgForma('LIQUIDATING', '101'), '');
  assert.strictEqual(SK.nazv('REORGANIZING', '124'), 'реорганизация');
});

for (const kod of ['122', '123', '124', '125', '129']) {
  test('Паспорт, код ' + kod + ': форма реорганизации в реквизитах и «Правопреемник» в пределе аванса', () => {
    const p = P.sobrat(otvet('REORGANIZING', kod), { usloviya: U });
    const f = fakt(p, 'rekvizity', 'Форма реорганизации');
    assert.ok(f, 'есть строка формы');
    assert.strictEqual(f.ton, 'warn');
    assert.strictEqual(f.istochnik, 'ЕГРЮЛ');
    assert.ok(f.znachenie.startsWith(SK.REORG_FORMA[kod]));
    assert.ok(f.znachenie.includes('(код ' + kod + ' по справочнику СЮЛСТ ФНС)'));
    const pr = fakt(p, 'predel', 'Правопреемник');
    assert.ok(pr, 'есть «Правопреемник»');
    assert.strictEqual(pr.znachenie, U.REORG_SDELAT + ' ' + U.REORG_DOLG);
    assert.match(pr.istochnik, /п\. 2 ст\. 60 ГК РФ/);
    assert.strictEqual(fakt(p, 'predel', 'Предел аванса').znachenie, U.money(0));
    assert.match(p.itog.vyvod, /до проверки правопреемника/);
  });
}

for (const kod of ['121', '131', '132', '139']) {
  test('Паспорт, код ' + kod + ' (компания продолжит деятельность или преобразуется): форма есть, «Правопреемника» нет', () => {
    const p = P.sobrat(otvet('REORGANIZING', kod), { usloviya: U });
    assert.ok(fakt(p, 'rekvizity', 'Форма реорганизации'));
    assert.strictEqual(fakt(p, 'predel', 'Правопреемник'), undefined);
  });
}

test('без кода и у действующей — ни формы, ни «Правопреемника» (как раньше)', () => {
  for (const [st, kod] of [['REORGANIZING', undefined], ['ACTIVE', '124'], ['LIQUIDATING', '101']]) {
    const p = P.sobrat(otvet(st, kod), { usloviya: U });
    assert.strictEqual(fakt(p, 'rekvizity', 'Форма реорганизации'), undefined, st + ' ' + kod);
    assert.strictEqual(fakt(p, 'predel', 'Правопреемник'), undefined, st + ' ' + kod);
  }
});

test('признак сервера с официальным названием формы уже есть — строку формы не дублируем, «Правопреемник» остаётся', () => {
  const r = otvet('REORGANIZING', '124');
  r.signals = [{ title: 'Статус', status: 'warn', detail: 'Находится в процессе реорганизации в форме присоединения к другому юрлицу', source: 'ЕГРЮЛ' }];
  const p = P.sobrat(r, { usloviya: U });
  assert.strictEqual(fakt(p, 'rekvizity', 'Форма реорганизации'), undefined);
  assert.ok(fakt(p, 'predel', 'Правопреемник'));
});

test('бесплатный Паспорт: «Правопреемник» остаётся (раздел «Предел аванса» — бесплатный)', () => {
  const p = P.sobrat(otvet('REORGANIZING', '124'), { usloviya: U, dostup: 'free' });
  assert.ok(fakt(p, 'predel', 'Правопреемник'));
});

test('PDF-досье (report.html): статус с формой реорганизации, status-kod.js подключён до разметки', () => {
  const h = fs.readFileSync(path.join(KOREN, 'report.html'), 'utf8');
  assert.ok(h.includes('<script src="/js/status-kod.js"></script>'));
  // строка «Сведения о компании» (ответ без досье) и подзаголовок под названием (всегда)
  assert.ok(h.includes("StatusKod.reorgForma(c.status,c.state_code)?' — '+StatusKod.reorgForma(c.status,c.state_code):''"));
  assert.ok(h.includes("StatusKod.reorgForma(c.status,c.state_code)?' ('+esc(StatusKod.reorgForma(c.status,c.state_code))+')':''"));
});

test('новых правовых формулировок нет: текст «Правопреемника» = совет «Условий сделки»', () => {
  const v = U.decide(otvet('REORGANIZING', '124'), { amount: 500000 });
  assert.ok(v.advice.includes(U.REORG_SDELAT + ' ' + U.REORG_DOLG));
});
