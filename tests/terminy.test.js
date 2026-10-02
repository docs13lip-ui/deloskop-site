// Подсказки к терминам (js/terminy.js + data/terminy.json).
// Главное правило: определение — только дословные предложения из статьи сайта, на которую ведёт подсказка.
// Запуск: node --test tests/terminy.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const T = require('../js/terminy.js');
const SPR = JSON.parse(fs.readFileSync(path.join(KOREN, 'data/terminy.json'), 'utf8'));
const TERMINY = T.sobrat(SPR);

const SUSHCH = { nbsp: ' ', laquo: '«', raquo: '»', mdash: '—', ndash: '–', amp: '&', quot: '"', hellip: '…', thinsp: ' ', shy: '' };
function tekst(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/g, (m, n) => (n in SUSHCH ? SUSHCH[n] : m))
    .replace(/[\u00a0\u202f\u2009]/g, ' ')
    .replace(/\u2011/g, '-')
    .replace(/\s+/g, ' ');
}
function norm(s) { return s.replace(/[\u00a0\u202f\u2009]/g, ' ').replace(/\u2011/g, '-').replace(/\s+/g, ' ').trim(); }
function stranica(url) {
  const f = path.join(KOREN, url.replace(/^\//, ''), 'index.html');
  assert.ok(fs.existsSync(f), 'нет страницы ' + url);
  return fs.readFileSync(f, 'utf8');
}
function predlozheniya(s) { return norm(s).split(/(?<=[.!?])\s+(?=[«А-ЯЁA-Z(])/).filter(Boolean); }

test('справочник: источник, дата, правило обновления; id уникальны', () => {
  assert.match(SPR.obnovleno, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(SPR.pravilo.length > 40 && SPR.istochnik);
  const ids = SPR.terminy.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(TERMINY.length, SPR.terminy.length, 'каждый шаблон собирается в выражение');
});

for (const t of SPR.terminy) {
  test(`«${t.nazvanie}»: определение дословно из ${t.stranica}`, () => {
    const html = stranica(t.stranica);
    const m = /<main[\s\S]*?<\/main>/.exec(html);
    const telo = tekst(m ? m[0] : html);
    for (const p of predlozheniya(t.opredelenie)) {
      assert.ok(telo.includes(p), `предложения нет на странице ${t.stranica}: ${p}`);
    }
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    assert.ok(h1, 'у страницы нет H1');
    assert.equal(norm(tekst(h1[1])), norm(t.stranica_nazvanie), 'название ссылки = H1 статьи');
  });

  test(`«${t.nazvanie}»: шаблон находит примеры и не цепляет чужие слова`, () => {
    const x = TERMINY.find((y) => y.t.id === t.id);
    for (const s of t.primery) assert.ok(T.najti(x.re, s), `не нашёл в «${s}»`);
    for (const s of t.ne_primery) assert.equal(T.najti(x.re, s), null, `лишнее в «${s}»`);
  });
}

test('определения без обещаний и превосходных степеней (38-ФЗ), без упоминания ИИ', () => {
  for (const t of SPR.terminy) {
    assert.doesNotMatch(t.opredelenie, /гарантир|лучш|самый|№\s?1\b|нейросет|искусственн/i, t.id);
  }
});

test('razmetit: только первое упоминание термина; остальное — текст как был', () => {
  const s = 'Прогноз ЗСК низкий. Снова ЗСК и ст. 54.1 НК.';
  const k = T.razmetit(s, TERMINY, {});
  assert.equal(k.map((x) => x.tekst).join(''), s);
  assert.deepEqual(k.filter((x) => x.id).map((x) => [x.id, x.tekst]), [['zsk', 'ЗСК'], ['st541', 'ст. 54.1 НК']]);
  const uzhe = { zsk: true };
  assert.equal(T.razmetit('ЗСК', TERMINY, uzhe).filter((x) => x.id).length, 0, 'уже размеченный термин не повторяется');
});

test('razmetit: границы слова и «технической» компании в кавычках', () => {
  const k = T.razmetit('Признаков «технической» компании не найдено', TERMINY, {});
  assert.deepEqual(k.filter((x) => x.id).map((x) => x.tekst), ['«технической» компании']);
  assert.equal(T.razmetit('АЗСКА 154.12', TERMINY, {}).filter((x) => x.id).length, 0);
  const nb = T.razmetit('Глазами банка (115\u2011ФЗ)', TERMINY, {});
  assert.deepEqual(nb.filter((x) => x.id).map((x) => x.id), ['fz115']);
});

test('podskazka: экранирует текст и ведёт на статью', () => {
  const h = T.podskazka({ nazvanie: '<x>', opredelenie: 'a & b', stranica: '/nalogi/', stranica_nazvanie: 'Статья' });
  assert.ok(h.includes('&lt;x&gt;') && h.includes('a &amp; b') && h.includes('href="/nalogi/"'));
});

test('битый шаблон не ломает остальные', () => {
  const x = T.sobrat({ terminy: [{ id: 'a', shablon: '(', opredelenie: 'x', stranica: '/' }, SPR.terminy[0]] });
  assert.equal(x.length, 1);
  assert.deepEqual(T.sobrat(null), []);
});

test('подключено на экране проверки и в досье', () => {
  const idx = fs.readFileSync(path.join(KOREN, 'index.html'), 'utf8');
  const rep = fs.readFileSync(path.join(KOREN, 'report.html'), 'utf8');
  assert.match(idx, /<script src="\/js\/terminy\.js" defer><\/script>/);
  assert.match(idx, /Terminy\.mount\(report\)/);
  assert.match(rep, /<script src="\/js\/terminy\.js"><\/script>/);
  assert.match(rep, /Terminy\.mount\(doc\)/);
});
