// Запуск: node --test tests/is_v1.test.js
// is-v1 (12.10.2026): сайт не грузит скрипты с зарубежных CDN; знак охраны и LICENSE на месте.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const kor = path.join(__dirname, '..');

function vseFajly(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'vendor', 'tests'].includes(f.name)) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) vseFajly(p, out);
    else if (/\.(html|js|css)$/.test(f.name)) out.push(p);
  }
  return out;
}

test('нет скриптов и стилей с зарубежных CDN', () => {
  const zapret = /(src|href)=["']https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|ajax\.googleapis\.com)/;
  const plohie = vseFajly(kor).filter(f => zapret.test(fs.readFileSync(f, 'utf8')));
  assert.deepStrictEqual(plohie.map(f => path.relative(kor, f)), []);
});

test('pdf.js лежит у себя и не изменён', () => {
  const sha = {
    'pdf.min.js': '5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946',
    'pdf.worker.min.js': 'feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b',
  };
  for (const [f, h] of Object.entries(sha)) {
    const b = fs.readFileSync(path.join(kor, 'js/vendor/pdfjs', f));
    assert.strictEqual(crypto.createHash('sha256').update(b).digest('hex'), h, f);
  }
  assert.ok(fs.existsSync(path.join(kor, 'js/vendor/pdfjs/LICENSE')), 'лицензия Apache-2.0 рядом');
  const s = fs.readFileSync(path.join(kor, 'proverit-schet/index.html'), 'utf8');
  assert.ok(s.includes('src="/js/vendor/pdfjs/pdf.min.js"'));
  assert.ok(s.includes("workerSrc='/js/vendor/pdfjs/pdf.worker.min.js'"));
});

test('LICENSE: знак охраны, без ФИО и без адреса', () => {
  const s = fs.readFileSync(path.join(kor, 'LICENSE'), 'utf8');
  assert.match(s, /^© 2026 Делоскоп\. Все права защищены\./);
  assert.match(s, /ОГРНИП 326480000055311/);
  assert.ok(!/Косарев/.test(s), 'ФИО публично не выводим (решение 0щ)');
});
