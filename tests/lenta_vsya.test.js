// lenta-vsya-po-knopke-v1 (03.11.2026, [Ночные запуски]): /obnovleniya/ больше не качает всю ленту при каждом заходе.
// Было: скрипт страницы тянул obnovleniya.json — 688 КБ без сжатия (508 записей) — и перерисовывал те же 20 записей,
// что уже стоят в HTML. Стало: 20 записей из HTML сразу, под ними кнопка «Показать ещё N обновлений»; полная лента —
// по нажатию или когда адрес ведёт на #id старой записи; сбой не стирает 20. Сторож:
// 1) кнопка собрана сборщиком: N = длина ленты − 20, форма слова верная, hidden до скрипта;
// 2) без нажатия и без старого #id — ни одного запроса; 3) по нажатию — один запрос, лента целиком, кнопка ушла;
// 4) #id старой записи — грузит сам; #id из верхних 20 — не грузит; 5) сбой — 20 записей на месте, кнопка зовёт повторить.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const K = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(K, 'obnovleniya', 'index.html'), 'utf8');
const lenta = JSON.parse(fs.readFileSync(path.join(K, 'obnovleniya.json'), 'utf8')).obnovleniya;
const forma = (n, f) => { const d = n % 100, k = n % 10; return d > 10 && d < 20 ? f[2] : k === 1 ? f[0] : k > 1 && k < 5 ? f[1] : f[2]; };

function skript() {
  const a = html.indexOf('lenta-vsya-po-knopke-v1 (03.11)');
  const s = html.lastIndexOf('<script>', a);
  const e = html.indexOf('</script>', a);
  assert.ok(s > 0 && e > a, 'скрипт страницы найден');
  return html.slice(s + '<script>'.length, e);
}

test('кнопка «Показать ещё N обновлений» собрана из ленты и спрятана до скрипта', () => {
  const n = lenta.length - 20;
  assert.ok(n > 0, 'в ленте больше 20 записей');
  const m = html.match(/<!--esche--><p class="esche" data-esche hidden><button type="button" class="esche__b">Показать ещё (\d+)&nbsp;([а-я]+)<\/button><\/p><!--\/esche-->/);
  assert.ok(m, 'блок кнопки за #list — запустите python3 tests/sobrat_lentu.py');
  assert.strictEqual(+m[1], n, 'N = записей в ленте − 20');
  assert.strictEqual(m[2], forma(n, ['обновление', 'обновления', 'обновлений']));
  assert.ok(html.indexOf('<!--/lenta--></div>') < html.indexOf('<!--esche-->') && html.indexOf('<!--/esche-->') < html.indexOf('</main>'), 'кнопка между #list и </main>');
});

function sreda({ hash = '', sboj = false } = {}) {
  const ids = [...html.matchAll(/<section class="u" id="([^"]+)"/g)].map((x) => x[1]);
  const box = {
    _html: ids.map((id) => '<section class="u" id="' + id + '">').join(''),
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html; },
    querySelectorAll(s) {
      return [...this._html.matchAll(/<section class="u" id="([^"]+)"/g)].map((x) => ({ id: x[1], setAttribute() {}, focus() { sreda.fokus = x[1]; } }));
    },
  };
  const btn = { disabled: false, textContent: 'Показать ещё', _klik: null, addEventListener(t, f) { if (t === 'click') this._klik = f; } };
  const esche = { hidden: true, querySelector: () => btn, parentNode: null };
  esche.parentNode = { removeChild(x) { if (x === esche) esche.ushla = true; } };
  const zaprosy = [];
  let prokrutka = null;
  const document = {
    getElementById: (id) => (id === 'list' ? box : (box._html.includes('id="' + id + '"') ? { scrollIntoView() { prokrutka = id; } } : null)),
    querySelector: (s) => (s === '[data-esche]' ? esche : null),
  };
  const ctx = {
    document, window: { addEventListener() {} }, location: { hash },
    fetch: (u) => { zaprosy.push(u); return sboj ? Promise.reject(new Error('сеть')) : Promise.resolve({ ok: true, json: () => Promise.resolve({ obnovleniya: lenta }) }); },
    decodeURIComponent, setTimeout,
  };
  vm.runInNewContext(skript(), ctx);
  return { box, btn, esche, zaprosy, prokrutka: () => prokrutka };
}
const tik = () => new Promise((r) => setTimeout(r, 5));

test('без нажатия — ни одного запроса, кнопка видна', async () => {
  const s = sreda();
  await tik();
  assert.deepStrictEqual(s.zaprosy, []);
  assert.strictEqual(s.esche.hidden, false);
});

test('по нажатию — один запрос, вся лента, кнопка ушла', async () => {
  const s = sreda();
  s.btn._klik(); s.btn._klik();
  assert.strictEqual(s.btn.disabled, true);
  await tik();
  assert.deepStrictEqual(s.zaprosy, ['/obnovleniya.json'], 'двойной клик — один запрос');
  assert.strictEqual(s.box.querySelectorAll('section.u').length, lenta.length);
  assert.ok(s.esche.ushla, 'кнопка убрана');
});

test('адрес на старую запись — лента грузится сама и прокручивает к ней', async () => {
  const stara = lenta[lenta.length - 1].id;
  const s = sreda({ hash: '#' + stara });
  await tik();
  assert.deepStrictEqual(s.zaprosy, ['/obnovleniya.json']);
  assert.strictEqual(s.prokrutka(), stara);
});

test('адрес на запись из верхних 20 — не грузит', async () => {
  const s = sreda({ hash: '#' + lenta[3].id });
  await tik();
  assert.deepStrictEqual(s.zaprosy, []);
});

test('сбой — 20 записей на месте, кнопка зовёт повторить', async () => {
  const s = sreda({ sboj: true });
  const bylo = s.box.innerHTML;
  s.btn._klik();
  await tik();
  assert.strictEqual(s.box.innerHTML, bylo, 'записи из HTML не стёрты');
  assert.strictEqual(s.btn.disabled, false);
  assert.match(s.btn.textContent, /Попробовать ещё раз/);
  assert.ok(!s.esche.ushla);
});

test('скрипт страницы не качает ленту при загрузке', () => {
  const js = skript();
  assert.strictEqual((js.match(/fetch\("\/obnovleniya\.json"/g) || []).length, 1, 'один fetch — внутри vsya()');
  const i = js.indexOf('fetch("/obnovleniya.json"');
  assert.ok(js.lastIndexOf('function vsya()', i) > 0, 'fetch — внутри vsya()');
});
