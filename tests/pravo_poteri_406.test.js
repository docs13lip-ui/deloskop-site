// Разбор № 28 (потери по ст. 406.1 ГК): три ответа [Право] 26.10 — в тексте и в FAQPage.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const kor = path.join(__dirname, '..');
const slug = 'kompensaciya-poter-406-1-vs-2026';
const bez = s => s.replace(/&nbsp;| /g, ' ').replace(/‑/g, '-');
const html = bez(fs.readFileSync(path.join(kor, 'praktika/dogovory', slug, 'index.html'), 'utf8'));
const faq = JSON.parse(fs.readFileSync(path.join(kor, 'praktika/faq.json'), 'utf8')).razbory[slug];

test('потери 406.1: три новых вопроса в faq.json и в FAQPage страницы', () => {
  for (const v of ['Потери и неустойка — одно и то же?',
    'Может ли суд уменьшить сумму потерь по ст. 406.1 ГК?',
    'Можно ли договориться о возмещении потерь с гражданином?']) {
    assert.ok(faq.some(q => q.v === v), 'нет в faq.json: ' + v);
    assert.ok(html.includes('"name": "' + v + '"') || html.includes('"name":"' + v + '"'), 'нет в FAQPage: ' + v);
  }
});

test('потери 406.1: исключение п. 5 и «по общему правилу» — не теряются', () => {
  assert.ok(html.includes('(п. 5 ст. 406.1 ГК)'));
  assert.ok(html.includes('По общему правилу суд не может уменьшить сумму потерь'));
  assert.ok(!/суд не может уменьшить[^.]{0,40}никогда/.test(html), 'абсолютная формулировка');
});
