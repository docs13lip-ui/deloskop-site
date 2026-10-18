// lenta-chisto-v1 (18.10.2026, [Ночные запуски]): лента «Что нового» — без повторов и с типографикой статей.
// 1) /obnovleniya/: ровно одна пара меток ленты, ни одной записи вне #list, id не повторяются
//    (с 12.10 по 18.10 записи -71 и -47 стояли хвостом после блока — посетитель видел их дважды).
// 2) tipo() в скрипте страницы и в obnovleniya.js — одна и та же функция, без (?<!) (старые iOS не разбирают скрипт).
// 3) tipo() даёт ровно то, что tests/tipograf_statej.py → tekst() на каждом тексте ленты:
//    что видит робот в HTML (sobrat_lentu) = что рисует скрипт посетителю.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');

function tipoIz(src) {
  const a = src.indexOf('function tipo(s){');
  assert.ok(a >= 0, 'нет function tipo');
  const b = src.indexOf('"$1\\u2011");}', a);
  assert.ok(b > a, 'конец tipo не найден');
  return src.slice(a, b + '"$1\\u2011");}'.length);
}

test('/obnovleniya/: одна пара меток ленты, записей вне #list нет, id не повторяются', () => {
  const h = chitat('obnovleniya/index.html');
  assert.strictEqual(h.split('<!--lenta-->').length - 1, 1, 'открывающих меток');
  assert.strictEqual(h.split('<!--/lenta-->').length - 1, 1, 'закрывающих меток');
  const posle = h.slice(h.indexOf('<!--/lenta-->'), h.indexOf('</main>'));
  assert.ok(!/<section class="u"/.test(posle), 'запись после блока ленты');
  assert.strictEqual(posle.replace(/\s+/g, ''), '<!--/lenta--></div>', 'после блока — только </div> #list: ' + posle.slice(0, 120));
  const ids = [...h.matchAll(/<section class="u" id="([^"]+)"/g)].map((m) => m[1]);
  assert.strictEqual(new Set(ids).size, ids.length, 'повтор id');
});

test('tipo(): одна функция в скрипте страницы и в obnovleniya.js, без lookbehind', () => {
  const a = tipoIz(chitat('obnovleniya/index.html'));
  const b = tipoIz(chitat('obnovleniya.js'));
  assert.strictEqual(a, b);
  assert.ok(!a.includes('(?<'), 'lookbehind');
  assert.ok(!/\u00a0/.test(a), 'сырой неразрывный пробел в исходнике — только \\u00a0');
  for (const f of ['obnovleniya/index.html', 'obnovleniya.js']) {
    const s = chitat(f);
    for (const pole of ['esc(u.zagolovok)', 'esc(p.tekst)', 'esc(u.kuda_pisat)']) {
      const vse = s.split(pole).length - 1;
      const sTipo = s.split('tipo(' + pole + ')').length - 1;
      assert.ok(vse > 0 && vse === sTipo, f + ': ' + pole + ' без tipo()');
    }
  }
});

test('tipo() = tipograf_statej.tekst() на всех текстах ленты (робот видит то же, что посетитель)', () => {
  const L = JSON.parse(chitat('obnovleniya.json')).obnovleniya;
  const teksty = [];
  for (const u of L) {
    teksty.push(u.zagolovok || '', u.kuda_pisat || '');
    for (const t of u.chto_novogo || []) teksty.push(t);
    for (const p of u.chto_proverit || []) teksty.push(p.tekst || '');
  }
  // крайние случаи правил
  teksty.push('и в банк не ждите', 'В 2025 году 30 000 ₽ и 10 %', 'ст. 7 и № 115', 'по 115-ФЗ — срок', 'оно и мои в', 'со счёта об этом', 'X-в банк', '&в банк');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ctx = {};
  vm.runInNewContext(tipoIz(chitat('obnovleniya.js')) + ';this.tipo=tipo;', ctx);
  const py = JSON.parse(execFileSync('python3', ['-c',
    'import sys,json; sys.path.insert(0,"tests"); import tipograf_statej as T, sobrat_lentu as S;' +
    'print(json.dumps([T.tekst(S.esc(x)) for x in json.load(sys.stdin)]))'], { cwd: K, input: JSON.stringify(teksty), maxBuffer: 64 * 1024 * 1024 }).toString());
  let raznyh = 0;
  teksty.forEach((t, i) => {
    const js = ctx.tipo(esc(t));
    const p = py[i].replace(/&nbsp;/g, '\u00a0').replace(/&#8209;/g, '\u2011');
    if (js !== p) { raznyh++; if (raznyh < 4) assert.strictEqual(js, p, 'текст: ' + t); }
  });
  assert.strictEqual(raznyh, 0);
  assert.ok(ctx.tipo('и в банк').startsWith('и\u00a0в\u00a0банк'));
});
