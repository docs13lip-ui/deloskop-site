// «Проверь счёт» — блок «Проверка реквизитов» (.acc), Очередь п. 82; аудит 27.09, п. Б.
// Принадлежность счёта поставщику — всегда отдельной строкой «Не подтверждено»; «не сверяли» ≠ «ошибка».
// Запуск: node --test tests/acc.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const A = require('../js/acc.js');

const KOREN = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const NB = ' ';
const plain = (s) => s.replace(/ /g, ' ');
// Сбербанк: БИК 044525225, счёт с верным ключом; тот же счёт с изменённой цифрой — неверный.
const BIK = '044525225', ACC = '40702810938000000001';
function schetSKlyuchom() {
  for (let d = 0; d < 10; d++) { const a = '4070281093800000000' + d; if (A.klyuchSchyota(BIK, a)) return a; }
  throw new Error('нет счёта с верным ключом');
}

test('последняя строка всегда — «Счёт принадлежит поставщику — Не подтверждено»', () => {
  const vars = [{}, { bik: BIK }, { bik: BIK, acc: schetSKlyuchom() }, { bik: '123', acc: ACC },
    { bik: BIK, acc: schetSKlyuchom(), bank: { ok: true, name: 'ПАО Сбербанк', bik: BIK, as_of: '2026-09-28' }, priostanovki: { status: 'not_found', as_of: '2026-09-28' } }];
  for (const d of vars) {
    const s = A.stroki(d), last = s[s.length - 1];
    assert.equal(last.nazv, 'Счёт принадлежит поставщику');
    assert.equal(plain(last.verdikt), 'Не подтверждено');
    assert.equal(last.cls, 'is-none');
  }
});

test('ключ сошёлся — «наш расчёт» (◆), а не «подтверждено»; не сошёлся — ошибка', () => {
  const ok = A.stroki({ bik: BIK, acc: schetSKlyuchom() });
  const k = ok.find((x) => /Номер счёта/.test(x.nazv));
  assert.equal(k.cls, 'is-calc');
  assert.match(plain(k.meta), /не значит, что счёт принадлежит поставщику/);
  assert.match(plain(A.zagolovok(ok)), /подтвердить может только банк/);
  let plohoj = schetSKlyuchom(); plohoj = plohoj.slice(0, -1) + ((+plohoj.slice(-1) + 1) % 10);
  const bad = A.stroki({ bik: BIK, acc: plohoj });
  assert.equal(bad.find((x) => /Номер счёта/.test(x.nazv)).cls, 'is-bad');
  assert.match(plain(A.zagolovok(bad)), /ошибка/);
});

test('банк без справочника — «Не сверяли» (○), не красный и не «подтверждено»', () => {
  const s = A.stroki({ bik: BIK, acc: schetSKlyuchom(), bankNazvanie: 'ПАО Сбербанк' });
  const b = s[0];
  assert.equal(b.cls, 'is-none');
  assert.equal(plain(b.verdikt), 'Не сверяли');
  assert.match(plain(b.meta), /не значит, что с ним что-то не так/);
  assert.ok(!s.some((x) => x.cls === 'is-fact'), 'без ответа сервера ничего не «подтверждено источником»');
});

test('банк из справочника (ответ сервера) — ● с датой; отозван — ошибка', () => {
  const f = A.stroki({ bik: BIK, bank: { ok: true, name: 'ПАО Сбербанк', bik: BIK, as_of: '2026-09-28' } })[0];
  assert.equal(f.cls, 'is-fact');
  assert.match(plain(f.meta), /справочник БИК Банка России на 28\.09\.2026/);
  assert.equal(A.stroki({ bik: BIK, bank: { ok: false } })[0].cls, 'is-bad');
});

test('БИК не с «04» — ошибка; БИК нет — «Не нашли»', () => {
  assert.equal(A.stroki({ bik: '123456789' })[0].cls, 'is-bad');
  assert.equal(A.stroki({})[0].cls, 'is-none');
});

test('приостановки ФНС — строка только если сервер прислал; «не проверяли» ≠ «нет»', () => {
  const nazv = (d) => A.stroki(d).filter((x) => /приостановке/.test(plain(x.nazv)));
  assert.equal(nazv({ bik: BIK }).length, 0);
  assert.equal(nazv({ bik: BIK, priostanovki: { status: 'found', as_of: '2026-09-28' } })[0].cls, 'is-high');
  const f = nazv({ bik: BIK, priostanovki: { status: 'found' } })[0];
  assert.match(plain(f.meta), /поступления на счёт идут/, 'формула юриста: расходные операции не проведут, поступления идут (ст. 76 НК)');
  assert.equal(nazv({ bik: BIK, priostanovki: { status: 'not_found', as_of: '2026-09-28' } })[0].cls, 'is-fact');
  const n = nazv({ bik: BIK, priostanovki: { status: 'not_checked' } })[0];
  assert.equal(n.cls, 'is-none');
  assert.match(plain(n.meta), /это не значит, что решений нет/);
});

test('js/acc.js не вставляет HTML (только textContent)', () => {
  assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(R('js/acc.js')));
});

test('токены css/acc.css совпадают с ds.css', () => {
  const ds = R('css/ds.css'), acc = R('css/acc.css');
  const tok = (css, sel) => { const m = css.match(new RegExp(sel.replace('.', '\\.') + '\\{([\\s\\S]*?)\\}')); return m[1]; };
  const blok = tok(acc, '.acc-box');
  const re = /(--[a-z0-9-]+):([^;]+);/g; let m, n = 0;
  while ((m = re.exec(blok))) {
    const v = ds.match(new RegExp(m[1].replace(/[-]/g, '\\-') + ':([^;]+);'));
    assert.ok(v, m[1] + ' нет в ds.css');
    assert.equal(m[2].trim(), v[1].trim(), m[1]);
    n++;
  }
  assert.ok(n >= 10);
});

test('страница «Проверь счёт» подключает блок и не обещает лишнего', () => {
  const t = R('proverit-schet/index.html');
  assert.match(t, /\/css\/acc\.css/);
  assert.match(t, /\/js\/acc\.js/);
  assert.match(t, /id="accHost"/);
  assert.match(t, /DlkAcc\.render/);
  for (const z of [/подходит для оплаты/i, /Счёт проверен/, /[Мм]ожно платить/, /\bчисто\b/i, /'Владелец счёта'/])
    assert.ok(!z.test(t), 'запрещено: ' + z);
});

test('стоп-лист «коробка Apple» п. 36: нигде в отчёте и «Проверь счёт» нет «/100» и «из 100»', () => {
  for (const f of ['report.html', 'proverit-schet/index.html', 'js/indeks-vorota.js', 'js/acc.js'])
    assert.ok(!/\/100\b|из 100\b/.test(R(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')), f);
});

test('ворота Индекса: полоса полноты графитом и только при известной полноте', () => {
  const r = R('report.html');
  assert.match(r, /V\.polnota!=null\?'<div class="igbar"/);
  const css = r.match(/\.igbar[^\n]*/)[0];
  for (const cvet of ['#B3261E', '#C2410C', '#16723F', '#9A5B00']) assert.ok(!css.includes(cvet), 'цвет риска в полосе: ' + cvet);
});
