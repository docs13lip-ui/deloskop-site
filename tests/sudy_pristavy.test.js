// sudy-pristavy-v1 [Ночные запуски] 16.11: «Суды и приставы — подробно» в отчёте по ИНН (план отчёта 15.11, п. 5).
// Форма ответа — живой /api/check 16.11 08:10 (крупная сетевая компания: 5 652 дела как ответчик, 1 426 идут на 2,6 млрд ₽,
// сервер передал 30 последних дел; 449 производств у приставов, передал 20, остаток «по первым 100 из 449»).
// Компании и люди ниже вымышленные. node --test tests/sudy_pristavy.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const D = require('../js/sudy-pristavy.js');
const bezNb = (t) => String(t).replace(/ /g, ' ');
const K = path.join(__dirname, '..');

function delo(i, o) {
  return Object.assign({ nomer: 'А40-' + (100 + i) + '/2026', data: '2026-11-' + String(1 + i).padStart(2, '0'), tip: 'Г', sud: 'АС города Москвы',
    summa: 1000 * (i + 1), aktivno: true, pobeditel: 'Не определен', istcy: ['ООО "ПОСТАВЩИК ' + i + '"'],
    ssylka: 'https://kad.arbitr.ru/Card/' + i }, o || {});
}
function ip(i, o) {
  return Object.assign({ nomer: i + '/26/77054-ИП', data: '2026-10-' + String(10 + i).padStart(2, '0'), predmet: 'Госпошлина, присужденная судом',
    summa: 7000, ostatok: 7000, otdel: 'ОСП по Центральному АО №2', nalog_zarplata: false }, o || {});
}
function otvet(o) {
  o = o || {};
  return {
    company: { inn: '7700000001', kind: 'LEGAL', name_short: 'ПАО "ОБРАЗЕЦ"', status: 'ACTIVE' },
    damia: o.damia || {
      sudy: { nazvanie: 'Арбитражные суды', istochnik: 'Картотека арбитражных дел (через Checko)', status: 'polucheno', sostoyanie: 'found',
        data_svedeniy: '2026-11-12T23:39+03:00', podzagolovok: 'Суды общей юрисдикции не проверяли', proverit_samim: 'https://kad.arbitr.ru/',
        dannye: { vsego: 5652, otvetchik: 5652, otvetchik_nezaversheno: 1426, otvetchik_summa_nezaversheno: 2633108092.69, otvetchik_summa_vsego: 28012896082.55,
          dela: o.dela || [0, 1, 2, 3, 4, 5, 6].map((i) => delo(i)) } },
      fssp: { nazvanie: 'Приставы', istochnik: 'ФССП (через Checko)', status: 'polucheno', sostoyanie: 'found', data_svedeniy: '2026-11-12T23:39+03:00',
        proverit_samim: 'https://fssp.gov.ru/iss/ip/',
        dannye: { otkryto: 449, ostatok: 8166155.28, ostatok_tochno: false, zapisej_vsego: 449,
          proizvodstva: o.pr || [ip(1), ip(2, { predmet: 'Штраф ГИБДД', summa: 500, ostatok: 500 }), ip(3, { predmet: 'Налог (сбор, пени), включая страховые взносы', summa: 120000, ostatok: 40000 }),
            ip(4, { predmet: 'Заработная плата', summa: 90000, ostatok: 90000 }), ip(5, { predmet: 'Иные взыскания имущественного характера', summa: 3000, ostatok: 0 }),
            ip(6, { predmet: 'Непонятный предмет', nalog_zarplata: true })] } }
    }
  };
}
const razdel = (m, k) => m.razdely.find((x) => x.k === k);

test('два раздела: Суды и Приставы; без компании и без блоков — ничего', () => {
  const m = D.sobrat(otvet());
  assert.deepStrictEqual(m.razdely.map((x) => x.zag), ['Суды', 'Приставы']);
  assert.strictEqual(D.sobrat(null), null);
  assert.strictEqual(D.sobrat({ company: { inn: '7700000001' }, damia: {} }), null);
  assert.strictEqual(D.html(null), '');
});

test('суды: кратко — идущие дела против и сумма исков; факты за всё время и сейчас', () => {
  const s = razdel(D.sobrat(otvet()), 'sudy');
  assert.strictEqual(bezNb(s.kratko), '1 426 идущих дел против · иски на 2,6 млрд ₽');
  assert.deepStrictEqual(s.fakty.map((f) => bezNb(f.t + ': ' + f.z)), ['Ответчик за всё время: 5 652 дела на 28 млрд ₽', 'Идут сейчас: 1 426 на 2,6 млрд ₽']);
  assert.ok(s.fakty[1].vnim && !s.fakty[0].vnim);
});

test('суды: свежие сверху, на виду 5, остальные — «Показать все загруженные», честно «загружены 7 последних из 5 652»', () => {
  const m = D.sobrat(otvet()), s = razdel(m, 'sudy'), h = D.html(m);
  assert.deepStrictEqual(s.spisok.map((x) => x.data).slice(0, 2), ['07.11.2026', '06.11.2026']);
  assert.strictEqual(bezNb(s.pro), 'Загружены 7 последних из 5 652 — остальные в картотеке');
  assert.match(h, /Показать все загруженные \(7\)/);
  const vidno = h.split('dl__eshche')[0].split('data-dl="fssp"')[0];
  assert.strictEqual((vidno.match(/class="dl__s"/g) || []).length, 5);
  assert.match(h, /<ol class="dl__l" start="6">/);
  assert.match(bezNb(h), /Истец: ООО &quot;ПОСТАВЩИК 6&quot; · АС города Москвы · исковое · <span class="dl__st dl__st--idet">идёт<\/span>/);
});

test('суды: ФИО граждан и ИП в истцах не показываем; ссылки — только на kad.arbitr.ru', () => {
  const m = D.sobrat(otvet({ dela: [delo(1, { istcy: ['Иванов И. И.', 'ИП Петров Пётр Петрович', 'ООО "А"', 'ООО "Б"'] }), delo(2, { ssylka: 'javascript:alert(1)', nomer: '<b>А1</b>' })] }));
  const s = razdel(m, 'sudy'), h = D.html(m);
  assert.strictEqual(bezNb(s.spisok[1].istec), 'физическое лицо, индивидуальный предприниматель и ещё 2');
  assert.ok(!/Иванов|Петров/.test(h));
  assert.ok(!/javascript:/.test(h));
  assert.match(h, /&lt;b&gt;А1&lt;\/b&gt;/);
  assert.match(h, /href="https:\/\/kad\.arbitr\.ru\/Card\/1" target="_blank" rel="noopener nofollow"/);
});

test('суды: завершённое — «завершено» и исход, если он известен; «Не определен» не пишем; без суммы — «без суммы»', () => {
  const s = razdel(D.sobrat(otvet({ dela: [delo(1, { aktivno: false, pobeditel: 'Не определен', summa: 0 }), delo(2, { aktivno: false, pobeditel: 'Иск удовлетворен' })] })), 'sudy');
  assert.strictEqual(s.spisok[0].stadiya, 'завершено: иск удовлетворен');
  assert.strictEqual(s.spisok[1].stadiya, 'завершено');
  assert.strictEqual(s.spisok[1].summa, 'без суммы');
});

test('суды: чего не проверяли — истцом, третьим лицом и суды общей юрисдикции; не проверяли ≠ нет', () => {
  const s = razdel(D.sobrat(otvet()), 'sudy');
  assert.match(bezNb(s.ne), /^Не проверяли: дела, где компания истец или третье лицо, и суды общей юрисдикции — не проверяли не значит «нет»\.$/);
});

test('приставы: предметы группами — госпошлина не налог; флаг nalog_zarplata — в налоги; суммы — по остатку', () => {
  assert.strictEqual(D.gruppa({ predmet: 'Госпошлина, присужденная судом' }), 'poshliny');
  assert.strictEqual(D.gruppa({ predmet: 'Госпошлина по налоговому спору' }), 'poshliny');
  assert.strictEqual(D.gruppa({ predmet: 'Налог (сбор, пени), включая страховые взносы' }), 'nalogi');
  assert.strictEqual(D.gruppa({ predmet: 'Штраф ГИБДД' }), 'shtrafy');
  assert.strictEqual(D.gruppa({ predmet: 'Заработная плата' }), 'zarplata');
  assert.strictEqual(D.gruppa({ predmet: 'Иные взыскания имущественного характера' }), 'prochee');
  assert.strictEqual(D.gruppa({ predmet: 'Непонятный предмет', nalog_zarplata: true }), 'nalogi');
  const f = razdel(D.sobrat(otvet()), 'fssp');
  assert.deepStrictEqual(f.gruppy.map((g) => g.t + ' ' + g.n + (g.s ? ' ' + bezNb(g.s) : '')),
    ['Налоги и взносы 2 47 тыс. ₽', 'Зарплата 1 90 тыс. ₽', 'Штрафы 1 500 ₽', 'Госпошлины по суду 1 7 тыс. ₽', 'Прочее 1']);
});

test('приставы: остаток «не меньше», вниз; честно — группы по 6 последним из 449, остаток не по всем', () => {
  const f = razdel(D.sobrat(otvet()), 'fssp');
  assert.strictEqual(bezNb(f.kratko), '449 производств · долг от 8,1 млн ₽');
  assert.deepStrictEqual(f.fakty.map((x) => bezNb(x.t + ': ' + x.z)), ['Открыто производств: 449', 'Остаток долга: не меньше 8,1 млн ₽']);
  assert.strictEqual(bezNb(f.pro), 'Группы и список — по 6 последним из 449 производств; остаток посчитан не по всем производствам');
  const pog = f.spisok.find((x) => x.predmet.startsWith('Иные'));
  assert.strictEqual(bezNb(pog.dolg), 'погашено (3 тыс. ₽)');
  const nal = f.spisok.find((x) => x.predmet.startsWith('Налог'));
  assert.strictEqual(bezNb(nal.dolg), '40 тыс. ₽ из 120 тыс. ₽');
});

test('пусто и сбой: «Не нашли … на дату» — факт; «Не проверили» — не «нет»; слова «чисто» нет', () => {
  const m = D.sobrat(otvet({ damia: {
    sudy: { nazvanie: 'Арбитражные суды', status: 'polucheno', sostoyanie: 'not_found', data_svedeniy: '2026-11-12T23:39+03:00', istochnik: 'Картотека арбитражных дел (через Checko)' },
    fssp: { nazvanie: 'Приставы', status: 'ne_provereno', sostoyanie: 'not_checked' } } }));
  assert.strictEqual(bezNb(razdel(m, 'sudy').tekst), 'Не нашли дел, где компания — ответчик, на 12.11.2026.');
  assert.match(razdel(m, 'fssp').tekst, /^Не проверили/);
  const h = D.html(m);
  assert.ok(!/чисто|надёжн|ненадёжн/i.test(h));
  assert.match(h, /<div class="dl__r dl__r--ne" data-dl="fssp">/);
  assert.match(h, /href="https:\/\/fssp\.gov\.ru\/iss\/ip\/"[^>]*>проверить самим/);
  const st = D.sobrat(otvet({ damia: { sudy: { nazvanie: 'Арбитражные суды', status: 'stale', data_svedeniy: '2026-09-01' } } }));
  assert.match(bezNb(razdel(st, 'sudy').tekst), /^Сведения устарели \(на 01\.09\.2026\)/);
});

test('цвет — латунь и нейтральные через var(--x,#…); без красного; размеры шрифта — из шкалы 12/13/15', () => {
  const c = D.CSS;
  assert.ok(!/#(?:c0392b|d32f2f|e53935|f44336|b00020|red)\b|\bred\b/i.test(c));
  for (const m of c.matchAll(/font-size:(\d+)px/g)) assert.ok(['12', '13', '15'].includes(m[1]), 'размер вне шкалы: ' + m[1]);
  const goli = c.replace(/var\(--[\w-]+,#[0-9A-Fa-f]{3,6}\)/g, '').match(/#[0-9A-Fa-f]{3,6}\b/g) || [];
  assert.deepStrictEqual(goli, ['#ccc'], 'цвет числом — только бумага печати');
});

test('встроено: пакет otchet после plitki, главная — сразу после плиток, плитки «Суды» и «Приставы» ведут сюда', () => {
  const sb = JSON.parse(fs.readFileSync(path.join(K, 'partials/sborka.json'), 'utf8'));
  const vse = (o) => (o && typeof o === 'object' ? (Array.isArray(o) ? [o] : []).concat(...Object.values(o).map(vse)) : []);
  const ot = vse(sb).find((v) => v.includes('js/plitki.js')) || [];
  assert.strictEqual(ot.indexOf('js/sudy-pristavy.js'), ot.indexOf('js/plitki.js') + 1);
  const ind = fs.readFileSync(path.join(K, 'index.html'), 'utf8');
  assert.match(ind, /DlkPlitki\.mount\(report,r\)\}catch\(e\)\{\}\}\n[^\n]*\n {4}if\(!svoj&&window\.DlkSudyPristavy\)\{try\{DlkSudyPristavy\.mount\(report,r\)\}catch\(e\)\{\}\}/);
  const pl = fs.readFileSync(path.join(K, 'js/plitki.js'), 'utf8');
  assert.match(pl, /k === 'sudy' \|\| k === 'fssp'\) && report\.querySelector\('\.dl \[data-dl="' \+ k \+ '"\]'\)/);
});
