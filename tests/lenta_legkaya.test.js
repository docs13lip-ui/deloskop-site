// lenta-legkaya-v1 (25.10.2026, [Ночные запуски]): точка, счётчик и полоса «Новое» в шапке берут лёгкую ленту.
// До этого obnovleniya.js (в пакете «yadro» на каждой странице) скачивал всю /obnovleniya.json — 587 КБ на 25.10,
// без сжатия на нынешнем сервере и заново после каждой выкладки. Сторож:
// 1) /obnovleniya-verh.json = верхние записи obnovleniya.json один в один + «vsego» (собирает tests/sobrat_lentu.py);
// 2) файл лёгкий (< 30 КБ), а записей хватает счётчику (≥ 11: индекс прочитанной 0…10, больше 9 — «9+»);
// 3) obnovleniya.js и пакет «yadro» не просят полную ленту;
// 4) поведение: прочитанная ниже верхних записей — «9+», среди них — точное число, первый визит — точка.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const polnaya = JSON.parse(chitat('obnovleniya.json')).obnovleniya;
const verhTekst = chitat('obnovleniya-verh.json');
const verh = JSON.parse(verhTekst);

test('лёгкая лента = верх полной, один в один', () => {
  assert.strictEqual(verh.vsego, polnaya.length, 'vsego — длина всей ленты');
  assert.ok(verh.obnovleniya.length >= 11, 'счётчику нужно не меньше 11 записей');
  assert.deepStrictEqual(verh.obnovleniya, polnaya.slice(0, verh.obnovleniya.length),
    'лёгкая лента отстала от obnovleniya.json — запустите: python3 tests/sobrat_lentu.py');
});

test('лёгкая лента лёгкая', () => {
  const kb = Buffer.byteLength(verhTekst) / 1024;
  assert.ok(kb < 30, 'obnovleniya-verh.json — ' + kb.toFixed(1) + ' КБ');
});

test('скрипт шапки и пакет «yadro» не скачивают всю ленту', () => {
  const js = chitat('obnovleniya.js');
  assert.ok(js.includes('fetch("/obnovleniya-verh.json"'), 'obnovleniya.js берёт /obnovleniya-verh.json');
  assert.ok(!js.includes('fetch("/obnovleniya.json"'), 'obnovleniya.js не просит полную ленту');
  const pakety = fs.readdirSync(path.join(K, 'js', 'b')).filter((f) => /^yadro\./.test(f));
  assert.strictEqual(pakety.length, 1, 'один пакет yadro');
  const y = chitat(path.join('js', 'b', pakety[0]));
  assert.ok(y.includes('fetch("/obnovleniya-verh.json"') && !y.includes('fetch("/obnovleniya.json"'), 'пакет yadro собран с новым obnovleniya.js');
});

function zapustit(videl) {
  const el = (attr) => ({ attr, hidden: false, textContent: '', parentNode: null, setAttribute() {}, querySelector: () => null });
  const tochka = el('dot'), schet = el('count'), knopka = el('btn');
  const obshchij = { querySelector: (s) => (s === '[data-whatsnew-count]' ? schet : null) };
  tochka.parentNode = obshchij;
  let label = '';
  knopka.setAttribute = (k, v) => { if (k === 'aria-label') label = v; };
  const document = {
    readyState: 'complete',
    querySelectorAll: (s) => (s === '[data-whatsnew-dot]' ? [tochka] : s === '[data-whatsnew-count]' ? [schet] : s === '[data-whatsnew]' ? [knopka] : []),
    querySelector: () => null,
    addEventListener() {},
  };
  const zaprosy = [];
  let gotovo;
  const zhdat = new Promise((r) => { gotovo = r; });
  const ctx = {
    window: { addEventListener() {} },
    document,
    location: { pathname: '/nalogi/', search: '' },
    localStorage: { getItem: () => videl, setItem() {} },
    URLSearchParams,
    fetch: (u) => {
      zaprosy.push(u);
      return Promise.resolve({ json: () => Promise.resolve(verh) }).then((r) => { setTimeout(gotovo, 0); return r; });
    },
    setTimeout,
  };
  ctx.window.document = document;
  vm.runInNewContext(chitat('obnovleniya.js'), ctx);
  return zhdat.then(() => ({ zaprosy, tochka, schet, label }));
}

test('счётчик по лёгкой ленте: «9+», точное число, первый визит', async () => {
  const daleko = await zapustit(polnaya[verh.obnovleniya.length + 3].id);
  assert.deepStrictEqual(daleko.zaprosy, ['/obnovleniya-verh.json']);
  assert.strictEqual(daleko.schet.hidden, false);
  assert.strictEqual(daleko.schet.textContent, '9+', 'прочитанная ниже верхних записей — «9+»');

  const tri = await zapustit(polnaya[3].id);
  assert.strictEqual(tri.schet.textContent, '3');
  assert.match(tri.label, /непрочитанных: 3/);

  const pervyj = await zapustit(null);
  assert.strictEqual(pervyj.schet.hidden, true, 'первый визит — без числа');
  assert.strictEqual(pervyj.tochka.hidden, false, 'первый визит — синяя точка');
  assert.match(pervyj.label, /непрочитанных: 1/);

  const vse = await zapustit(polnaya[0].id);
  assert.strictEqual(vse.schet.hidden, true);
  assert.strictEqual(vse.label, 'Что нового');
});
