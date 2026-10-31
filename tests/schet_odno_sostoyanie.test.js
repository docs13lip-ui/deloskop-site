// schet-beta-v1 ([Ночные запуски] 31.10.2026, п. 428 Очереди, claude/Экосистема_одно_состояние_оплаты_31.10.md):
// пока в tarify.json "beta": true, ни одна страница не обещает счёт тому, кто её видит: ни посетителю без JavaScript
// (<noscript>), ни превью ссылки (<meta name="description">). Половина «оплата» лежит в <template> (tests/beta.py).
// Запуск: node --test tests/schet_odno_sostoyanie.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const BETA = JSON.parse(fs.readFileSync(path.join(K, 'tarify', 'tarify.json'), 'utf8')).beta === true;
const vidno = (s) => s.replace(/<template\b[\s\S]*?<\/template>/g, ' ').replace(/&nbsp;/g, ' ');
const OBESHCHANIE = /пришл[её]м сч[её]т|сч[её]т с реквизитами будет готов|не позднее следующего рабочего дня после зачисления/i;

function stranicy(dir, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name.startsWith('.') || ['node_modules', 'company', 'tests'].includes(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) stranicy(p, out);
    else if (f.name.endsWith('.html') && f.name !== 'admin.html') out.push(p);
  }
  return out;
}

test('в бете /schet/: описание и <noscript> — без обещания счёта', { skip: !BETA && 'оплаты открыты' }, () => {
  const S = fs.readFileSync(path.join(K, 'schet', 'index.html'), 'utf8');
  const V = vidno(S.replace(/<script[\s\S]*?<\/script>/g, ' '));
  const d = V.match(/<meta name="description" content="([^"]+)"/);
  assert.ok(d, 'у /schet/ видно одно описание');
  assert.strictEqual((V.match(/<meta name="description"/g) || []).length, 1);
  assert.ok(/счета не выставляем/.test(d[1]) && d[1].length <= 160, d[1]);
  const ns = V.match(/<noscript>([\s\S]*?)<\/noscript>/g) || [];
  assert.ok(ns.length >= 1, 'посетитель без JS видит текст беты');
  for (const n of ns) assert.ok(!OBESHCHANIE.test(n), n);
});

test('в бете ни одна страница сайта не обещает счёт в видимом тексте (кроме оферты)', { skip: !BETA && 'оплаты открыты' }, () => {
  const plohie = [];
  for (const p of stranicy(K, [])) {
    const rel = path.relative(K, p);
    if (rel.startsWith('oferta')) continue; // условия договора — документ, не обещание
    const V = vidno(fs.readFileSync(p, 'utf8').replace(/<script[\s\S]*?<\/script>/g, ' '));
    const m = V.match(OBESHCHANIE);
    if (m) plohie.push(rel + ': «' + m[0] + '»');
  }
  assert.deepStrictEqual(plohie, []);
});
