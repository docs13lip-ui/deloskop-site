// rentabelnost-v2 (Ночные-3, 03.10): рентабельность активов против отрасли — в PDF-досье и в Паспорте контрагента
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = require('../js/rentabelnost.js');

const KOREN = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(KOREN, 'data', 'fns-normy-2025.json'), 'utf8'));
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const OTVET = {
  company: { inn: '7700000001', okved: '41.20' },
  dossier: { charts: {
    profit: [{ year: 2025, value: 2e6 }], income_tax: [{ year: 2025, value: 0.5e6 }],
    balance: { year: 2025, equity: 40e6, long_liab: 10e6, short_liab: 50e6 }
  } }
};

test('html(): «Как посчитали» раскрыто по otkryto, без него — свёрнуто (экран проверки как в v1)', () => {
  const o = R.raschet(OTVET, D);
  assert.match(R.html(o, { otkryto: true }), /<details class="rnt__k" open>/);
  assert.match(R.html(o), /<details class="rnt__k">/);
  assert.doesNotMatch(R.html(o), /rnt__m/);
});

test('html(): примечание Паспорта — об отпечатке SHA-256, без обещаний', () => {
  const h = R.html(R.raschet(OTVET, D), { primechanie: R.PRIMECHANIE_PASPORT });
  assert.match(h, /<p class="rnt__m">Рассчитано Делоскопом[^<]*в отпечаток SHA-256 не входит\.<\/p>/);
  assert.doesNotMatch(R.PRIMECHANIE_PASPORT, /гарант|надёжн|надежн|безопасн|лучш/i);
});

// Мини-DOM: только то, что нужно vstavit (querySelector по классу, insertBefore, appendChild, replaceChild).
function uzel(cls) {
  const u = { cls: cls || '', deti: [], parentNode: null,
    appendChild(x) { x.parentNode = u; u.deti.push(x); return x; },
    insertBefore(x, pered) { x.parentNode = u; const i = pered ? u.deti.indexOf(pered) : -1; if (i < 0) u.deti.push(x); else u.deti.splice(i, 0, x); return x; },
    replaceChild(x, star) { const i = u.deti.indexOf(star); x.parentNode = u; u.deti[i] = x; return star; },
    get nextSibling() { const p = u.parentNode; if (!p) return null; return p.deti[p.deti.indexOf(u) + 1] || null; },
    querySelector(sel) {
      const klassy = sel.split('.').filter(Boolean);
      const stek = u.deti.slice();
      while (stek.length) { const x = stek.shift(); if (klassy.every((k) => x.cls.split(' ').includes(k))) return x; stek.unshift(...x.deti); }
      return null;
    } };
  return u;
}
function dokument(koren) {
  return { createElement() { const t = uzel(''); Object.defineProperty(t, 'innerHTML', { set(h) { const m = /class="([^"]+)"/.exec(h); t.deti = []; t.appendChild(uzel(m ? m[1] : '')); } }); Object.defineProperty(t, 'firstChild', { get() { return t.deti[0]; } }); return t; } };
}

test('vstavit(): PDF-досье — после «Финансов в цифрах», нет их — после KPI', () => {
  const doc = uzel('doc'), din = uzel('din'), kpis = uzel('kpis'), fin = uzel('sec fin'), sig = uzel('sig');
  [din, kpis, fin, sig].forEach((x) => doc.appendChild(x));
  doc.ownerDocument = dokument(doc);
  R.vstavit(doc, R.html(R.raschet(OTVET, D)), { posle: ['.sec.fin', '.kpis', '.din'] });
  assert.deepStrictEqual(doc.deti.map((x) => x.cls.split(' ')[0]), ['din', 'kpis', 'sec', 'rnt', 'sig']);
  const doc2 = uzel('doc'); [uzel('din'), uzel('kpis'), uzel('sig')].forEach((x) => doc2.appendChild(x));
  doc2.ownerDocument = dokument(doc2);
  R.vstavit(doc2, R.html(R.raschet(OTVET, D)), { posle: ['.sec.fin', '.kpis', '.din'] });
  assert.deepStrictEqual(doc2.deti.map((x) => x.cls.split(' ')[0]), ['din', 'kpis', 'rnt', 'sig']);
});

test('vstavit(): Паспорт — в конец раздела; повторный вызов заменяет, а не дублирует', () => {
  const pk = uzel('pk'), r6 = uzel('rz'); r6.appendChild(uzel('tab')); pk.appendChild(r6);
  pk.ownerDocument = dokument(pk);
  R.vstavit(pk, R.html(R.raschet(OTVET, D)), { vKonec: r6 });
  R.vstavit(pk, R.html(R.raschet(OTVET, D)), { vKonec: r6 });
  assert.deepStrictEqual(r6.deti.map((x) => x.cls.split(' ')[0]), ['tab', 'rnt']);
});

test('report.html: модули подключены, место — после «Финансов в цифрах», раскрыто', () => {
  const s = chitat('report.html');
  const a = s.indexOf('/js/nagruzka.js'), b = s.indexOf('/js/rentabelnost.js');
  assert.ok(a > 0 && b > a, 'nagruzka.js раньше rentabelnost.js');
  assert.match(s, /class="sec fin"><h2>Финансы в цифрах/);
  assert.match(s, /Rentabelnost\.mount\(doc,r,\{posle:\['\.sec\.fin','\.kpis','\.din'\],otkryto:true\}\)/);
});

test('Паспорт: модули до engine.js, блок — в раздел 6 после выпуска, закрытый раздел не трогаем', () => {
  const s = chitat('pasport/kontragent/index.html');
  const a = s.indexOf('/js/nagruzka.js'), b = s.indexOf('/js/rentabelnost.js'), e = s.indexOf('/pasport/engine.js');
  assert.ok(a > 0 && b > a && e > b);
  assert.match(s, /z\.id==='finansy'/);
  assert.match(s, /r6\.status!=='locked'/);
  assert.match(s, /vKonec:s6,otkryto:true,primechanie:Rentabelnost\.PRIMECHANIE_PASPORT/);
  // после P.vypustit — значит, в отпечаток не входит
  assert.ok(s.indexOf('P.vypustit(p).then') < s.indexOf('Rentabelnost.mount(pk'));
});

test('печать: блок не рвётся между страницами', () => {
  assert.match(R.CSS, /@media print\{\.rnt\{break-inside:avoid\}/);
});
