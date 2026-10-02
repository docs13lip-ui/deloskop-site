// «Разбор дела» и хаб /praktika/ ([Ночные запуски] 30.09.2026; решение владельца 30.09 01:20; макет и стоп-лист пп. 45–49 — [Арт-директор]).
// Держит: у каждого разбора карточка дела (номер, дата, первоисточник суда, дата сверки), ровно одна кнопка на живую страницу,
// расчёты — только в «Пример (условный)», итог — словом без зелёного/красного, таблица с data-l, нет «суды проверяем»,
// сверенные ошибки не вернулись (п. 5 ст. 90 НК, «в семь раз», «применяют как обязательное»), сборщик ничего не меняет.
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const D = JSON.parse(chitat('praktika/dela.json'));
const SUDY = /^https:\/\/(www\.)?(vsrf\.ru|ksrf\.ru|kad\.arbitr\.ru|publication\.pravo\.gov\.ru)\//;
const ITOGI = ['В пользу банка', 'В пользу клиента', 'В пользу компании', 'В пользу налоговой', 'В пользу налогоплательщика', 'На новое рассмотрение', 'Жалоба не принята'];
const un = (s) => s.replace(/\u00a0/g, ' ').replace(/&nbsp;/g, ' ');

test('dela.json: у каждого дела номер, дата, первоисточник суда, дата сверки и итог из словаря', () => {
  assert.ok(D.razbory.length >= 6);
  const slugi = new Set();
  for (const r of D.razbory) {
    assert.ok(!slugi.has(r.slug), 'повтор ' + r.slug); slugi.add(r.slug);
    assert.ok(D.razdely[r.razdel], r.slug + ': раздел');
    assert.ok(fs.existsSync(path.join(KOREN, 'tests/praktika', r.slug + '.html')), r.slug + ': нет текста автора');
    for (const d of r.dela) {
      assert.match(d.nomer, /^№ /, r.slug);
      assert.match(d.data, /^\d{4}-\d{2}-\d{2}$/, r.slug);
      assert.match(d.sverka, /^\d{4}-\d{2}-\d{2}$/, r.slug);
      assert.match(d.istochnik, SUDY, r.slug + ': первоисточник — сайт суда');
      assert.ok(ITOGI.includes(d.itog), r.slug + ': итог «' + d.itog + '»');
    }
    for (const s of r.pohozhie) assert.ok(D.razbory.some((x) => x.slug === s), r.slug + ': похожий ' + s);
    assert.ok(`${r.title}`.length <= 70, r.slug + ': title ' + r.title.length);
    assert.ok(r.description.length <= 160, r.slug + ': description ' + r.description.length);
  }
  const zaprosy = D.razbory.map((r) => r.zapros);
  assert.strictEqual(new Set(zaprosy).size, zaprosy.length, '1 разбор = 1 уникальный запрос-вопрос');
});

for (const r of D.razbory) {
  const f = `praktika/${r.razdel}/${r.slug}/index.html`;
  test('разбор ' + f, () => {
    const s = chitat(f);
    const t = un(s);
    assert.strictEqual((s.match(/<section class="delo"/g) || []).length, r.dela.length, 'карточка дела на каждое дело');
    for (const d of r.dela) {
      assert.ok(t.includes(d.nomer), 'номер ' + d.nomer);
      assert.ok(s.includes(`<time datetime="${d.data}">`), 'дата акта');
      assert.ok(s.includes(`href="${d.istochnik}"`), 'ссылка на первоисточник');
    }
    // ровно одно действие, и ведёт на живую страницу (пп. 45–49 стоп-листа)
    assert.strictEqual((s.match(/class="btn"/g) || []).length, 1, 'одна кнопка');
    const u = s.match(/class="btn" href="([^"]+)"/)[1];
    const put = u.split('?')[0].replace(/^\//, '');
    assert.ok(fs.existsSync(path.join(KOREN, put, 'index.html')) || fs.existsSync(path.join(KOREN, put)), 'кнопка на несуществующую страницу ' + u);
    const q = u.split('?s=')[1];
    if (q) assert.ok(new RegExp('\\n    ' + q + ': \\{').test(chitat('skoraya-115-fz/engine.js')), 'нет сценария Скорой ' + q);
    // расчёт «для вас» — только в .primer; итог — без зелёного и красного
    assert.ok(!/class="itog[^"]*(ok|bad|good|green|red)/.test(s));
    if (/Пример \(условный\)/.test(chitat('tests/praktika/' + r.slug + '.html'))) assert.fail('заголовок «Пример (условный)» ставит CSS — в тексте не писать');
    for (const td of s.match(/<td[^>]*>/g) || []) assert.ok(/data-l="/.test(td), 'td без data-l');
    // единственная цитата, одна «Где грань»
    assert.ok((s.match(/class="cit"/g) || []).length <= 1, 'одна цитата');
    assert.strictEqual((s.match(/class="gran"/g) || []).length, 1, 'одна «Где грань»');
    assert.ok(s.includes('<script src="/js/otzyv.js" defer></script>'), '«Полезно?»');
    assert.ok(s.includes('"@type": "Article"') && s.includes('"@type": "BreadcrumbList"'), 'JSON-LD');
    assert.ok(chitat('sitemap.xml').includes(`https://deloskop.ru/praktika/${r.razdel}/${r.slug}/`), 'sitemap');
    assert.ok(chitat('praktika/index.html').includes(`/praktika/${r.razdel}/${r.slug}/`), 'в хабе');
    assert.ok(chitat(`praktika/${r.razdel}/index.html`).includes(`/praktika/${r.razdel}/${r.slug}/`), 'в хабе раздела');
    // запреты: «суды проверяем» (прочерк 29.09), обещание исхода, ИИ
    assert.ok(!/суды провер|гарантир\S* (возврат|победу|исход)|нейросет|искусственн\S* интеллект/i.test(t));
  });
}

test('сверка 30.09 10:05: исправленные ошибки не вернулись', () => {
  const vse = D.razbory.map((r) => un(chitat(`praktika/${r.razdel}/${r.slug}/index.html`))).join('\n');
  assert.ok(!/п\. 5 ст\. 90/.test(vse), 'право на юриста — не п. 5 ст. 90 НК');
  assert.ok(!/в семь раз/.test(vse), '«Вокфорс»: разница в пять раз');
  assert.ok(!/как обязательное/.test(vse), 'обзор ФНС — «ссылаются», не «обязательное»');
  assert.ok(!/60 000 раз/.test(vse), 'АкваСтрой: почти в 50 000 раз');
  assert.ok(vse.includes('в пять раз') && vse.includes('почти в 50 000 раз') && vse.includes('ч. 1 ст. 48 Конституции'));
  assert.ok(vse.includes('Обзор практики применения арбитражными судами положений законодательства о налогах и сборах'));
});

test('хабы /115-fz/ и /nalogi/ ведут в практику; сборщик ничего не меняет', () => {
  assert.ok(chitat('115-fz/index.html').includes('href="/praktika/115-fz/"'));
  assert.ok(chitat('nalogi/index.html').includes('href="/praktika/nalogi/"'));
  execFileSync('python3', [path.join(KOREN, 'tests/sobrat_praktika.py'), '--check'], { cwd: KOREN });
});

// praktika-v1.1 ([Ночные запуски] 30.09 13:05 — правки сверки 12:05 с SEO-обвязкой [Маркетинга])
const vse_html = (dir) => fs.readdirSync(path.join(KOREN, dir), { withFileTypes: true }).flatMap((x) =>
  x.isDirectory() ? (['node_modules', '.git', 'tests', 'praktika', '_skrinshoty_ne_vykladyvat'].includes(x.name) && dir === '.' ? [] : vse_html(path.join(dir, x.name)))
    : (x.name.endsWith('.html') ? [path.join(dir, x.name)] : []));

test('у каждого разбора ≥ 2 входящие ссылки с живых страниц вне /praktika/', () => {
  const stranicy = vse_html('.').map((f) => chitat(f));
  for (const r of D.razbory) {
    const url = `/praktika/${r.razdel}/${r.slug}/`;
    const n = stranicy.filter((t) => t.includes(`href="${url}"`)).length;
    assert.ok(n >= 2, `${url}: входящих ссылок ${n}`);
  }
  for (const f of Object.keys(D.ssylki_s_sajta).filter((k) => !k.startsWith('_'))) {
    assert.ok(fs.existsSync(path.join(KOREN, f)), 'нет страницы ' + f);
    assert.strictEqual(chitat(f).split('<!--praktika-ssylki-->').length, 2, f + ': блок ссылок на разборы — ровно один');
  }
});

test('JSON-LD: citation — только прямой адрес текста акта; articleSection и about есть', () => {
  for (const r of D.razbory) {
    const t = chitat(`praktika/${r.razdel}/${r.slug}/index.html`);
    const ld = JSON.parse(t.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])[0];
    assert.ok(ld.articleSection && ld.about, r.slug);
    for (const c of ld.citation || []) {
      assert.match(c, /^https:\/\/(www\.)?(vsrf\.ru\/lk\/practice\/stor_pdf|ksrf\.ru\/doc\/|publication\.pravo\.gov\.ru\/document\/)/, r.slug + ': citation ' + c);
    }
    const pryamye = r.dela.filter((d) => /stor_pdf|ksrf\.ru\/doc\//.test(d.istochnik)).length;
    assert.strictEqual((ld.citation || []).length, pryamye, r.slug + ': citation = число прямых ссылок на акт');
  }
});

test('115/2 не обещает «семь побед» (ч. 3 ст. 5 38-ФЗ); 115/1 — «отменил взыскание», не «снял»; ч. 5 ст. 29 на месте', () => {
  const k = chitat('praktika/115-fz/zagraditelnye-komissii/index.html');
  assert.ok(!/семь раз вставал|позиция не меняется/.test(k));
  assert.ok(un(k).includes('почти везде итог — новое рассмотрение'));
  assert.ok(un(k).includes('ч. 5 ст. 29'));
  const b = chitat('praktika/115-fz/otklyuchili-internet-bank/index.html');
  assert.ok(!/снял 7,2/.test(un(b)), '«снял» читается как «взыскал»');
});

test('цель praktika_cta — клик по кнопке .dl разбора; без согласия dlkGoal ничего не шлёт', () => {
  const m = chitat('js/metrika.js');
  assert.ok(m.includes('"praktika_cta"') && m.includes('.pr .dl a[href]'));
  assert.ok(/addEventListener\("click", izRazbora, true\)/.test(m));
});

test('«Где в законе»: у каждой нормы — адрес полного текста (правовая база или сайт госоргана), на странице — ссылкой', () => {
  const BAZY = /^https:\/\/(www\.)?(consultant\.ru\/document\/cons_doc_LAW_\d+\/|garant\.ru\/products\/ipo\/prime\/doc\/\d+\/|base\.garant\.ru\/\d+\/|cbr\.ru\/|nalog\.gov\.ru\/|publication\.pravo\.gov\.ru\/|vsrf\.ru\/|ksrf\.ru\/)/;
  for (const r of D.razbory) {
    const t = chitat(`praktika/${r.razdel}/${r.slug}/index.html`);
    const ul = t.match(/<ul class="zakon">([\s\S]*?)<\/ul>/)[1];
    for (const z of r.zakon) {
      assert.strictEqual(z.length, 3, r.slug + ': [норма, редакция, первоисточник] — ' + z[0]);
      const adresa = typeof z[2] === 'string' ? [z[2]] : z[2].map((p) => { assert.ok(p[0] && p[1], r.slug + ': пара [подпись, адрес]'); return p[1]; });
      assert.ok(adresa.length >= 1, r.slug + ': нет адреса — ' + z[0]);
      for (const a of adresa) {
        assert.match(a, BAZY, r.slug + ': адрес ' + a);
        assert.ok(ul.includes(`href="${a}" rel="noopener" target="_blank"`), r.slug + ': на странице нет ссылки ' + a);
      }
    }
    assert.strictEqual((ul.match(/<li>/g) || []).length, r.zakon.length, r.slug + ': число норм');
  }
});

test('письмо ФНС № БВ-4-7/3060@ и Обзор ВС от 13.12.2023 — на полный текст, а не на пересказ', () => {
  for (const r of D.razbory) for (const z of r.zakon) {
    if (/БВ-4-7\/3060@/.test(z[0])) assert.strictEqual(z[2], 'https://www.consultant.ru/document/cons_doc_LAW_352052/');
    if (/13\.12\.2023/.test(z[0])) assert.strictEqual(z[2], 'https://www.consultant.ru/document/cons_doc_LAW_464347/');
  }
});

// faq-praktika-v1 ([Ночные запуски] 02.10 05:05; стратегия «Штаба» 02.10, п. 2 — FAQ-разметка до 06.10)
test('«Частые вопросы» в каждом разборе: ≥ 3 вопроса, FAQPage в JSON-LD, блок после «Где в законе» и до «Сверено»', () => {
  const F = JSON.parse(chitat('praktika/faq.json')).razbory;
  for (const r of D.razbory) {
    const v = F[r.slug] || [];
    assert.ok(v.length >= 3, r.slug + ': меньше 3 вопросов в praktika/faq.json');
    const t = chitat(`praktika/${r.razdel}/${r.slug}/index.html`);
    const ld = JSON.parse(t.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const fp = ld.find((o) => o['@type'] === 'FAQPage');
    assert.ok(fp && fp.mainEntity.length === v.length, r.slug + ': FAQPage');
    const a = t.indexOf('<ul class="zakon">'), b = t.indexOf('<section class="faq"'), c = t.indexOf('<p class="sver">');
    assert.ok(a > 0 && a < b && b < c, r.slug + ': порядок «Где в законе» → «Частые вопросы» → «Сверено»');
    assert.strictEqual(t.split('<section class="faq"').length, 2, r.slug + ': блок вопросов — один');
  }
});
