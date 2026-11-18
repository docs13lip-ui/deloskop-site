// kontragenty-shapka-v1 (18.11.2026, план «сайт лучше справочников», разд. 6 Н1 — хвост, и разд. 5 п. 18):
// значок «Ваши контрагенты» в шапке на всех страницах + заметка к компании в списке на главной.
// Запуск: node --test tests/*.test.*
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');
const M = require('../js/moi-kontragenty.js');
const P = require('../js/portfel.js');
const NOW = new Date(2026, 10, 18, 16, 0).getTime();

test('число: один ИНН — один раз, снимки и «Недавние» вместе; нули, мусор и чужой ИНН в снимке не считаются', () => {
  const s = JSON.stringify({
    '7707083893': [{ t: NOW, inn: '7707083893' }, { t: NOW - 1, inn: '7707083893' }],
    '7736050003': [{ t: NOW, inn: '7736050003' }],
    '0000000000': [{ t: NOW, inn: '0000000000' }],
    '7702070139': [{ t: NOW, inn: '7728168971' }],
    '123': [{ t: NOW, inn: '123' }]
  });
  const n = JSON.stringify([{ inn: '7736050003', t: NOW }, { inn: '500100732259', t: NOW }, { inn: '7728168971', t: 0 }, null]);
  assert.strictEqual(M.schet(s, n), 3);
  assert.strictEqual(M.schet(null, null), 0);
  assert.strictEqual(M.schet('{битый', '[]'), 0);
  assert.strictEqual(M.schet('[]', '{"inn":"7707083893"}'), 0);
});

test('число в значке — то же, что строк в списке на главной', () => {
  const s = { '7707083893': [{ t: NOW, inn: '7707083893', lvl: 'low' }], '0000000000': [{ t: NOW, inn: '0000000000' }] };
  const n = [{ inn: '7702070139', t: NOW - 5, name: 'Банк ВТБ (ПАО)' }, { inn: '7707083893', t: NOW - 9 }];
  assert.strictEqual(M.schet(JSON.stringify(s), JSON.stringify(n)), P.sobrat(s, n).length);
});

test('подпись для читалки и число: склонение, «99+»', () => {
  assert.strictEqual(M.podpis(1), 'Ваши контрагенты: 1 компания — проверки в этом браузере');
  assert.ok(M.podpis(3).includes('3 компании') && M.podpis(11).includes('11 компаний') && M.podpis(21).includes('21 компания'));
  assert.strictEqual(M.chislo(7), '7');
  assert.strictEqual(M.chislo(150), '99+');
});

test('шапка: значок скрыт до подсчёта, ведёт на список на главной; строка в меню телефона; в сеть — ничего', () => {
  const h = chitat('partials/shapka.html');
  const z = h.match(/<a class="shapka__moi" href="\/#portfel" data-moi data-moi-podpis hidden aria-label="Ваши контрагенты">[\s\S]*?<\/a>/);
  assert.ok(z, 'нет значка в шапке');
  assert.ok(z[0].includes('data-moi-n'), 'нет числа');
  assert.ok(h.indexOf(z[0]) < h.indexOf('data-auth-out'), 'значок — перед «Войти»');
  assert.ok(/<a class="mnav__row" href="\/#portfel" data-moi hidden>Ваши контрагенты<span class="shapka__cnt" data-moi-n><\/span><\/a>/.test(h), 'нет строки в меню-листе');
  assert.ok(chitat('index.html').includes('id="portfel"'), 'на главной нет якоря #portfel');
  const js = chitat('js/moi-kontragenty.js');
  assert.ok(!/fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|import\s*\(/.test(js));
  assert.ok(js.includes("'shapka_kontragenty'"), 'нет цели Метрики');
  const css = chitat('partials/shapka.css');
  assert.ok(/\.shapka \.shapka__moi\[hidden\]/.test(css), 'hidden должен прятать значок (display:inline-flex иначе сильнее)');
});

test('модуль есть на каждой странице с шапкой: в пакете «ядро» или отдельным файлом', () => {
  const sb = JSON.parse(chitat('partials/sborka.json'));
  assert.ok(sb.pakety.yadro.includes('js/moi-kontragenty.js'));
  assert.ok(sb.pakety.yadro.indexOf('js/moi-kontragenty.js') > sb.pakety.yadro.indexOf('js/shapka.js'));
  const fajly = execSync('git -c core.quotepath=off ls-files -z "*.html"', { cwd: KOREN, encoding: 'utf8' }).split('\0').filter(f => f && !f.startsWith('partials/'));
  let n = 0;
  for (const f of fajly) {
    const t = chitat(f);
    if (!t.includes('data-moi data-moi-podpis')) continue;
    n++;
    const paket = /\/js\/b\/yadro\.[0-9a-f]+\.js/.exec(t);
    const est = paket ? chitat(paket[0].slice(1)).includes('DlkMoiKontragenty') : t.includes('<script src="/js/moi-kontragenty.js" defer></script>');
    assert.ok(est, f + ': значок есть, а модуля нет');
  }
  assert.ok(n > 400, 'страниц со значком: ' + n);
});

test('заметка: чистится, режется до 200 знаков, пустая — удаляется; «Убрать» и «Очистить» снимают и заметку', () => {
  assert.strictEqual(P.zametkaChistit('  договор   до 31.12\u0007 \n\n\n менеджер  '), 'договор до 31.12\nменеджер');
  assert.strictEqual(P.zametkaChistit('я'.repeat(500)).length, 200);
  const store = {
    dlk_snimki: JSON.stringify({ '7707083893': [{ t: NOW, inn: '7707083893' }] }),
    dlk_nedavnie: '[]', chuzhoj: 'x'
  };
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  assert.strictEqual(P.zametkaZapisat(ls, '7707083893', '  предоплата 30 % '), 'предоплата 30 %');
  assert.strictEqual(P.zametkiChitat(ls)['7707083893'].z, 'предоплата 30 %');
  assert.strictEqual(P.zametkaZapisat(ls, 'abc', 'x'), '', 'не ИНН — не пишем');
  P.zametkaZapisat(ls, '7707083893', '   ');
  assert.ok(!('dlk_zametki' in store), 'пустая заметка — ключа нет');
  P.zametkaZapisat(ls, '7707083893', 'снова');
  P.ubrat(ls, '7707083893');
  assert.ok(!('dlk_zametki' in store), '«Убрать» снимает заметку');
  P.zametkaZapisat(ls, '7736050003', 'x');
  P.ochistit(ls);
  assert.deepStrictEqual(Object.keys(store), ['chuzhoj']);
});

test('заметок не больше 300 — уходят самые старые', () => {
  const store = {};
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  for (let i = 0; i < 305; i++) P.zametkaZapisat(ls, String(7700000000 + i), 'з' + i, NOW + i);
  const o = P.zametkiChitat(ls);
  assert.strictEqual(Object.keys(o).length, 300);
  assert.ok(!('7700000000' in o) && ('7700000304' in o));
});

test('заметка в списке: текст экранирован, под ИНН; правка — форма с подписью «видна только в этом браузере»', () => {
  const rows = P.sobrat({ '7707083893': [{ t: NOW, inn: '7707083893', lvl: 'low', nm: 'ПАО Сбербанк' }] }, []);
  const zm = { '7707083893': { z: '<b>предоплата</b>', t: NOW } };
  const h = P.html(rows, NOW, { zametki: zm });
  assert.ok(h.includes('<p class="pf__z ym-hide-content">&lt;b&gt;предоплата&lt;/b&gt;</p>'));
  assert.ok(h.includes('aria-label="Изменить заметку"'));
  assert.ok(h.includes('и заметки к ним? Отменить нельзя.'), 'очистка предупреждает о заметках');
  const r = P.html(rows, NOW, { zametki: zm, red: '7707083893' });
  assert.ok(r.includes('<form class="pf__zf" data-pf-zf="7707083893">') && r.includes('видна только в этом браузере'));
  assert.ok(r.includes('maxlength="200"') && r.includes('Удалить заметку') && !r.includes('<p class="pf__z'));
  const bez = P.html(rows, NOW, {});
  assert.ok(bez.includes('aria-label="Добавить заметку"') && !bez.includes('pf__z"') && !bez.includes('заметки к'));
});

test('текст заметки в Метрику не уходит: цель portfel_zametka — только длина или «удалил»', () => {
  const js = chitat('js/portfel.js');
  assert.ok(js.includes("cel('portfel_zametka', z ? { dlina: z.length } : { udalil: 1 })"));
  assert.ok(!/cel\([^)]*\.value/.test(js) && !/cel\([^)]*\bz\s*[,)]/.test(js));
});
