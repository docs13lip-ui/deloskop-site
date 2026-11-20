// predmet-sdelki-v1 — «Что покупаете» в «Условиях сделки» (план 19.11 п. 1 «ИНН + сумма + предмет + способ оплаты»;
// слова — юристы 19.11, разд. 4 «Предмет сделки»).
// Главное: предмет меняет только «Что запросить у них» и письмо; вывод, предел, «На кону», строки об оплате — прежние;
// не выбран — побайтно как до комплекта; «Они платят мне» — предмет не применяется.
// node --test tests/predmet_sdelki.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const KOREN = path.join(__dirname, '..');
const U = require('../js/usloviya.js');
const F = require('./otsrochka_fixtures.js');
const sp = (s) => String(s).replace(/ /g, ' ');
const ids = (v) => v.docs.map((d) => d.id);
const bezDocs = (v) => { const o = Object.assign({}, v); delete o.docs; delete o.letter; delete o.predmet; return JSON.stringify(o); };

test('четыре варианта — слова юристов, порядок', () => {
  assert.deepStrictEqual(U.PREDMET.map((x) => x.id), ['tovary', 'raboty', 'arenda', 'avans']);
  assert.deepStrictEqual(U.PREDMET.map((x) => x.t), ['Товары', 'Работы или услуги', 'Аренда', 'Предоплата за будущую поставку']);
});

test('не выбран или неизвестный — побайтно как до комплекта, ключа predmet нет', () => {
  for (const k of Object.keys(F)) {
    for (const a of [undefined, 90000, 500000, 5000000]) {
      const bez = U.decide(F[k], { amount: a });
      assert.ok(!('predmet' in bez), k);
      assert.strictEqual(JSON.stringify(U.decide(F[k], { amount: a, predmet: 'kripta' })), JSON.stringify(bez), k + ' неизвестный');
      assert.strictEqual(JSON.stringify(U.decide(F[k], { amount: a, predmet: null })), JSON.stringify(bez), k + ' null');
    }
  }
});

test('документы под предмет — словами юристов, сразу после полномочий и реквизитов', () => {
  const v = (p) => U.decide(F.cap, { amount: 500000, predmet: p });
  const t = (p) => v(p).docs.map((d) => sp(d.title));
  assert.ok(t('tovary').includes('Договор поставки и УПД'));
  assert.ok(t('raboty').includes('Смета и акт выполненных работ'));
  assert.ok(t('raboty').includes('Выписка из реестра членов СРО, если работы этого требуют'));
  assert.ok(t('arenda').includes('Выписка из ЕГРН или договор с собственником'));
  assert.deepStrictEqual(ids(v('avans')).filter((x) => ['postavka', 'grafik', 'obesp'].includes(x)), ['postavka', 'grafik', 'obesp']);
  assert.ok(t('avans').includes('Обеспечение, если договор его предусматривает'));
  for (const p of ['tovary', 'raboty', 'arenda', 'avans']) {
    const d = ids(v(p)), i = d.findIndex((x) => !['power', 'powerNew', 'card'].includes(x));
    assert.ok(['postavka', 'smeta', 'egrn'].includes(d[i]), p + ': первым после реквизитов — документ предмета, а не ' + d[i]);
    assert.strictEqual(v(p).predmet, p);
  }
});

test('«Работы или услуги» — одна строка о допуске: общая «Лицензия или СРО» уступает строке юристов', () => {
  const v = U.decide(F.cap, { amount: 5000000, predmet: 'raboty' });
  assert.ok(!ids(v).includes('license') && ids(v).includes('sro'));
  assert.ok(ids(U.decide(F.cap, { amount: 5000000 })).includes('license'), 'без предмета — как было');
});

test('вывод, предел, «На кону», оплата — от предмета не зависят', () => {
  for (const k of Object.keys(F)) for (const s of [undefined, 'nal', 'karta']) for (const p of ['tovary', 'raboty', 'arenda', 'avans']) {
    assert.strictEqual(bezDocs(U.decide(F[k], { amount: 500000, sposob: s, predmet: p })), bezDocs(U.decide(F[k], { amount: 500000, sposob: s })), k + '/' + s + '/' + p);
  }
});

test('письмо: просьбы предмета есть, запрещённых слов нет; чек при наличных остаётся', () => {
  const v = U.decide(F.cap, { amount: 500000, predmet: 'avans', sposob: 'nal' });
  assert.ok(/Проект договора поставки; УПД — на каждую поставку\./.test(v.letter.body));
  assert.ok(/График поставки\./.test(v.letter.body));
  assert.ok(ids(v).includes('chek'));
  for (const p of ['tovary', 'raboty', 'arenda', 'avans']) {
    const l = U.decide(F.go, { amount: 2000000, predmet: p }).letter;
    assert.ok(!U.LETTER_NELZYA.test(l.subject + l.body), p + ': ' + l.body);
  }
});

test('«Они платят мне» — предмет не применяется', () => {
  for (const k of Object.keys(F)) {
    const a = U.decide(F[k], { amount: 500000, napravlenie: 'otgruzhaem' });
    assert.strictEqual(JSON.stringify(U.decide(F[k], { amount: 500000, napravlenie: 'otgruzhaem', predmet: 'tovary' })), JSON.stringify(a), k);
  }
});

let pw = null;
try { pw = require('playwright'); } catch (_) { pw = null; }
test('Chromium 390 и 1280: «Что покупаете» без вылета за край, выбор открывает список, цель — раз', { skip: !pw && 'нет playwright' }, async () => {
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
  let b;
  try { b = await pw.chromium.launch(exe ? { executablePath: exe } : {}); } catch (e) { return; }
  const kod = fs.readFileSync(path.join(KOREN, 'js/usloviya.js'), 'utf8');
  try {
    for (const w of [390, 1280]) {
      const p = await b.newPage({ viewport: { width: w, height: 900 } });
      await p.setContent('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;padding:16px;font:16px system-ui"><div id="u" style="max-width:640px"></div></body>');
      await p.addScriptTag({ content: kod });
      await p.evaluate((r) => { window.celi = []; window.dlkGoal = (c) => window.celi.push(c); window.M = Usloviya.mount(document.getElementById('u'), r); }, F.cap);
      assert.strictEqual((await p.$$('[data-predmet]')).length, 4);
      const kraj = await p.$$eval('[data-predmet]', (bs) => { const box = document.querySelector('.usl').getBoundingClientRect(); return bs.map((x) => box.right - x.getBoundingClientRect().right); });
      assert.ok(kraj.every((d) => d >= 0), w + ': кнопка за краем ' + kraj);
      await p.click('[data-predmet=arenda]');
      assert.strictEqual(await p.$eval('[data-predmet=arenda]', (x) => x.getAttribute('aria-pressed')), 'true');
      assert.ok(await p.$eval('.usl details', (x) => x.open), 'список открыт');
      assert.ok(/Выписка из.ЕГРН/.test(await p.$eval('.usl ol', (x) => x.textContent)));
      await p.click('[data-predmet=tovary]'); await p.click('[data-predmet=tovary]');
      assert.strictEqual(await p.$('[data-predmet][aria-pressed=true]'), null, 'второе нажатие снимает выбор');
      assert.deepStrictEqual(await p.evaluate(() => window.celi), ['usl_predmet']);
      await p.click('[data-napr=otgruzhaem]');
      assert.strictEqual((await p.$$('[data-predmet]')).length, 0, 'когда платят вам — вопроса нет');
      const vbok = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(vbok <= 0, w + ': вбок ' + vbok);
      await p.close();
    }
  } finally { await b.close(); }
});
