// zsk-vzyskatel-v1 (п. 413 Очереди): в отчёте под прогнозом ЗСК — строка взыскателю и ссылка на разбор ВС № 305‑ЭС25‑1505.
// Только при высоком и среднем прогнозе; фраза — из лида опубликованного разбора; исход не обещаем.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const kor = path.join(__dirname, '..');
const rep = fs.readFileSync(path.join(kor, 'report.html'), 'utf8');
const URL = '/praktika/115-fz/zsk-dolzhnika-sudebnyj-prikaz/';

test('строка взыскателю — в блоке ЗСК отчёта, только при high/medium, ссылка на живой разбор', () => {
  const i = rep.indexOf('function zskHtml(z)');
  assert.ok(i > 0, 'zskHtml в report.html');
  const blok = rep.slice(i, rep.indexOf('function indeksHtml', i));
  assert.match(blok, /z\.level==='high'\|\|z\.level==='medium'\?'<p class="zvz noprint">/);
  assert.ok(blok.includes('href="' + URL + '"'), 'ссылка на разбор');
  assert.ok(blok.includes('data-goal="zsk_vzyskatel"'), 'цель Метрики');
  assert.ok(fs.existsSync(path.join(kor, URL, 'index.html')), 'страница разбора есть');
});

test('фраза — из лида разбора, без обещания исхода', () => {
  const dela = fs.readFileSync(path.join(kor, 'praktika', 'dela.json'), 'utf8');
  assert.ok(dela.includes('отнесение должника к высокому риску само по себе не основание отказать взыскателю'), 'лид разбора не менялся');
  const p = rep.match(/<p class="zvz noprint">(.*?)<\/p>/)[1].replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '');
  assert.ok(p.includes('Отнесение должника к высокому риску само по себе не основание отказать взыскателю'));
  assert.doesNotMatch(p, /гарантир|обязательно|точно|всегда|вернёте|взыщете/i);
  assert.match(p, /№ 305‑ЭС25‑1505/, 'номер дела — с неразрывным дефисом');
});
