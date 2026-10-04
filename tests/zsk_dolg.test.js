// zsk-dolg-sud-v1 + Разбор № 12 ([Ночные-3] 04.10 18:20): «красная зона не мешает взыскать долг по суду» (Б-9)
// на трёх местах — ТЗ [Продукт] 04.10 14:00 разд. 2, тексты [Право · 115-ФЗ] 13:10 разд. 4 (ВС 24.07.2025 № 305-ЭС25-1505).
// node --test tests/zsk_dolg.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const chitat = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const un = (s) => s.replace(/&nbsp;|\u00a0/g, ' ').replace(/&#8209;|\u2011/g, '-');
const ZSK_URL = 'https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/';
const RAZBOR = '/praktika/115-fz/zsk-dolzhnika-sudebnyj-prikaz/';
const STATYA = '115-fz/proverit-kontragenta-zsk-po-inn/index.html';
const STR = 'praktika/115-fz/zsk-dolzhnika-sudebnyj-prikaz/index.html';
const ZAPRET = /(?<!не )гарантир|всегда взыщ|обязательно вернёте|46 469|46 496/i;

test('номер акта на трёх местах: статья о ЗСК контрагента, Разбор № 12, подсказка Паспорта', () => {
  assert.ok(un(chitat(STATYA)).includes('№ 305-ЭС25-1505'));
  assert.ok(un(chitat(STR)).includes('№ 305-ЭС25-1505'));
  assert.ok(un(P.OTM_ZSK_SUD).includes('№ 305-ЭС25-1505'));
});

test('без обещания исхода и без точной суммы процентов — только «около 46,5 тыс. ₽»', () => {
  for (const t of [chitat(STATYA), chitat(STR), chitat('tests/praktika/zsk-dolzhnika-sudebnyj-prikaz.html'), P.OTM_ZSK_SUD]) {
    assert.ok(!ZAPRET.test(un(t)), 'запрещённое слово или точная сумма');
  }
  assert.ok(un(chitat(STR)).includes('около 46,5 тыс. ₽'));
});

test('статья: абзац после «6 месяцев» и до «Что сделать», ссылка на Разбор с целью; FAQ — подстрока страницы и в FAQPage', () => {
  const s = chitat(STATYA);
  const a = s.indexOf('за&nbsp;6&nbsp;месяцев'), b = s.indexOf('id="vzyskanie"'), c = s.indexOf('<strong>Что сделать:</strong>');
  assert.ok(a > 0 && a < b && b < c, 'место абзаца');
  assert.ok(s.includes(`href="${RAZBOR}" data-goal="zsk_dolg_razbor"`));
  const det = s.match(/<details><summary>Поставщик из&nbsp;красной зоны[^<]*<\/summary><p>([^<]*)<\/p><\/details>/);
  assert.ok(det, 'вопрос FAQ');
  const tekst = s.slice(s.indexOf('<article>'), s.indexOf('</article>'));
  assert.ok(tekst.includes(det[1]), 'ответ FAQ — дословно из статьи');
  const ld = JSON.parse(s.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  const q = ld[2].mainEntity.find((x) => /не вернул аванс/.test(x.name));
  assert.ok(q && q.acceptedAnswer.text === un(det[1]));
  assert.strictEqual(ld[0].dateModified, '2026-10-04');
});

test('Паспорт: подсказка только при отметке «есть сведения» в сервисе ЗСК; в печать не идёт', () => {
  const r = { n: 12, id: 'stoplisty', status: 'not_checked', sam: [{ tekst: 'cbr.ru — проверка по ИНН', url: ZSK_URL }] };
  const seg = new Date(2026, 9, 4, 12, 0);
  assert.strictEqual(P.otmetka(r, { rez: 'est', data: '04.10.2026', vremya: '10:00' }, seg).zskSud, true);
  assert.strictEqual(P.otmetka(r, { rez: 'net', data: '04.10.2026', vremya: '10:00' }, seg).zskSud, false);
  assert.strictEqual(P.otmetka(r, { rez: 'ne_udalos', data: '04.10.2026', vremya: '10:00' }, seg).zskSud, false);
  const wl = { n: 12, id: 'stoplisty', status: 'not_checked', sam: [{ tekst: 'cbr.ru — список', url: 'https://www.cbr.ru/inside/warning-list/' }] };
  assert.ok(!P.otmetka(wl, { rez: 'est', data: '04.10.2026', vremya: '10:00' }, seg).zskSud, 'список ЦБ — не ЗСК');
  assert.ok(P.OTM_ZSK_SUD.length <= 160);
  const h = chitat('pasport/kontragent/index.html');
  assert.ok(/\(o\.zskSud\?'<small class="otm-zs noprint">'/.test(h), 'строка — с noprint');
  assert.strictEqual(P.OTM_ZSK_SUD_URL, RAZBOR);
});

test('Разбор № 12: одна кнопка «Проверить должника по ИНН», «Следить за должником», входящие ссылки', () => {
  const s = chitat(STR);
  assert.strictEqual((s.match(/class="btn"/g) || []).length, 1);
  assert.ok(s.includes('data-goal="razbor12_check"'));
  assert.ok(/razbor12_slezh/.test(s));
  assert.ok(chitat('praktika/115-fz/krasnaya-zona-zsk-sud/index.html').includes(`href="${RAZBOR}"`), 'обратная ссылка из «Красная зона ЗСК в суде»');
  assert.ok(chitat('115-fz/zsk-zony-riska/index.html').includes(`href="${RAZBOR}"`));
  assert.ok(!/Тинькофф|ТБанк/.test(un(chitat('tests/praktika/zsk-dolzhnika-sudebnyj-prikaz.html'))), 'в тексте автора — без названия банка');
});

// razbor12-zsk-v1.1 ([Ночные-3] 04.10 19:20): ответы [Право · 115-ФЗ] 19:10 разд. 1 (пп. 2–3) и [Продукт] 18:38 разд. 2.
test('v1.1: шаг 3 без обещания исхода, «Сколько на кону» — про округ и апелляцию, третья ссылка — статья о ЗСК контрагента', () => {
  const avt = un(chitat('tests/praktika/zsk-dolzhnika-sudebnyj-prikaz.html'));
  const s = chitat(STR);
  for (const t of [avt, un(s), chitat('praktika/faq.json')]) assert.ok(!/взыщет/i.test(t), 'нет «взыщет»');
  assert.ok(avt.includes('Проценты за задержку требуйте с банка, а не с должника — так Верховный суд решил в этом деле.'));
  assert.ok(avt.includes('Верховный суд отменил постановление округа в этой части и оставил в силе решение апелляции.'));
  const sos = s.slice(s.indexOf('<h2>Читайте также</h2>'), s.indexOf('</main>'));
  assert.ok(sos.length > 30, 'блок «Читайте также»');
  assert.strictEqual((sos.match(/class="pk"/g) || []).length, 3);
  assert.ok(sos.includes('href="/115-fz/proverit-kontragenta-zsk-po-inn/"'));
  assert.ok(un(sos).includes('ЗСК контрагента: как проверить поставщика по ИНН перед оплатой'), 'заголовок — из <h1> статьи');
});

test('statyi в dela.json: только статьи сайта вне /praktika/, страница существует; у остальных разборов — «Похожие разборы»', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  for (const r of D.razbory) {
    for (const u of r.statyi || []) {
      assert.ok(/^\/(?!praktika\/)[a-z0-9-]+\/([a-z0-9-]+\/)*$/.test(u), r.slug + ': ' + u);
      assert.ok(fs.existsSync(path.join(ROOT, u, 'index.html')), r.slug + ': нет ' + u);
    }
    const h = chitat(`praktika/${r.razdel}/${r.slug}/index.html`);
    assert.ok(h.includes(r.statyi ? '<h2>Читайте также</h2>' : '<h2>Похожие разборы</h2>'), r.slug);
  }
});
