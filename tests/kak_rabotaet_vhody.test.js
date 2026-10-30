// kak-rabotaet-vhody-v1 (26.10.2026, [Ночные запуски]): страница продукта ведёт к своему показу на /kak-rabotaet/,
// а показ — обратно на эту же страницу («Проверить свою …»). Круг замкнут: переименуют якорь показа или
// поменяют кнопку показа — ссылка не уйдёт в пустоту и не приведёт к чужому продукту.
// Запуск: node --test tests/kak_rabotaet_vhody.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');

// страница продукта → якорь показа
const KRUG = [
  ['kontragenty-iz-vypiski/index.html', 'platite', '/kontragenty-iz-vypiski/'],
  ['nalichnye/index.html', 'nalichnye', '/nalichnye/'],
  ['proverit-schet/index.html', 'schet', '/proverit-schet/'],
  ['skoraya-115-fz/index.html', 'skoraya', '/skoraya-115-fz/'],
];
const KR = chitat('kak-rabotaet/index.html');

function pokaz(id) {
  const i = KR.indexOf('id="' + id + '"');
  if (i < 0) return null;
  const j = KR.indexOf('</section>', i);
  return KR.slice(i, j);
}

for (const [fajl, yakor, adres] of KRUG) {
  test(fajl + ' ↔ /kak-rabotaet/#' + yakor, () => {
    const s = chitat(fajl);
    const ssylki = [...s.matchAll(/href="\/kak-rabotaet\/#([a-z]+)"/g)].map((m) => m[1]);
    assert.deepStrictEqual(ssylki, [yakor], fajl + ': ровно одна ссылка на свой показ #' + yakor);
    // карточка стоит в блоке ссылок внизу и называет себя «Как это работает»
    const m = s.match(/<a class="card" href="\/kak-rabotaet\/#[a-z]+"><small>([^<]+)<\/small><b>([^<]+)<\/b><span>([^<]+)<\/span><\/a>/);
    assert.ok(m, fajl + ': карточка показа в формате блока ссылок');
    assert.ok(m[2].startsWith('Как это работает: '), fajl + ': заголовок карточки');
    assert.ok(/<section class="more[^"]*">[\s\S]*href="\/kak-rabotaet\/#/.test(s), fajl + ': карточка — внутри section.more');
    const p = pokaz(yakor);
    assert.ok(p, '/kak-rabotaet/: нет показа #' + yakor);
    assert.ok(p.includes('href="' + adres + '"'), '/kak-rabotaet/#' + yakor + ': кнопка показа ведёт не на ' + adres);
    // «Показ · 4 шага» — столько шагов в показе
    const shagi = (m[1].match(/(\d+)/) || [])[1];
    const ol = (p.match(/<ol class="kr-sh">([\s\S]*?)<\/ol>/) || [])[1] || '';
    const vPokaze = (ol.match(/<li>/g) || []).length;
    assert.ok(vPokaze > 0, '/kak-rabotaet/#' + yakor + ': не нашёл шаги показа (ol.kr-sh)');
    assert.strictEqual(Number(shagi), vPokaze, fajl + ': число шагов в карточке ≠ показу');
  });
}
