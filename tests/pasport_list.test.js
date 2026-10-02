// [Ночные-3] pasport-list-v2: Паспорт контрагента на токенах листа отчёта — реквизиты 2 × 2,
// строка 1 итога — полоса «Индекс · вердикт» цветом предела аванса, статусы — точка и слово.
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const K = path.join(__dirname, '..');
const STR = fs.readFileSync(path.join(K, 'pasport/kontragent/index.html'), 'utf8');

// функции вида — из страницы, без браузера
function izStranicy() {
  const kod = ['fakt1', 'rekvizity22', 'tonPolosy', 'indeksBlok'].map((n) => {
    const m = STR.match(new RegExp('  function ' + n + '\\(([\\s\\S]*?)\\n  }\\n|  function ' + n + '\\([^\\n]*\\n'));
    assert.ok(m, 'нет функции ' + n);
    return m[0];
  }).join('\n');
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const window = { IndeksVorota: require(path.join(K, 'js/indeks-vorota.js')) };
  return new Function('esc', 'window', kod + '\nreturn {fakt1, rekvizity22, tonPolosy, indeksBlok};')(esc, window);
}
const p = (tonPredela, status) => ({ razdely: [
  { id: 'rekvizity', fakty: [{ tekst: 'Дата регистрации', znachenie: '15.03.2021', ton: 'info' }, { tekst: 'Статус', znachenie: status || 'Действующая', ton: status ? 'bad' : 'ok' }] },
  { id: 'predel', fakty: tonPredela ? [{ tekst: 'Предел аванса', znachenie: '1 500 000 ₽', ton: tonPredela }] : [] },
] });

test('реквизиты 2 × 2: ИНН, ОГРН, дата регистрации, статус по ЕГРЮЛ точкой и словом', () => {
  const F = izStranicy();
  const h = F.rekvizity22(p('ok'), { inn: '0012345673', ogrn: '1210000012345' });
  assert.strictEqual((h.match(/<dt>/g) || []).length, 4);
  for (const s of ['ИНН', 'ОГРН', 'Дата регистрации', 'Статус по ЕГРЮЛ', '0012345673', '15.03.2021', 'Действующая']) assert.ok(h.includes(s), s);
  assert.ok(h.includes('<span class="tk ok"'));
  assert.ok(F.rekvizity22(p('ok', 'Ликвидирована'), { inn: '1' }).includes('<span class="tk bad"'));
  assert.ok(!STR.includes('<div class="rek">'), 'старая строка реквизитов убрана');
});

test('полоса итога — цвет предела аванса (раздел 14), без него — жёлтая', () => {
  const F = izStranicy();
  assert.strictEqual(F.tonPolosy(p('ok')), 'ok');
  assert.strictEqual(F.tonPolosy(p('bad')), 'bad');
  assert.strictEqual(F.tonPolosy(p('warn')), 'warn');
  assert.strictEqual(F.tonPolosy(p(null)), 'warn');
  assert.ok(STR.includes(`'<li class="vd '+tonPolosy(p)+'">'+indeksBlok(m)`));
});

test('Индекс в полосе: число «из 99» и уровень методики; без числа — «считаем», а не пустое место', () => {
  const F = izStranicy();
  const m = JSON.parse(fs.readFileSync(path.join(K, 'indeks/metodika-v1.json'), 'utf8'));
  const h = F.indeksBlok({ indeks: { ball: 74, sobrano: 82 } });
  assert.ok(h.includes('74<small>из&nbsp;99</small>'));
  assert.ok(m.urovni.some((u) => h.includes(u.nazvanie)), 'уровень — из того же словаря, что методика');
  assert.ok(h.includes('собрано 82% данных'));
  const s = F.indeksBlok({ indeks: { ball: null, sobrano: 40 } });
  assert.ok(s.includes('считаем') && s.includes('собрано 40% данных, для балла нужно 60%'));
  assert.ok(!/\/100/.test(h + s));
});

test('статусы разделов — точка и слово, а не плашка; цвета — токены листа', () => {
  assert.ok(STR.includes(`<span class="st '+z[0]+'">`));
  assert.match(STR, /\.rz h2 \.zn,\.ogl \.st\{background:none/);
  assert.match(STR, /\.zn::before,\.ogl \.st::before\{content:""/);
  assert.match(STR, /\.zn\.off::before,\.ogl \.st\.off::before\{background:none/);
  assert.match(STR, /print-color-adjust:exact/);
});
