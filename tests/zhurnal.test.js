// Журнал «Делоскоп · Неделя» (zhurnal-v1, 10.10.2026): схема выпуска, первоисточники, типографика, запреты,
// письмо ≤ 3 500 знаков, образец не публикуется, /zhurnal/ собран. Сборщик — tests/sobrat_zhurnal.py.
// PDF проверяет tests/test_zhurnal.py (нужен Playwright; в CI не запускается).
// v1.1: рубрика «Делобух: бухгалтерия недели» (с № 1) и ссылка «PDF для печати» на странице выпуска.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const DIR = path.join(KOREN, 'data', 'zhurnal');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');
const vypuski = () => fs.readdirSync(DIR).filter(f => /^\d{4}-\d{2}\.json$/.test(f))
  .map(f => ({ f, V: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }));
const py = (...a) => execFileSync('python3', [path.join(KOREN, 'tests', 'sobrat_zhurnal.py'), ...a], { cwd: KOREN, encoding: 'utf8' });

// все строки выпуска (кроме служебных _kak и адресов) — для проверок типографики и запретов
function stroki(o, out = [], kl = '') {
  if (typeof o === 'string') { if (!/^(_kak|url|data|nomer|id|status|vremya|ssylka|s|po)$/.test(kl)) out.push(o); }
  else if (Array.isArray(o)) o.forEach(x => stroki(x, out, kl));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) stroki(v, out, k);
  return out;
}
const vidimyj = h => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const ZAPRET = /(^|[^А-Яа-яЁё])ИИ([^А-Яа-яЁё]|$)|нейросет|искусственн[а-я]* интеллект|гарантир|лучш(ий|ая|ее|ие) в /i;

test('есть хотя бы один выпуск, и схема каждого — без ошибок (как в сборщике)', () => {
  const V = vypuski();
  assert.ok(V.length >= 1, 'нет data/zhurnal/*.json');
  for (const { f } of V) {
    const nomer = f.replace('.json', '');
    const out = execFileSync('python3', ['-c', `import sys,json;sys.path.insert(0,'tests');import sobrat_zhurnal as Z;print(json.dumps(Z.oshibki(Z.vypusk('${nomer}')),ensure_ascii=False))`], { cwd: KOREN, encoding: 'utf8' });
    assert.deepStrictEqual(JSON.parse(out), [], f);
  }
});

test('у каждой новости — первоисточник (https, домен из списка) и дата; у проекта — слово «проект»', () => {
  for (const { f, V } of vypuski()) {
    for (const [k, sp] of Object.entries(V.rubriki)) {
      for (const n of sp) {
        assert.ok(n.istochnik && /^https:\/\//.test(n.istochnik.url) && n.istochnik.nazvanie, `${f} ${k}/${n.id}: нет первоисточника`);
        assert.match(n.istochnik.data, /^\d{4}-\d{2}-\d{2}$/, `${f} ${k}/${n.id}: нет даты источника`);
        assert.doesNotMatch(n.istochnik.url, /(rbc|kommersant|vedomosti|interfax|tass|ria|klerk|vc)\.ru/, `${f} ${n.id}: СМИ — только в ukazatel`);
        if (n.status === 'proekt') assert.match([n.zagolovok, ...n.tekst].join(' '), /проект/i, `${f} ${n.id}: проект без слова «проект»`);
      }
    }
  }
});

test('типографика исходника: ёлочки, тире, без прямых кавычек и «...»', () => {
  for (const { f, V } of vypuski()) {
    for (const s of stroki(V)) {
      assert.ok(!/"/.test(s), `${f}: прямая кавычка: ${s.slice(0, 60)}`);
      assert.ok(!/ - |--/.test(s), `${f}: дефис вместо тире: ${s.slice(0, 60)}`);
      assert.ok(!/\.\.\./.test(s), `${f}: три точки вместо «…»: ${s.slice(0, 60)}`);
      assert.strictEqual((s.match(/«/g) || []).length, (s.match(/»/g) || []).length, `${f}: непарные ёлочки: ${s.slice(0, 60)}`);
      assert.doesNotMatch(s, ZAPRET, `${f}: запрещённое слово: ${s.slice(0, 60)}`);
      assert.doesNotMatch(s, /ИНН\s*\d{12}\b|ОГРНИП/, `${f}: данные ИП не публикуем`);
    }
  }
});

test('сборка выпуска: страница, письмо ≤ 3 500 знаков, отписка, utm, инлайн-стили; образец — noindex', () => {
  for (const { f, V } of vypuski()) {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'zh-'));
    py(V.nomer, '--out', out);
    const str = fs.readFileSync(path.join(out, 'stranica.html'), 'utf8');
    const pis = fs.readFileSync(path.join(out, 'pismo.html'), 'utf8');
    const txt = fs.readFileSync(path.join(out, 'pismo.txt'), 'utf8');
    const meta = JSON.parse(fs.readFileSync(path.join(out, 'vypusk.json'), 'utf8'));
    // страница
    for (const y of ['glavnoe', '115-fz', 'nalogi', 'sudy', 'vokrug', 'razbor', 'sroki', 'delobuh', 'novoe', 'kommentarij'])
      assert.ok(str.includes(`id="${y}"`) && str.includes(`href="#${y}"`), `${f}: нет рубрики/якоря ${y}`);
    assert.ok(str.includes('<!--podval-->') && str.includes('<!--shapka-->'), `${f}: шапка/подвал не собраны`);
    assert.ok(str.includes('/css/zhurnal.css'));
    const vid = vidimyj(str.slice(str.indexOf('<main'), str.indexOf('</main>')));
    assert.doesNotMatch(vid, ZAPRET, `${f}: запрещённое слово на странице`);
    assert.ok(!/\d [₽%]|\d (млн|млрд|тыс\.)/.test(vid), `${f}: обычный пробел перед ₽/%/млн`);
    assert.ok(!/ —/.test(vid.replace(/ —/g, '')), `${f}: тире без неразрывного пробела перед ним`);
    assert.ok(!/"/.test(vid), `${f}: прямые кавычки в тексте страницы`);
    if (V.obrazec) {
      assert.match(str, /<meta name="robots" content="noindex/, `${f}: образец без noindex`);
      assert.ok(/Образец выпуска(\u00a0| |&nbsp;)— не публиковать/.test(str), `${f}: у образца нет плашки`);
    }
    // письмо
    assert.ok(meta.znakov_v_pisme <= 3500, `${f}: письмо ${meta.znakov_v_pisme} знаков`);
    assert.ok(!/<style|class="/.test(pis), `${f}: в письме стили только инлайн`);
    assert.ok(pis.includes('{{otpiska}}') && txt.includes('{{otpiska}}'), `${f}: нет ссылки отписки`);
    assert.ok(/Отписаться/.test(pis));
    const ssylki = [...pis.matchAll(/href="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&')).filter(h => h !== '{{otpiska}}');
    assert.ok(ssylki.length >= 7, `${f}: мало ссылок «Читать дальше»`);
    for (const h of ssylki) assert.match(h, /^https:\/\/deloskop\.ru\/.*utm_source=zhurnal&utm_medium=email&utm_campaign=\d{4}-\d{2}/, `${f}: ссылка без utm: ${h}`);
    assert.strictEqual((pis.match(/Читать дальше/g) || []).length, 6, `${f}: 6 блоков «Читать дальше»`);
    assert.doesNotMatch(vidimyj(pis), ZAPRET);
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('образец не публикуется: нет страницы, ссылки и строки sitemap; /zhurnal/ собран и в подвале', () => {
  for (const { V } of vypuski()) {
    if (!V.obrazec) continue;
    assert.ok(!fs.existsSync(path.join(KOREN, 'zhurnal', V.nomer)), `образец ${V.nomer} лежит на сайте`);
    assert.ok(!chitat('zhurnal/index.html').includes(`/zhurnal/${V.nomer}/`), `образец ${V.nomer} в списке выпусков`);
    assert.ok(!chitat('sitemap.xml').includes(`/zhurnal/${V.nomer}/`), `образец ${V.nomer} в sitemap`);
  }
  const opubl = vypuski().filter(x => !x.V.obrazec);
  const sp = chitat('zhurnal/index.html');
  if (!opubl.length) assert.match(sp, /<meta name="robots" content="noindex/, 'пустой список выпусков — noindex');
  assert.ok(chitat('index.html').includes('<li><a href="/zhurnal/">Журнал</a></li>'), 'нет «Журнал» в подвале (раздел «Знания»)');
  assert.strictEqual(py('--check').trim(), 'Журнал собран');
});

test('лента: записи «Журнал Делоскопа» нет, пока нет настоящего выпуска', () => {
  const L = JSON.parse(chitat('obnovleniya.json')).obnovleniya;
  if (!vypuski().some(x => !x.V.obrazec)) assert.ok(!L.some(x => /Журнал Делоскопа|Делоскоп · Неделя/.test(x.zagolovok)));
});

test('v1.1 «Делобух: бухгалтерия недели»: 2–5 дел, у каждого — зачем и норма; инструмент — своя страница; в письме — чек-лист', () => {
  for (const { f, V } of vypuski()) {
    const dela = V.delobuh && V.delobuh.dela;
    assert.ok(Array.isArray(dela) && dela.length >= 2 && dela.length <= 5, `${f}: delobuh.dela — 2–5 дел`);
    for (const x of dela) {
      assert.ok(x.chto && x.chto.length <= 120 && x.zachem, `${f} ${x.id}: chto ≤ 120 и zachem`);
      assert.match(x.istochnik.url, /^https:\/\//, `${f} ${x.id}: норма — ссылкой`);
      if (x.instrument) {
        const u = x.instrument.url;
        assert.ok(fs.existsSync(path.join(KOREN, u, u.endsWith('/') ? 'index.html' : '')), `${f} ${x.id}: нет страницы ${u}`);
      }
    }
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'zh-'));
    py(V.nomer, '--out', out);
    const str = fs.readFileSync(path.join(out, 'stranica.html'), 'utf8');
    const pis = fs.readFileSync(path.join(out, 'pismo.html'), 'utf8');
    assert.ok(str.indexOf('id="sroki"') < str.indexOf('id="delobuh"') && str.indexOf('id="delobuh"') < str.indexOf('id="novoe"'), `${f}: «Делобух» — после «Сроков», до «Что нового»`);
    assert.strictEqual((str.match(/class="zh-delo"/g) || []).length, dela.length);
    assert.ok(pis.includes('Делобух: бухгалтерия недели'), `${f}: в письме нет «Делобуха»`);
    for (const x of dela) assert.ok(vidimyj(pis).replace(/\u00a0/g, ' ').includes(x.chto), `${f}: в письме нет дела ${x.id}`);
    assert.match(pis, /#delobuh"/);
    assert.match(pis, /deloskop-nedelya-\d{4}-\d{2}\.pdf\?utm_source=zhurnal/, `${f}: в письме нет ссылки на PDF`);
    // без собранного PDF ссылки на странице нет
    assert.ok(!str.includes('class="zh-pdf"'), `${f}: ссылка на PDF без самого PDF`);
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('v1.1 ссылка «PDF для печати»: A4, страницы, размер, цель Метрики; в печати скрыта; опубликованный выпуск — только с PDF', () => {
  const V = vypuski()[0].V;
  const h = execFileSync('python3', ['-c', `import sys;sys.path.insert(0,'tests');import sobrat_zhurnal as Z;print(Z.stranica_vypuska(Z.vypusk('${V.nomer}'),{'imya':'deloskop-nedelya-${V.nomer}.pdf','bajt':140000,'stranic':8})[1])`], { cwd: KOREN, encoding: 'utf8' });
  assert.match(h, new RegExp(`<p class="zh-pdf"><a href="deloskop-nedelya-${V.nomer}\\.pdf" download data-goal="zhurnal_pdf">PDF для печати</a><span>A4 · 8 страниц · 137 КБ</span></p>`));
  const css = chitat('css/zhurnal.css');
  const pechat = css.slice(css.indexOf('@media print'));
  assert.match(pechat, /\.zh-pdf[,{]/, 'ссылка на PDF не скрыта в печати');
  for (const { V: W } of vypuski().filter(x => !x.V.obrazec)) {
    const pdf = path.join(KOREN, 'zhurnal', W.nomer, `deloskop-nedelya-${W.nomer}.pdf`);
    assert.ok(fs.existsSync(pdf), `${W.nomer}: опубликован без PDF — python3 tests/sobrat_zhurnal.py ${W.nomer} --v-sajt`);
    assert.ok(fs.statSync(pdf).size <= 2 * 1024 * 1024, `${W.nomer}: PDF больше 2 МБ`);
    assert.ok(chitat(`zhurnal/${W.nomer}/index.html`).includes('data-goal="zhurnal_pdf"'));
  }
});

test('v1.1 «Что нового в Делоскопе» берёт записи ленты за неделю выпуска (дата — из id «ГГГГ-ММ-ДД-N»)', () => {
  const L = JSON.parse(chitat('obnovleniya.json')).obnovleniya;
  for (const { f, V } of vypuski()) {
    const ozhid = L.filter(x => /^\d{4}-\d{2}-\d{2}-/.test(x.id) && x.id.slice(0, 10) >= V.nedelya.s && x.id.slice(0, 10) <= V.nedelya.po).slice(0, 5).map(x => x.id);
    const out = execFileSync('python3', ['-c', `import sys,json;sys.path.insert(0,'tests');import sobrat_zhurnal as Z;print(json.dumps([x['id'] for x in Z.novoe_za_nedelyu(Z.vypusk('${V.nomer}'))]))`], { cwd: KOREN, encoding: 'utf8' });
    assert.deepStrictEqual(JSON.parse(out), ozhid, `${f}: «Что нового» не совпадает с лентой недели`);
  }
});
