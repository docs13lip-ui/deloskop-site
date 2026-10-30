// Валидатор микроразметки (п. 394 Очереди; [Ночные запуски] 28.10.2026).
// Яндекс и Google показывают расширенный сниппет (крошки, вопросы, статья) только по
// разметке, которая сходится со страницей. Сторож держит это на всех страницах сайта:
// JSON-LD читается; адреса ведут на существующие страницы; url/mainEntityOfPage = canonical;
// у статьи есть заголовок (≤ 110 знаков), автор, издатель и даты, изменение не раньше публикации;
// крошки — по порядку, с именами; вопросы FAQPage видны на самой странице;
// индексируемая страница есть в sitemap, закрытая noindex — нет.
// Картинку статьи (image) сторожит tests/obraz_statej.test.js.
// Запуск: node --test tests/mikrorazmetka.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const SAJT = 'https://deloskop.ru';

const stranicy = execSync('git ls-files "*.html"', { cwd: KOREN, encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !f.startsWith('"') && !f.startsWith('tests/') && !f.startsWith('partials/') && !f.startsWith('сайт/'));

const estStranica = (u) => {
  if (!u.startsWith(SAJT)) return true;
  const put = u.slice(SAJT.length).split('#')[0].split('?')[0].replace(/^\//, '');
  if (!put) return fs.existsSync(path.join(KOREN, 'index.html'));
  return fs.existsSync(path.join(KOREN, put)) && fs.statSync(path.join(KOREN, put)).isFile()
    || fs.existsSync(path.join(KOREN, put, 'index.html'));
};
const vidimyj = (s) => s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;| /g, ' ').replace(/&#8209;|‑/g, '-').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const prostoj = (s) => s.replace(/ /g, ' ').replace(/‑/g, '-').replace(/\s+/g, ' ').trim();

const razmetka = (s) => {
  const vse = [];
  for (const m of s.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    const d = JSON.parse(m[1]);
    const spisok = Array.isArray(d) ? d : [d];
    for (const x of spisok) { vse.push(x); if (Array.isArray(x['@graph'])) vse.push(...x['@graph']); }
  }
  return vse;
};

const sitemap = new Set();
for (const f of fs.readdirSync(KOREN).filter((f) => /^sitemap.*\.xml$/.test(f))) {
  for (const m of fs.readFileSync(path.join(KOREN, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) sitemap.add(m[1]);
}

test('микроразметка: JSON-LD читается на всех страницах и есть хотя бы на 200', () => {
  let s = 0;
  for (const f of stranicy) {
    const t = fs.readFileSync(path.join(KOREN, f), 'utf8');
    assert.doesNotThrow(() => razmetka(t), `${f}: JSON-LD не читается`);
    if (razmetka(t).length) s++;
  }
  assert.ok(s >= 200, `страниц с разметкой ${s}`);
});

test('микроразметка: адреса живые, url и mainEntityOfPage = canonical, даты по порядку', () => {
  const oshibki = [];
  for (const f of stranicy) {
    const t = fs.readFileSync(path.join(KOREN, f), 'utf8');
    const can = (t.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    for (const x of razmetka(t)) {
      const tip = x['@type'];
      for (const k of ['url', '@id']) {
        if (typeof x[k] === 'string' && !estStranica(x[k])) oshibki.push(`${f}: ${tip}.${k} → нет страницы ${x[k]}`);
      }
      let mep = x.mainEntityOfPage; if (mep && typeof mep === 'object') mep = mep['@id'];
      if (mep && can && mep.split('#')[0] !== can) oshibki.push(`${f}: ${tip}.mainEntityOfPage ${mep} ≠ canonical ${can}`);
      if (['WebPage', 'Article', 'TechArticle', 'CollectionPage'].includes(tip) && x.url && can && x.url !== can) {
        oshibki.push(`${f}: ${tip}.url ${x.url} ≠ canonical ${can}`);
      }
      for (const d of [x.datePublished, x.dateModified]) {
        if (d && !/^\d{4}-\d\d-\d\d/.test(d)) oshibki.push(`${f}: ${tip} дата не ISO «${d}»`);
      }
      if (x.datePublished && x.dateModified && x.dateModified.slice(0, 10) < x.datePublished.slice(0, 10)) {
        oshibki.push(`${f}: ${tip} изменено ${x.dateModified} раньше публикации ${x.datePublished}`);
      }
    }
  }
  assert.deepStrictEqual(oshibki, []);
});

test('микроразметка: статья — заголовок ≤ 110, автор, издатель, обе даты', () => {
  const oshibki = [];
  for (const f of stranicy) {
    for (const x of razmetka(fs.readFileSync(path.join(KOREN, f), 'utf8'))) {
      if (!['Article', 'TechArticle', 'NewsArticle'].includes(x['@type'])) continue;
      for (const k of ['headline', 'author', 'publisher', 'datePublished', 'dateModified']) {
        if (!x[k]) oshibki.push(`${f}: нет ${k}`);
      }
      if (typeof x.headline === 'string' && x.headline.length > 110) oshibki.push(`${f}: headline ${x.headline.length} знаков`);
    }
  }
  assert.deepStrictEqual(oshibki, []);
});

test('микроразметка: крошки по порядку; вопросы FAQPage видны на странице', () => {
  const oshibki = [];
  let faq = 0;
  for (const f of stranicy) {
    const t = fs.readFileSync(path.join(KOREN, f), 'utf8');
    let vid = null;
    for (const x of razmetka(t)) {
      if (x['@type'] === 'BreadcrumbList') {
        const el = x.itemListElement || [];
        el.forEach((e, i) => {
          if (e.position !== i + 1) oshibki.push(`${f}: крошка ${i + 1} — position ${e.position}`);
          if (!e.name) oshibki.push(`${f}: крошка ${i + 1} без имени`);
          const u = e.item && typeof e.item === 'object' ? e.item['@id'] : e.item;
          if (i < el.length - 1 && !u) oshibki.push(`${f}: крошка ${i + 1} без адреса`);
          if (u && !estStranica(u)) oshibki.push(`${f}: крошка → нет страницы ${u}`);
        });
      }
      if (x['@type'] === 'FAQPage') {
        vid = vid || vidimyj(t);
        for (const q of x.mainEntity || []) {
          faq++;
          const otv = q.acceptedAnswer && q.acceptedAnswer.text;
          if (!q.name || !otv) { oshibki.push(`${f}: пустой вопрос/ответ`); continue; }
          if (!vid.includes(prostoj(q.name).slice(0, 40))) oshibki.push(`${f}: вопроса «${q.name.slice(0, 50)}» нет на странице`);
        }
      }
    }
  }
  assert.deepStrictEqual(oshibki, []);
  assert.ok(faq >= 100, `вопросов FAQPage ${faq}`);
});

test('микроразметка: индексируемая страница — в sitemap, noindex — не в sitemap', () => {
  const oshibki = [];
  for (const f of stranicy) {
    const t = fs.readFileSync(path.join(KOREN, f), 'utf8');
    const can = (t.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    if (!can) continue;
    const noindex = /<meta name="robots" content="[^"]*noindex/.test(t);
    if (!noindex && !sitemap.has(can)) oshibki.push(`${f}: нет в sitemap (${can})`);
    if (noindex && sitemap.has(can) && can !== SAJT + '/') oshibki.push(`${f}: noindex, а в sitemap`);
  }
  assert.deepStrictEqual(oshibki, []);
});
