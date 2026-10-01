// kopiya-v1: подпись-источник при копировании длинного текста (решение владельца 01.10.2026)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOREN = path.join(__dirname, '..');
const K = require('../js/kopiya.js');
const DLINNYJ = 'Банк вправе запросить документы по любой операции клиента, но ограничить дистанционное обслуживание может только после запроса без ответа или при повторяющихся признаках сомнительности.';
const URL_ST = 'https://deloskop.ru/115-fz/zablokirovali-schet-chto-delat/';

test('длинный текст → подпись с адресом страницы и обоими доменами (text/plain и text/html)', () => {
  assert.ok(DLINNYJ.length >= K.MIN);
  assert.ok(K.nuzhnaPodpis(DLINNYJ, { put: '/115-fz/zablokirovali-schet-chto-delat/' }));
  const r = K.sobrat(DLINNYJ, '<p>' + DLINNYJ + '</p>', URL_ST);
  assert.ok(r.text.startsWith(DLINNYJ), 'исходный текст — первым и целиком');
  assert.ok(r.text.endsWith('\n\nИсточник: ' + URL_ST + ' — Делоскоп, deloskop.ru · делоскоп.рф'));
  assert.ok(r.html.includes('<p>' + DLINNYJ + '</p>'));
  assert.ok(r.html.includes('<a href="' + URL_ST + '">deloskop.ru</a>'));
  assert.ok(r.html.includes('<a href="https://делоскоп.рф">делоскоп.рф</a>'));
});

test('адрес — без запроса и якоря (?inn= и метки не уходят в чужие тексты), кавычки экранируются', () => {
  assert.strictEqual(K.adres(null, 'https://deloskop.ru/?inn=7707083893#r2'), 'https://deloskop.ru/');
  assert.strictEqual(K.adres('https://deloskop.ru/nalogi/', 'https://deloskop.ru/nalogi/?utm_source=x'), 'https://deloskop.ru/nalogi/');
  assert.ok(!K.podpis('https://deloskop.ru/a"b').html.includes('a"b'));
  assert.ok(!K.sobrat('<b>&', null, URL_ST).html.includes('<b>&'), 'без HTML-выделения текст экранируется');
});

test('короткий фрагмент, поле ввода, data-copy, кабинет, админка, счёт → без подписи', () => {
  assert.ok(!K.nuzhnaPodpis('7707083893', {}), 'ИНН');
  assert.ok(!K.nuzhnaPodpis(DLINNYJ.slice(0, K.MIN - 1), {}), 'короче порога');
  assert.ok(!K.nuzhnaPodpis('\n\n      ' + DLINNYJ.slice(0, 100).split(' ').join('    ') + '\n\n\t   ', {}), 'лишние пробелы и переносы не добавляют знаков');
  assert.ok(!K.nuzhnaPodpis(DLINNYJ, { vIsklyuchenii: true }), 'поле ввода / data-copy / .no-src');
  for (const p of ['/cabinet', '/cabinet.html', '/cabinet/scheta', '/admin', '/admin.html', '/schet/', '/schet/dokument/'])
    assert.ok(!K.nuzhnaPodpis(DLINNYJ, { put: p }), p);
  for (const p of ['/', '/nalogi/', '/company/7707083893-sberbank/', '/praktika/115-fz/', '/schetchik/'])
    assert.ok(K.nuzhnaPodpis(DLINNYJ, { put: p }), p);
  for (const s of ['[data-copy]', '[data-copy2]', '.no-src', 'form', 'input', 'textarea', 'button', '#dp-doc', '.letter'])
    assert.ok(K.ISKL_BLOKI.includes(s), 'исключение ' + s);
});

test('реквизиты (ИНН, КПП, БИК, р/с) — без подписи, даже длинные', () => {
  const rekv = 'Получатель: ООО «Ромашка», ИНН 7707083893, КПП 773601001, р/с 40702810938000000001 в ПАО Сбербанк, БИК 044525225, к/с 30101810400000000225. Назначение: оплата по счёту № 15.';
  assert.ok(rekv.length >= K.MIN);
  assert.ok(K.rekvizity(rekv));
  assert.ok(!K.nuzhnaPodpis(rekv, {}));
  assert.ok(!K.rekvizity(DLINNYJ + ' Порог — 600 000 ₽ (ст. 6 115-ФЗ), ИНН проверяют по ЕГРЮЛ.'), 'одно упоминание ИНН в тексте статьи — не реквизиты');
});

// Браузерная часть: подставной document/getSelection, проверяем, что пишем в буфер и что не мешаем копировать
function brauzer({ put = '/nalogi/', tekst, iskl = false, aktTag = 'BODY', clipboard = true, kanon = 'https://deloskop.ru' + put }) {
  let obr = null;
  const uzel = { nodeType: 1, closest: (sel) => (iskl && sel === K.ISKL_BLOKI ? {} : null) };
  const okno = {
    location: { pathname: put, origin: 'https://deloskop.ru' },
    getSelection: () => ({ isCollapsed: false, rangeCount: 1, anchorNode: uzel, focusNode: uzel, toString: () => tekst,
      getRangeAt: () => ({ cloneContents: () => ({ html: '<p>' + tekst + '</p>' }) }) }),
  };
  const doc = {
    activeElement: { tagName: aktTag, isContentEditable: false },
    body: {},
    addEventListener: (t, f) => { if (t === 'copy') obr = f; },
    querySelector: (s) => (s.includes('canonical') && kanon ? { href: kanon } : null),
    createElement: () => { const d = { kids: [], appendChild: (x) => d.kids.push(x) }; Object.defineProperty(d, 'innerHTML', { get: () => d.kids.map((x) => x.html).join('') }); return d; },
  };
  okno.window = okno; okno.document = doc;
  vm.runInNewContext(fs.readFileSync(path.join(KOREN, 'js', 'kopiya.js'), 'utf8'), okno);
  assert.ok(obr, 'подписан на событие copy');
  const bufer = {};
  const e = { defaultPrevented: false, clipboardData: clipboard ? { setData: (t, v) => { bufer[t] = v; } } : null, preventDefault() { this.defaultPrevented = true; } };
  obr(e);
  return { bufer, otmeneno: e.defaultPrevented, okno };
}

test('браузер: длинное выделение статьи → оба формата в буфере, адрес из canonical', () => {
  const r = brauzer({ put: '/nalogi/', tekst: DLINNYJ });
  assert.ok(r.okno.dlkKopiya, 'чистые функции доступны странице');
  assert.ok(r.otmeneno, 'свой буфер вместо стандартного');
  assert.ok(r.bufer['text/plain'].startsWith(DLINNYJ));
  assert.match(r.bufer['text/plain'], /Источник: https:\/\/deloskop\.ru\/nalogi\/ — Делоскоп, deloskop\.ru · делоскоп\.рф$/);
  assert.match(r.bufer['text/html'], /<p>Банк вправе/);
  assert.match(r.bufer['text/html'], /<a href="https:\/\/deloskop\.ru\/nalogi\/">deloskop\.ru<\/a> · <a href="https:\/\/делоскоп\.рф">делоскоп\.рф<\/a>/);
});

test('браузер: короткое, в поле ввода, в data-copy, в кабинете, без clipboardData → буфер не трогаем, копирование не блокируем', () => {
  const sluchai = [
    { tekst: 'ИНН 7707083893' },
    { tekst: DLINNYJ, aktTag: 'TEXTAREA' },
    { tekst: DLINNYJ, aktTag: 'INPUT' },
    { tekst: DLINNYJ, iskl: true },
    { tekst: DLINNYJ, put: '/cabinet.html' },
    { tekst: DLINNYJ, clipboard: false },
  ];
  for (const s of sluchai) {
    const r = brauzer(s);
    assert.deepStrictEqual(r.bufer, {}, JSON.stringify(s));
    assert.ok(!r.otmeneno, 'стандартное копирование не отменено: ' + JSON.stringify(s));
  }
  // кнопка в фокусе, а выделена статья — подпись есть
  assert.ok(brauzer({ tekst: DLINNYJ, aktTag: 'BUTTON' }).bufer['text/plain']);
});

test('сборщик шапки подключил js/kopiya.js на всех страницах с шапкой (и в оболочку карточек из API)', () => {
  const src = fs.readFileSync(path.join(KOREN, 'tests', 'sobrat_shapku.py'), 'utf8');
  assert.match(src, /KOPIYA_JS = '<script src="\/js\/kopiya\.js" defer><\/script>'/);
  const stranicy = [];
  (function obhod(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.name.startsWith('.') || ['tests', 'partials', 'сайт', 'node_modules'].includes(f.name)) continue;
      const p = path.join(d, f.name);
      if (f.isDirectory()) obhod(p); else if (f.name.endsWith('.html')) stranicy.push(p);
    }
  })(KOREN);
  let s_shapkoj = 0;
  for (const p of stranicy) {
    const t = fs.readFileSync(p, 'utf8');
    if (!t.includes('<script src="/js/shapka.js" defer></script>')) continue;
    s_shapkoj++;
    assert.ok(t.includes('<script src="/js/kopiya.js" defer></script>'), path.relative(KOREN, p) + ': нет js/kopiya.js');
  }
  assert.ok(s_shapkoj > 30, 'страниц с шапкой: ' + s_shapkoj);
  const ob = path.join(KOREN, 'partials', 'obolochka.json');
  if (fs.existsSync(ob)) assert.ok(JSON.parse(fs.readFileSync(ob, 'utf8')).head.includes('/js/kopiya.js'), 'оболочка карточек из API');
});

test('kopiya.js не мешает копированию и не шлёт данные наружу', () => {
  const kod = fs.readFileSync(path.join(KOREN, 'js', 'kopiya.js'), 'utf8');
  assert.ok(!/fetch\(|sendBeacon|XMLHttpRequest|localStorage|removeAllRanges|user-select/.test(kod));
  assert.ok(!/addEventListener\("(cut|paste|selectstart|contextmenu)"/.test(kod), 'вырезание, вставку и выделение не трогаем');
});
