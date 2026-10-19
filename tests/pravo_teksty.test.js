// [Ночные запуски] pravo-teksty-v1 (19.10.2026): тексты [Право] 19.10 10:50 — дословно
// (claude/Право_ответы_✎_п321_п333_и_вопросы_перед_оплатами_19.10.md, разд. 1).
// (а) /tarify/: «цены после беты» обещали цену, которую владелец не утверждал (п. 4 ч. 3 ст. 5 38-ФЗ) → «справочные»;
// FAQ /osnovatel/ — текст Ночных 17.10 без правок; /115-fz/ — определение и «не путать»;
// вкладки «Глазами банка / налоговой»: damia_fssp → только «Все факты», damia_priostanovki — в обеих, оговорка под вкладками.
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const K = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(K, f), 'utf8');
// видимый текст: без тегов, скриптов, шаблонов оплаты; все виды пробела и неразрывный дефис — как обычные
const tekst = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<template[\s\S]*?<\/template>/g, '')
  .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[  ]/g, ' ').replace(/‑/g, '-');

const POLOSA = 'Цены ниже — справочные, сейчас по ним ничего не продаём. О начале оплат и их условиях объявим здесь не позже чем за 3 дня.';
const OSN = 'Пока нет. Сейчас весь Делоскоп открыт бесплатно, счета не выставляем. Условия тарифа основателя объявим здесь не позже чем за 3 дня до начала оплат.';
const OPR = '115-ФЗ — Федеральный закон от 07.08.2001 № 115-ФЗ «О противодействии легализации (отмыванию) доходов, полученных преступным путём, и финансированию терроризма». По нему банки проверяют клиентов и операции, могут запросить документы и отказать в проведении операции.';
const NE = 'Не путать с Федеральным законом от 25.07.2002 № 115-ФЗ «О правовом положении иностранных граждан в Российской Федерации».';
const POD = 'Так мы группируем открытые сведения. Банк и налоговая нам не сообщают, как они оценивают компанию.';

test('(а) /tarify/, /osnovatel/, /skoraya-115-fz/: в бете цена не обещана «после беты»', () => {
  for (const f of ['tarify/index.html', 'osnovatel/index.html', 'skoraya-115-fz/index.html']) {
    const h = chitat(f);
    const beta = [...h.matchAll(/<!--v-bete-->([\s\S]*?)<!--\/v-bete-->/g)].map((m) => m[1]).join(' ');
    assert.ok(beta.length > 0, f + ': есть блок беты');
    assert.ok(!/после беты/.test(tekst(beta)), f + ': «после беты» в видимой половине беты');
    assert.ok(!/станут после беты|будет после беты/.test(h), f + ': и в JSON-LD');
  }
  const t = tekst(chitat('tarify/index.html'));
  assert.ok(t.includes(POLOSA), 'полоса над тарифами — текст [Право] дословно');
  assert.ok(t.includes('Цены на этой странице — справочные, сейчас по ним ничего не продаём.'), 'FAQ «Сколько стоит сейчас»');
  assert.ok(chitat('tests/sobrat_tarify.py').includes('Цена справочная'), 'источник — сборщик');
});

test('FAQ /osnovatel/ «Можно ли стать основателем сейчас?» — текст, принятый [Право], и в разметке, и в JSON-LD', () => {
  const h = chitat('osnovatel/index.html');
  const vid = h.match(/<summary>Можно ли стать основателем сейчас\?<\/summary><p>([\s\S]*?)<\/p>/);
  assert.ok(vid, 'вопрос виден');
  assert.strictEqual(tekst(vid[1]), OSN);
  const ld = h.match(/"name": "Можно ли стать основателем сейчас\?", "acceptedAnswer": \{"@type": "Answer", "text": "([^"]*)"/);
  assert.ok(ld, 'вопрос в FAQPage');
  assert.strictEqual(ld[1], OSN);
});

test('/115-fz/: определение первым абзацем, затем «не путать», затем вводный абзац', () => {
  const h = chitat('115-fz/index.html');
  const o = h.match(/<p class="opredelenie">([\s\S]*?)<\/p>/), n = h.match(/<p class="ne-putat">([\s\S]*?)<\/p>/);
  assert.ok(o && n);
  assert.strictEqual(tekst(o[1]), OPR);
  assert.strictEqual(tekst(n[1]), NE);
  const i = (s) => h.indexOf(s);
  assert.ok(i('<h1>') < i('class="opredelenie"') && i('class="opredelenie"') < i('class="ne-putat"') && i('class="ne-putat"') < i('class="vvod"'));
  assert.ok(/\.opredelenie\{/.test(h) && /\.ne-putat\{/.test(h), 'стили');
});

test('вкладки «Глазами банка / налоговой»: раскладка [Право] и оговорка под вкладками', () => {
  const js = chitat('js/vizual2.js');
  const bank = new RegExp(js.match(/bank: \/(.*)\/,/)[1]), nalog = new RegExp(js.match(/nalog: \/(.*)\/\n/)[1]);
  assert.ok(!nalog.test('damia_fssp') && !bank.test('damia_fssp'), 'ФССП — только во «Всех фактах»');
  assert.ok(nalog.test('damia_priostanovki') && bank.test('damia_priostanovki'), 'приостановки — в обеих');
  assert.ok(nalog.test('tax_debt') && !bank.test('tax_debt'));
  for (const k of ['sudy', 'mery', 'rnp']) assert.ok(!bank.test(k) && !nalog.test(k), k + ' — только «Все факты»');
  const gl = chitat('index.html');
  const pod = gl.match(/<div class="ex-vid" role="tablist"[^>]*data-pod="([^"]+)"/);
  assert.ok(pod, 'текст оговорки — в примере на главной');
  assert.strictEqual(pod[1], POD);
  assert.ok(/ex-zad__pod/.test(js) && /data-pod/.test(js) && /ZAG_POD/.test(js), 'скрипт ставит оговорку и в настоящий отчёт');
  assert.ok(/\.ex-zad__pod\{/.test(chitat('css/vizual2.css')));
  assert.ok(!/банк (заблокирует|откажет)/i.test(POD));
});
