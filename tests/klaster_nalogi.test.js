// klaster-nalogi-v1 (26.10.2026, [Ночные запуски]): статьи раздела /nalogi/ связаны между собой.
// Замер ссылок из <main> всех страниц (шапка и подвал не в счёт) на main 2787c21e:
// калькулятор «технического» поставщика и «Нет бухотчётности в открытых данных» держались на 3 входах,
// перечень офшорных зон — на 2 (хаб и перечень недружественных стран).
// 1) У каждой индексируемой статьи /nalogi/ — не меньше 4 входов из текста других страниц.
// 2) Карточки «Читайте также» в /nalogi/: адрес живой, без повторов в блоке, без ссылки на саму себя.
// 3) Добавленные карточки: заголовок — буква в букву h1 статьи (читатель видит то же, что откроет).
// nalogi-vhody-v1 (31.10.2026, [Ночные запуски]): /obnovleniya/ в счёт входов НЕ идёт — там только последние
// записи ленты, и каждая новая выкладка вытесняла 4-й вход перечня недружественных государств (v2k6, PR #221).
// Вход должен быть постоянным — из текста статьи, а не из ленты.
const VREMENNYE = new Set(['/obnovleniya/']);
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const PROPUSK = new Set(['.git', 'tests', 'partials', 'node_modules', 'сайт']);
const MIN_VHODOV = 4;

function stranicy() {
  const out = new Map();
  (function obhod(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (PROPUSK.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) obhod(p);
      else if (e.name.endsWith('.html')) {
        let u = '/' + path.relative(K, p).split(path.sep).join('/');
        if (u.endsWith('/index.html')) u = u.slice(0, -'index.html'.length);
        out.set(u, fs.readFileSync(p, 'utf8'));
      }
    }
  })(K);
  return out;
}

const VSE = stranicy();
const glavnoe = (h) => { const m = h.match(/<main[\s\S]*?<\/main>/); return m ? m[0] : ''; };
const noindex = (h) => /<meta name="robots" content="[^"]*noindex/.test(h);
const tekst = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const h1 = (h) => { const m = h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/); return m ? tekst(m[1]) : ''; };

const STATI = [...VSE.keys()].filter((u) => /^\/nalogi\/[^/]+\/$/.test(u) && !noindex(VSE.get(u)));

test(`у каждой статьи /nalogi/ — не меньше ${MIN_VHODOV} входов из текста других страниц`, () => {
  assert.ok(STATI.length >= 15, 'статей /nalogi/ подозрительно мало: ' + STATI.length);
  const malo = [];
  for (const t of STATI) {
    let n = 0;
    for (const [u, h] of VSE) {
      if (u === t || VREMENNYE.has(u)) continue;
      const m = glavnoe(h);
      if (m.includes(`href="${t}"`) || m.includes(`href="${t}#`)) n += 1;
    }
    if (n < MIN_VHODOV) malo.push(`${t} — ${n}`);
  }
  assert.deepStrictEqual(malo, [], 'мало входов');
});

test('«Читайте также» в /nalogi/: адреса живые, без повторов и без ссылки на себя', () => {
  for (const u of STATI) {
    const blok = VSE.get(u).match(/<section class="more">[\s\S]*?<\/section>/);
    if (!blok) continue;
    const hrefs = [...blok[0].matchAll(/<a class="card" href="([^"#]+)/g)].map((m) => m[1]);
    assert.strictEqual(new Set(hrefs).size, hrefs.length, `${u}: повтор карточки`);
    for (const x of hrefs) {
      assert.notStrictEqual(x, u, `${u}: карточка на саму себя`);
      assert.ok(VSE.has(x), `${u}: мёртвая карточка ${x}`);
    }
  }
});

const DOBAVLENO = {
  '/nalogi/kalkulyator-tehnicheskij-postavshchik/': ['/nalogi/nedostovernyj-adres-egryul/', '/nalogi/proverka-kontragenta-pered-dogovorom/'],
  '/nalogi/net-otchetnosti-v-otkrytyh-dannyh/': ['/nalogi/svezhest-dannyh-proverki-kontragenta/', '/nalogi/nds-postavshchika-na-usn-po-inn/'],
  '/nalogi/ofshornye-zony-perechen-minfina/': ['/nalogi/chto-oznachayut-cifry-inn-i-kpp/', '/nalogi/izmeneniya-egryul-kontragenta/'],
  '/nalogi/nedruzhestvennye-gosudarstva-perechen/': ['/nalogi/proverka-kontragenta-pered-dogovorom/', '/nalogi/dokumenty-kontragenta-po-summe-sdelki/'],
};

test('добавленные карточки: заголовок = h1 статьи', () => {
  for (const [t, gde] of Object.entries(DOBAVLENO)) {
    const zag = h1(VSE.get(t));
    assert.ok(zag, `${t}: нет h1`);
    for (const u of gde) {
      const blok = VSE.get(u).match(/<section class="more">[\s\S]*?<\/section>/);
      assert.ok(blok, `${u}: нет «Читайте также»`);
      const k = blok[0].match(new RegExp(`<a class="card" href="${t}"[^>]*>[\\s\\S]*?<b>([\\s\\S]*?)</b>`));
      assert.ok(k, `${u}: нет карточки ${t}`);
      assert.strictEqual(tekst(k[1]), zag, `${u} → ${t}`);
    }
  }
});
