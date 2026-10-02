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

test('222-ФЗ: Индекс — не о «надёжности» (ни в справочнике, ни в лиде /indeks/)', () => {
  // [Право] 02.10: «надёжность» — слово из определения кредитного рейтинга (п. 3 ст. 2 222-ФЗ)
  assert.doesNotMatch(JSON.stringify(SPR), /надёжн|надежн/i);
  const ix = fs.readFileSync(path.join(KOREN, 'indeks/index.html'), 'utf8');
  const sub = /<p class="sub">([\s\S]*?)<\/p>/.exec(ix);
  assert.ok(sub, 'нет лида на /indeks/');
  assert.doesNotMatch(sub[1], /надёжн|надежн/i);
  assert.match(tekst(ix), /не официальное заключение госоргана и не кредитный рейтинг/);
});

test('словарь проверки в статье: у каждого слова — якорь, у РНП и ст. 76 — действующие сроки', () => {
  const html = stranica('/nalogi/proverka-kontragenta-pered-dogovorom/');
  const m = /<!--slovar-->([\s\S]*?)<!--\/slovar-->/.exec(html);
  assert.ok(m, 'нет блока словаря');
  for (const id of ['girbo', 'fssp', 'rnp', 'priost', 'obesp', 'massadres', 'massruk']) assert.match(m[1], new RegExp('id="t-' + id + '"'));
  const t = tekst(m[1]);
  assert.match(t, /в течение 20 дней/, 'ст. 76 НК в ред. 04.08.2026 — 20 дней, не 10');
  assert.match(t, /хранятся 2 года \(ст\. 104 44-ФЗ\)/);
  assert.equal((html.match(/<h2[^>]*>Что значат слова в отчёте<\/h2>/g) || []).length, 1);
});

test('подключено в Паспорте контрагента', () => {
  const ps = fs.readFileSync(path.join(KOREN, 'pasport/kontragent/index.html'), 'utf8');
  assert.match(ps, /<script src="\/js\/terminy\.js"><\/script>/);
  assert.match(ps, /Terminy\.mount\(pk\)/);
});

test('razmetitBlok: термин, занимающий весь текстовый узел, тоже получает подсказку', () => {
  // мини-DOM: <dd>за 2025 год<small>ГИР БО</small></dd> — без jsdom, только то, что зовёт модуль
  function tn(v) { return { nodeType: 3, nodeValue: v, parentNode: null }; }
  const small = { nodeName: 'SMALL', classList: { contains: () => false }, hasAttribute: () => false, childNodes: [] };
  const t1 = tn('за 2025 год'), t2 = tn('ГИР БО');
  const dd = { nodeName: 'DD', childNodes: [t1, small] };
  small.childNodes = [t2]; t1.parentNode = dd; t2.parentNode = small; small.parentNode = dd;
  const zamena = [];
  small.replaceChild = (nov, star) => zamena.push([nov, star]);
  dd.replaceChild = (nov, star) => zamena.push([nov, star]);
  const doc = {
    getElementById: () => ({}), head: { appendChild() {} }, defaultView: null,
    addEventListener() {},
    createTreeWalker: () => { const a = [t1, t2]; let i = 0; return { nextNode: () => a[i++] || null }; },
    createDocumentFragment: () => ({ kids: [], appendChild(x) { this.kids.push(x); } }),
    createTextNode: (v) => tn(v),
    createElement: () => ({ setAttribute() {}, textContent: '' }),
  };
  dd.ownerDocument = doc; dd.querySelectorAll = () => [];
  const n = T.razmetitBlok(dd, SPR);
  assert.equal(n, 1);
  assert.equal(zamena.length, 1);
  assert.equal(zamena[0][1], t2);
});

test('razmetitBlok: в заголовках разделов (H2–H6) подсказок нет', () => {
  const t = { nodeType: 3, nodeValue: 'Реестр недобросовестных поставщиков', parentNode: null };
  const h2 = { nodeName: 'H2', classList: { contains: () => false }, hasAttribute: () => false, replaceChild() { throw new Error('заголовок тронут'); } };
  const kont = { nodeName: 'SECTION', querySelectorAll: () => [] };
  t.parentNode = h2; h2.parentNode = kont;
  kont.ownerDocument = {
    getElementById: () => ({}), head: { appendChild() {} }, defaultView: null, addEventListener() {},
    createTreeWalker: () => { const a = [t]; let i = 0; return { nextNode: () => a[i++] || null }; },
  };
  assert.equal(T.razmetitBlok(kont, SPR), 0);
});
