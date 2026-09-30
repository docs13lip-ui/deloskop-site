// «Проверьте сами» (Ночные 30.09 15:05): у каждой группы Паспорта со сведениями первоисточника,
// которую мы не проверили, есть ≥ 1 ссылка на этот первоисточник. Красная группа ЗСК — только самопроверкой
// (на сайте Банка России капча, API нет — автоматически не опрашиваем).
// node --test tests/pasport_sam.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const ZSK = 'https://cbr.ru/counteraction_m_ter/platform_zsk/proverka-po-inn/';
const pustoj = { checked_at: '2026-09-30T15:10:00+03:00', company: { inn: '7707083893', kind: 'LEGAL' }, signals: [] };

test('каждая непроверенная группа первоисточника — со ссылкой «проверьте сами» (https, без наших адресов)', () => {
  [pustoj, Object.assign({}, pustoj, { company: Object.assign({}, pustoj.company, { status: 'ACTIVE', name_short: 'ООО «Пример»' }) })].forEach((r) => {
    const p = P.sobrat(r, { persons: false });
    const ne = p.razdely.filter((x) => x.vid === 'istochnik' && x.status === 'not_checked');
    assert.ok(ne.length >= 8, 'в пустом ответе должно быть много «не проверяли»');
    ne.forEach((x) => {
      assert.ok(x.sam && x.sam.length, x.n + '. ' + x.title + ' — без ссылки на первоисточник');
      x.sam.forEach((a) => { assert.match(a.url, /^https:\/\//); assert.ok(!/deloskop/.test(a.url)); assert.ok(a.tekst); });
    });
    const nomera = new Set(ne.map((x) => String(x.n)));
    assert.deepStrictEqual(P.proverit(p).filter((o) => nomera.has(o.split(':')[0])), []);
  });
});

test('в описании разделов первоисточника ссылка есть заранее — не только после сборки', () => {
  P.RAZDELY.filter((d) => d.vid === 'istochnik').forEach((d) => assert.ok(d.sam && d.sam.length, d.n + '. ' + d.title));
});

test('стоп-листы: красная группа ЗСК и список Банка России — ссылками; причина честная, без обещаний', () => {
  const x = P.sobrat(pustoj).razdely.find((r) => r.id === 'stoplisty');
  const urls = x.sam.map((a) => a.url);
  assert.ok(urls.includes(ZSK));
  assert.ok(urls.includes('https://www.cbr.ru/inside/warning-list/'));
  assert.match(x.prichina, /^Не проверяли/);
  assert.match(x.prichina, /капч/);
  assert.match(x.prichina, /Жёлтую группу публично не узнать/);
  assert.ok(!P.SLOVAR_222.test(x.prichina));
});

test('сигнал списка Банка России ложится в «Стоп-листы», а не в реквизиты', () => {
  assert.strictEqual(P.razdelDlya('Список Банка России: признаки нелегальной деятельности'), 'stoplisty');
});

test('на сайте нет «официальную зону смотрите на сайте Банка России»: публично — только красная группа', () => {
  ['115-fz/zsk-zony-riska/index.html', 'index.html', 'pasport/index.html'].forEach((f) => {
    const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!/официальн\S* зон\S* (всегда )?(смотрите|можно узнать|на сайте)/i.test(t), f);
  });
  const zsk = fs.readFileSync(path.join(ROOT, '115-fz/zsk-zony-riska/index.html'), 'utf8');
  assert.ok(zsk.includes('href="' + ZSK + '"'), 'в статье о ЗСК нет прямой ссылки на сервис проверки по ИНН');
});
