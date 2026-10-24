// robots-otchety-v1 (24.10.2026): адреса личной проверки — отчёт (/?inn=…, /otchet/…, /report.html),
// Паспорт контрагента (/pasport/kontragent/?inn=…|?id=…) и сравнение (/sravnit/?a=…&b=…) — закрыты для роботов.
// Зачем: на карточках /company/ больше тысячи ссылок «Проверить» и «Паспорт» ведут на такие адреса; страница по ним сама
// запускает проверку в API. Робот, который исполняет JS, тратил бы проверки и видел ФИО руководителя в отчёте
// (условие 3 [Право] 23.10: страница отчёта с ФИО — не для поиска). Поиску остаются карточки, статьи и разборы.
// Сопоставление — по правилам Яндекса и Google: «*» — любые знаки, «$» — конец, побеждает самое длинное правило,
// при равной длине — Allow.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const robots = fs.readFileSync(path.join(KOREN, 'robots.txt'), 'utf8');

function pravilaDlyaVseh(t) {
  const out = [];
  let nash = false;
  for (const s0 of t.split('\n')) {
    const s = s0.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(s);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { nash = v === '*'; continue; }
    if (nash && (k === 'allow' || k === 'disallow') && v) out.push({ allow: k === 'allow', put: v });
  }
  return out;
}
function regexp(put) {
  const konec = put.endsWith('$');
  const telo = (konec ? put.slice(0, -1) : put).split('*').map(x => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + telo + (konec ? '$' : ''));
}
const PRAVILA = pravilaDlyaVseh(robots).map(p => ({ ...p, re: regexp(p.put) }));
function mozhno(url) {
  let luchshee = null;
  for (const p of PRAVILA) {
    if (!p.re.test(url)) continue;
    if (!luchshee || p.put.length > luchshee.put.length || (p.put.length === luchshee.put.length && p.allow)) luchshee = p;
  }
  return !luchshee || luchshee.allow;
}

test('robots.txt: личные адреса проверки закрыты для роботов', () => {
  for (const u of ['/?inn=7707083893', '/?utm_source=vk&inn=7707083893', '/otchet/7707083893/', '/report.html', '/report.html?id=abc',
    '/report.html?inn=7707083893', '/pasport/kontragent/?inn=7707083893', '/pasport/kontragent/?id=abc', '/pasport/?inn=7707083893',
    '/sravnit/?a=7707083893&b=7736050003'])
    assert.ok(!mozhno(u), u + ' открыт для роботов');
});

test('robots.txt: страницы для поиска открыты — главная, лендинги, карточки, статьи', () => {
  for (const u of ['/', '/sravnit/', '/pasport/', '/tarify/', '/company/', '/praktika/', '/115-fz/', '/nalogi/', '/?utm_source=vk', '/obnovleniya/'])
    assert.ok(mozhno(u), u + ' закрыт для роботов');
});

test('robots.txt: каждый адрес из sitemap открыт для роботов', () => {
  let n = 0;
  for (const f of fs.readdirSync(KOREN).filter(f => /^sitemap.*\.xml$/.test(f)))
    for (const m of fs.readFileSync(path.join(KOREN, f), 'utf8').matchAll(/<loc>https:\/\/deloskop\.ru(\/[^<]*)<\/loc>/g)) {
      n++;
      assert.ok(mozhno(m[1]), m[1] + ' из ' + f + ' закрыт в robots.txt');
    }
  assert.ok(n > 100, 'в sitemap меньше 100 адресов — сломан сам тест');
});

test('robots.txt: ссылки «Проверить» и «Паспорт» с карточек и статей роботом не открываются', () => {
  const vstrecheno = new Set();
  const obhod = d => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'fonts', 'tests', 'сайт'].includes(f.name)) continue;
      const p = path.join(d, f.name);
      if (f.isDirectory()) obhod(p);
      else if (f.name.endsWith('.html'))
        for (const m of fs.readFileSync(p, 'utf8').matchAll(/href="(\/[^"#]*[?&]inn=\d{10,12}[^"#]*)"/g)) vstrecheno.add(m[1].replace(/&amp;/g, '&'));
    }
  };
  obhod(KOREN);
  assert.ok(vstrecheno.size > 50, 'обход нашёл меньше 50 ссылок по ИНН — сломан сам тест');
  for (const u of vstrecheno) assert.ok(!mozhno(u), u + ' открыт для роботов');
});
