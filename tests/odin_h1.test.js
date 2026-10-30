// Сторож: на странице один заголовок первого уровня. Если h1 уже стоит в разметке,
// скрипты страницы не дорисовывают второй (так было на /pasport/: «Паспорт компании» + имя компании).
// Служебные страницы с noindex (кабинет, админка, отчёт) не в счёт: у них h1 — на сменяющих друг друга экранах.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const MIMO = /^(tests|node_modules|company|partials|\.git)(\/|$)/;
function obhod(dir, out) {
  for (const f of fs.readdirSync(path.join(KOREN, dir), { withFileTypes: true })) {
    const rel = dir ? dir + '/' + f.name : f.name;
    if (MIMO.test(rel)) continue;
    if (f.isDirectory()) obhod(rel, out);
    else if (f.name.endsWith('.html')) out.push(rel);
  }
  return out;
}
test('один h1: скрипты не добавляют второй к h1 из разметки', () => {
  const plohie = [];
  let s4et = 0;
  for (const rel of obhod('', [])) {
    const html = fs.readFileSync(path.join(KOREN, rel), 'utf8');
    if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) continue;
    const skripty = (html.match(/<script\b[\s\S]*?<\/script>/gi) || []).join('\n');
    const razmetka = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    const st = (razmetka.match(/<h1[\s>]/gi) || []).length;
    const dyn = (skripty.match(/<h1[\s>]/gi) || []).length;
    if (st) s4et++;
    if (st > 1 || (st === 1 && dyn > 0)) plohie.push(rel + ' (в разметке ' + st + ', в скриптах ' + dyn + ')');
  }
  assert.ok(s4et > 50, 'страниц с h1 подозрительно мало: ' + s4et);
  assert.deepStrictEqual(plohie, []);
});
