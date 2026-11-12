// fokus-shapka-v1 (12.11.2026, решение владельца 11.11 ~21:42; claude/Стратег_что_убрать_12.11.md):
// шапка — 5 мест, всё прежнее меню — в подвале. Страницы не удаляются: каждый адрес прежней шапки стоит в подвале
// каждой страницы и существует в репозитории (сервер отдаёт 200 — проверка с живого в Chromium, КАК_ВЫЛОЖИТЬ).
// Запуск: node --test tests/*.test.*
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const KOREN = path.join(__dirname, '..');
const chitat = f => fs.readFileSync(path.join(KOREN, f), 'utf8');

// все адреса шапки до fokus-shapka-v1 (main b9e154ca: «Проверка», «Сделка ▾», «Банк и 115-ФЗ ▾», «Знания ▾», «Тарифы», «Войти»)
const PREZHNIE = ['/', '/proverit-schet/', '/kontragenty-iz-vypiski/', '/pasport/kontragent/', '/delopis/',
  '/skoraya-115-fz/', '/kak-vidit-bank/', '/nalichnye/', '/pasport/', '/115-fz/',
  '/praktika/', '/nalogi/', '/zhurnal/', '/indeks/', '/tochnost/', '/kak-rabotaet/', '/obnovleniya/', '/tarify/', '/cabinet.html'];
const podval = t => (t.match(/<!--podval-->([\s\S]*?)<!--\/podval-->/) || [, ''])[1];

test('каждый прежний адрес шапки — в подвале и существует', () => {
  for (const f of ['index.html', 'report.html', 'praktika/index.html', 'tarify/index.html', 'proverit-schet/index.html']) {
    const hrefs = new Set([...podval(chitat(f)).matchAll(/href="([^"]+)"/g)].map(m => m[1]));
    for (const h of PREZHNIE) assert.ok(hrefs.has(h), f + ': в подвале нет ' + h);
  }
  for (const h of PREZHNIE) {
    const fajl = h === '/' ? 'index.html' : h.endsWith('/') ? h.slice(1) + 'index.html' : h.slice(1);
    assert.ok(fs.existsSync(path.join(KOREN, fajl)), 'страницы нет: ' + h);
  }
});

test('подвал: 4 колонки по задачам и строка документов, «Всё, что умеет» — в подвале', () => {
  const pv = podval(chitat('index.html'));
  const kol = [...pv.matchAll(/<summary class="podval__h">([^<]+)<\/summary>/g)].map(m => m[1]);
  assert.deepStrictEqual(kol, ['Перед оплатой', 'Если банк спросил', 'Знания', 'Компания']);
  const doki = pv.slice(pv.indexOf('<nav class="podval__doki"'), pv.indexOf('<div class="podval__niz">'));
  for (const h of ['/oferta/', '/politika/', '/soglasie/', '/rassylki/', '/cookies/', '/vozvrat/', '/partneram/usloviya/'])
    assert.ok(doki.includes('href="' + h + '"'), 'в строке документов нет ' + h);
  assert.ok(pv.includes('href="/vse-vozmozhnosti/"'));
  const css = chitat('css/podval.css');
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(css.split('\n').filter(s => s.includes('podval__doki')).join('\n')), 'HEX в строке документов');
});

test('шапка одна и та же в оболочке карточек API (partials/obolochka.json)', () => {
  const ob = JSON.parse(chitat('partials/obolochka.json'));
  const s = JSON.stringify(ob);
  assert.ok(!s.includes('shapka__dd'), 'в оболочке осталась старая шапка — запустите tests/sobrat_shapku.py');
  assert.ok(s.includes('podval__doki'), 'в оболочке старый подвал');
});
