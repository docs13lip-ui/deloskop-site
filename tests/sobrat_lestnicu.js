#!/usr/bin/env node
// Сборщик статьи «Какие документы запросить у контрагента — по сумме сделки» (Ночные 01.10 15:05, п. 181).
// Таблица ступеней и признаки «ступенью выше» в статье берутся из js/lestnica.js — того же файла, что считает
// лестницу в Паспорте контрагента. Один источник правды: правят лестницу — запускают сборщик, руками блоки не трогают.
// Запуск:  node tests/sobrat_lestnicu.js          — пересобрать блоки в статье
//          node tests/sobrat_lestnicu.js --check  — только проверить (держит tests/lestnica_statya.test.js)
'use strict';
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const STATYA = path.join(KOREN, 'nalogi/dokumenty-kontragenta-po-summe-sdelki/index.html');
const L = require(path.join(KOREN, 'js/lestnica.js'));

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// типографика: неразрывный пробел в «100 000 ₽», «1 млн ₽», «5 %»
const tip = t => esc(t).replace(/(\d) (?=\d{3}\b)/g, '$1&nbsp;').replace(/(\d) (₽|%|млн|млрд|тыс)/g, '$1&nbsp;$2').replace(/ (₽)/g, '&nbsp;$1');

function gde(g) {
  if (!g.length) return '';
  return ' <span class="gde">' + g.map(([t, u]) => /^https?:/.test(u)
    ? `<a href="${esc(u)}" rel="noopener" target="_blank">${esc(t)}</a>`
    : `<a href="${esc(u)}">${esc(t)}</a>`).join(' · ') + '</span>';
}

function tablica() {
  const ryady = L.STUPENI.filter(Boolean).map(s =>
    `<tr><td><b class="st">${s.n}</b></td><td><strong>${tip(s.nazvanie)}</strong><br><span class="kogda">${tip(s.kogda)}</span></td>` +
    `<td><ul>${s.sdelat.map(x => `<li>${tip(x.t)}${gde(x.gde)}</li>`).join('')}</ul></td></tr>`).join('\n');
  return '<div class="tw"><table class="lst">\n<thead><tr><th>Ступень</th><th>Когда</th><th>Что сделать и что запросить — в добавление к ступеням ниже</th></tr></thead>\n<tbody>\n' + ryady + '\n</tbody>\n</table></div>';
}

function priznaki() {
  return '<ul class="pr">' + L.PRIZNAKI.map(p => `<li>${tip(p[1])}</li>`).join('') + '</ul>';
}

function galochki() {
  return L.PRIZNAKI.map(p => `<label class="ls-g"><input type="checkbox" name="pr" value="${esc(p[0])}"> ${tip(p[1])}</label>`).join('');
}

const BLOKI = { 'lestnica-tablica': tablica, 'lestnica-galochki': galochki, 'lestnica-priznaki': priznaki,
  'lestnica-ogovorka': () => `<p class="og">${tip(L.OGOVORKA)}</p>`,
  'lestnica-nalichnye': () => `<p class="nal">${tip(L.NALICHNYE)}</p>` };

function sobrat(html) {
  for (const [k, f] of Object.entries(BLOKI)) {
    const re = new RegExp(`<!--${k}-->[\\s\\S]*?<!--/${k}-->`);
    if (!re.test(html)) throw new Error('нет меток <!--' + k + '--> в статье');
    html = html.replace(re, () => `<!--${k}-->${f()}<!--/${k}-->`);
  }
  return html;
}

module.exports = { sobrat, STATYA };

if (require.main === module) {
  const bylo = fs.readFileSync(STATYA, 'utf8');
  const stalo = sobrat(bylo);
  if (process.argv.includes('--check')) {
    if (bylo !== stalo) { console.error('Статья не совпадает с js/lestnica.js — запустите: node tests/sobrat_lestnicu.js'); process.exit(1); }
    console.log('Статья совпадает с js/lestnica.js');
  } else {
    fs.writeFileSync(STATYA, stalo);
    console.log(bylo === stalo ? 'Без изменений' : 'Блоки лестницы пересобраны');
  }
}
