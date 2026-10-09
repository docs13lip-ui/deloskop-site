// bez-dvusmyslennosti-v1 (04.10.2026, [Ночные запуски]): бета бесплатна ПО 13 октября включительно
// (решение владельца 30.09). «До 13 октября» читается как «13-го уже платно» — спор с клиентом,
// который заплатил 13.10 ([Право · Юрист 115-ФЗ] 04.10 09:20, ч. 7 ст. 5 38-ФЗ).
// Сторож: на публичных страницах и в скриптах — ни «до 13 октября», ни «до 13.10».
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
// obnovleniya/ — история ленты: старые записи не переписываем.
const PROPUSK = new Set(['.git', 'node_modules', 'tests', 'deploy', 'obnovleniya']);
function obojti(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (PROPUSK.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) obojti(p, out);
    else if (/\.(html|js|json)$/.test(e.name) && e.name !== 'obnovleniya.json' && e.name !== 'obnovleniya.js') out.push(p);
  }
  return out;
}
const PLOHO = /до(?:\s|&nbsp;| )+13(?:(?:\s|&nbsp;| )+октябр|\.10\b)/i;
test('срок беты: «по 13 октября», а не «до 13 октября»', () => {
  const plohie = obojti(KOREN, []).filter((f) => PLOHO.test(fs.readFileSync(f, 'utf8')))
    .map((f) => path.relative(KOREN, f));
  assert.deepStrictEqual(plohie, [], 'пишите «по 13 октября (включительно)» или «до 14 октября»');
});
// beta-data-v1 (09.10.2026, [Ночные запуски]; ТЗ [Продукт] 05.10, claude/Продукт_14.10_без_ворот_бета_не_врёт_05.10.md,
// разд. 1; тексты B и C — [Право] 05.10 11:10, разд. 1): дата конца беты — одно место, tarify.json → "beta_do".
const { execFileSync } = require('child_process');
const vm = require('vm');
const T = JSON.parse(fs.readFileSync(path.join(KOREN, 'tarify', 'tarify.json'), 'utf8'));
const chast = (f) => fs.readFileSync(path.join(KOREN, 'partials', f), 'utf8');
const NBR = '(?:\\s|&nbsp;| )+';
test('tarify.json: beta_do — дата ГГГГ-ММ-ДД или null', () => {
  assert.ok('beta_do' in T, 'поле beta_do должно быть (null — дата не назначена)');
  assert.ok(T.beta_do === null || /^\d{4}-\d{2}-\d{2}$/.test(T.beta_do), String(T.beta_do));
});
test('(а) дат беты текстом нет нигде, кроме вывода из beta_do', () => {
  // Разрешено: полоса (сборщик пишет из beta_do), span data-beta-srok="ГГГГ-ММ-ДД" (то же), лента «Что нового» — история.
  const DATA = new RegExp('(?:1[34]' + NBR + 'октябр|\\b1[34]\\.10\\b)', 'i');
  const chistit = (t) => t
    .replace(/<!--beta-polosa-->[\s\S]*?<!--\/beta-polosa-->/g, '')
    .replace(/<span data-beta-srok="[^"]*"( data-beta-vkl)?>[^<]*<\/span>/g, '')
    .replace(/<script type="application\/json" id="tarify-data">[\s\S]*?<\/script>/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
  const plohie = [];
  for (const f of obojti(KOREN, []).concat([path.join(KOREN, 'tests', 'kartochka_render.py')])) {
    const rel = path.relative(KOREN, f);
    if (rel === path.join('tarify', 'tarify.json')) continue; // сам источник даты (_beta_do — пояснение)
    let t = fs.readFileSync(f, 'utf8');
    if (rel.endsWith('.py')) t = t.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
    if (rel.endsWith('.json')) t = t.replace(/"_[a-z_]+": "(?:[^"\\]|\\.)*"/g, ''); // пояснения «_…» — не текст сайта
    const m = chistit(t).match(DATA);
    if (m) plohie.push(rel + ': …' + m[0]);
  }
  assert.deepStrictEqual(plohie, [], 'дату конца беты берите из tarify.json → beta_do (tests/beta.py / js: srokBety)');
});
test('полоса: каркас и тексты A/B/C — дословно ([Право] 05.10 11:10, разд. 1)', () => {
  assert.ok(chast('beta-a.html').includes('<b>Открытая бета: всё бесплатно по&nbsp;{{D}} включительно.</b> <span class="beta-bar__dop">С&nbsp;{{D1}}&nbsp;— тарифы; быстрая проверка останется бесплатной, 3&nbsp;в&nbsp;день.'));
  // текст B дословно; жирным — только «Открытая бета продолжается:» (на 390 px заголовок в одну строку, полоса ≤ 125 px)
  assert.ok(chast('beta-b.html').includes('<b>Открытая бета продолжается:</b> <span class="beta-bar__dop">всё бесплатно. О&nbsp;начале тарифов скажем здесь не&nbsp;позже чем за&nbsp;3&nbsp;дня; быстрая проверка останется бесплатной, 3&nbsp;в&nbsp;день.'));
  assert.ok(chast('beta-c.html').startsWith('<b>Бета завершилась {{D}}.</b> Быстрая проверка&nbsp;— бесплатно, 3&nbsp;в&nbsp;день. <a href="/tarify/"'));
  for (const f of ['beta-a.html', 'beta-b.html'])
    assert.ok(/<a href="\/osnovatel\/" data-goal="beta_osnovatel" data-beta-osn>Цена основателя для первых 300&nbsp;→<\/a>/.test(chast(f)), f);
  for (const f of ['beta-a.html', 'beta-b.html', 'beta-c.html']) assert.ok(!/успе|последн|только сегодня|ИИ|нейросет/i.test(chast(f)), f);
});
test('(в) текст B: ни даты, ни цены, ни «тарифы с…»', () => {
  const b = chast('beta-b.html').replace(/<[^>]+>/g, ' ');
  assert.ok(!/₽|руб|\d{2}\.\d{2}|октябр|тариф(ы)? с\b|с(\s|&nbsp;)+1[0-9]/i.test(b), b);
  const c = chast('beta-c.html').replace(/<[^>]+>/g, ' ');
  assert.ok(!/₽|руб|оплатит|скрыть/i.test(c), c);
  assert.ok(!chast('beta-c.html').includes('data-beta-x'));
});
function shapka() {
  const win = {};
  const doc = { readyState: 'complete', querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(path.join(KOREN, 'js/shapka.js'), 'utf8'),
    { window: win, document: doc, location: { pathname: '/', hostname: '' }, localStorage: { getItem: () => null } });
  return win.dlkBeta;
}
const MSK = (s) => Date.parse(s + '+03:00');
test('(б) режим полосы по времени МСК: 13.10 23:59 → A, 14.10 00:00 → B, null → B, C 7 дней', () => {
  const B = shapka();
  assert.strictEqual(B.konecDnya('2026-10-13'), MSK('2026-10-14T00:00:00'));
  assert.strictEqual(B.rezhimSejchas('a', '2026-10-13', MSK('2026-10-13T23:59:59')), 'a');
  assert.strictEqual(B.rezhimSejchas('a', '2026-10-13', MSK('2026-10-14T00:00:00')), 'b');
  assert.strictEqual(B.rezhimSejchas('b', '', MSK('2026-10-10T12:00:00')), 'b');
  assert.strictEqual(B.rezhimSejchas('a', 'чушь', MSK('2026-10-10T12:00:00')), 'b');
  assert.strictEqual(B.rezhimSejchas('c', '2026-10-13', MSK('2026-10-17T12:00:00')), 'c');  // beta:false + 3 дня
  assert.strictEqual(B.rezhimSejchas('c', '2026-10-13', MSK('2026-10-22T12:00:00')), 'net'); // + 8 дней — полосы нет
});
test('(б) инлайн-скрипт полосы делает то же, что rezhimSejchas (A → B, C гаснет, «скрыть» — по дате)', () => {
  const kod = chast('beta.html').match(/<script>([\s\S]*?)<\/script>/)[1];
  const prog = (rezhim, d, sejchas, skryt) => {
    const tekst = { innerHTML: 'A' }, tpl = { innerHTML: 'B' };
    const bar = { hidden: false, at: { 'data-beta-rezhim': rezhim, 'data-beta-do': d },
      getAttribute(k) { return this.at[k]; }, setAttribute(k, v) { this.at[k] = v; },
      querySelector: (s) => (s === '.beta-bar__t' ? tekst : s === 'template[data-beta-b]' ? tpl : null) };
    const ls = { getItem: (k) => (skryt && k === skryt[0] ? String(skryt[1]) : null) };
    const D = class extends Date { static now() { return sejchas; } };
    vm.runInNewContext(kod, { document: { querySelector: () => bar }, localStorage: ls, Date: D });
    return { tekst: tekst.innerHTML, rezhim: bar.at['data-beta-rezhim'], hidden: bar.hidden };
  };
  assert.deepStrictEqual(prog('a', '2026-10-13', MSK('2026-10-13T23:59:00')), { tekst: 'A', rezhim: 'a', hidden: false });
  assert.deepStrictEqual(prog('a', '2026-10-13', MSK('2026-10-14T00:00:00')), { tekst: 'B', rezhim: 'b', hidden: false });
  assert.deepStrictEqual(prog('c', '2026-10-13', MSK('2026-10-16T00:00:00')).hidden, false);
  assert.deepStrictEqual(prog('c', '2026-10-13', MSK('2026-10-21T00:00:00')).hidden, true);
  // «скрыть» действует по ключу своей даты; ключ другой даты — полосу снова видно
  const pozzhe = MSK('2026-10-12T00:00:00');
  assert.strictEqual(prog('a', '2026-10-13', MSK('2026-10-11T00:00:00'), ['dlk_beta_skryt_2026-10-13', pozzhe]).hidden, true);
  assert.strictEqual(prog('a', '2026-10-20', MSK('2026-10-11T00:00:00'), ['dlk_beta_skryt_2026-10-13', pozzhe]).hidden, false);
  assert.strictEqual(prog('b', '', MSK('2026-10-11T00:00:00'), ['dlk_beta_skryt_net', pozzhe]).hidden, true);
});
test('«Скрыть»: неделя, в режиме A — не дольше конца беты; надпись крестика по сроку; ключ — по дате', () => {
  const B = shapka();
  const K = MSK('2026-10-14T00:00:00');
  assert.strictEqual(B.klyuch('2026-10-13'), 'dlk_beta_skryt_2026-10-13');
  assert.strictEqual(B.klyuch(''), 'dlk_beta_skryt_net');
  assert.strictEqual(B.srokSkrytiya(MSK('2026-10-10T12:00:00'), K), K);
  assert.strictEqual(B.srokSkrytiya(MSK('2026-10-05T12:00:00'), K), MSK('2026-10-12T12:00:00'));
  assert.strictEqual(B.srokSkrytiya(MSK('2026-10-15T12:00:00'), 0), MSK('2026-10-22T12:00:00'));
  assert.strictEqual(B.nadpisKrestika(MSK('2026-10-05T12:00:00'), K), 'Скрыть на неделю');
  assert.strictEqual(B.nadpisKrestika(MSK('2026-10-08T12:00:00'), K), 'Скрыть до конца беты');
  assert.strictEqual(B.nadpisKrestika(MSK('2026-10-08T12:00:00'), 0), 'Скрыть на неделю');
});
test('сроки в тексте страниц: span убирается, когда день прошёл', () => {
  const B = shapka();
  const mk = (d) => { const el = { getAttribute: () => d, parentNode: { removeChild() { el.ubran = true; } } }; return el; };
  const els = [mk('2026-10-13'), mk('2026-10-20'), mk(null)];
  const root = { querySelectorAll: () => els };
  assert.strictEqual(B.srokiSnyat(root, MSK('2026-10-14T00:00:01')), 1);
  assert.deepStrictEqual(els.map((e) => !!e.ubran), [true, false, false]);
});
test('ссылка «Цена основателя» гаснет, когда мест нет; API молчит — остаётся', () => {
  const B = shapka();
  assert.strictEqual(B.osnSsylka({ vsego: 300, zanyato: 300 }), false);
  assert.strictEqual(B.osnSsylka({ vsego: 300, zanyato: 301 }), false);
  assert.strictEqual(B.osnSsylka({ vsego: 300, zanyato: 0 }), true);
  assert.strictEqual(B.osnSsylka(null), true);
});
test('сборка: полоса и сроки на страницах — из beta_do (Python tests/beta.py)', () => {
  const kod = 'import sys,json;sys.path.insert(0,"tests");import beta as B;' +
    'print(json.dumps([B.polosa_sobrat(True,"2026-10-13"),B.polosa_sobrat(True,None),B.polosa_sobrat(False,"2026-10-13"),B.polosa_sobrat(False,None),' +
    'B.sroki("x<span data-beta-srok></span>.y<span data-beta-srok data-beta-vkl></span>","2026-10-13"),B.sroki("<span data-beta-srok=\\"2026-10-13\\"> по 13</span>",None),' +
    'B.sroki("В&nbsp;бете бесплатно по&nbsp;13&nbsp;октября&nbsp;→","2026-10-20")]))';
  const [a, b, c, net, s1, s2, s3] = JSON.parse(execFileSync('python3', ['-c', kod], { cwd: KOREN, encoding: 'utf8' }));
  assert.ok(a.includes('data-beta-rezhim="a" data-beta-do="2026-10-13" data-beta-bar>') && a.includes('по&nbsp;13&nbsp;октября включительно.')
    && a.includes('С&nbsp;14&nbsp;октября&nbsp;— тарифы') && a.includes('<template data-beta-b><b>Открытая бета продолжается'));
  assert.ok(b.includes('data-beta-rezhim="b" data-beta-do="" data-beta-bar>') && !/октябр|<template/.test(b) && b.includes('data-beta-x'));
  assert.ok(c.includes('class="beta-bar beta-bar--c"') && c.includes('Бета завершилась 13&nbsp;октября.') && !c.includes('data-beta-x'));
  assert.strictEqual(net, '');
  assert.strictEqual(s1, 'x<span data-beta-srok="2026-10-13"> по&nbsp;13&nbsp;октября</span>.y<span data-beta-srok="2026-10-13" data-beta-vkl> по&nbsp;13&nbsp;октября включительно</span>');
  assert.strictEqual(s2, '<span data-beta-srok></span>');
  assert.strictEqual(s3, 'В&nbsp;бете бесплатно<span data-beta-srok="2026-10-20"> по&nbsp;20&nbsp;октября</span>&nbsp;→');
});
// [Право] 05.10 11:10, разд. 1, условие 1: «скажем здесь не позже чем за 3 дня» — от появления на живом.
// Коммит, который ставит дату вместо null, должен давать не меньше 3 полных дней: beta_do − сегодня (МСК) ≥ 3.
test('сторож «за 3 дня»: новая дата вместо null — не раньше сегодня + 3 дня (МСК)', () => {
  let bylo;
  try {
    const baza = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: KOREN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    bylo = JSON.parse(execFileSync('git', ['show', baza + ':tarify/tarify.json'], { cwd: KOREN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch (e) { return; } // нет origin/main (локальная копия без истории) — сверять не с чем
  if (!('beta_do' in bylo) || bylo.beta_do !== null || !T.beta_do) return; // правило — только для null → дата
  const segodnya = Date.parse(new Date(Date.now() + 3 * 36e5).toISOString().slice(0, 10) + 'T00:00:00Z');
  const dnej = (Date.parse(T.beta_do + 'T00:00:00Z') - segodnya) / 864e5;
  assert.ok(dnej >= 3, 'beta_do ' + T.beta_do + ' — через ' + dnej + ' дн.: о начале тарифов обещали сказать не позже чем за 3 дня');
});
