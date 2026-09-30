// «Отметка самопроверки» (Ночные 30.09 17:05): заказчик сам открыл первоисточник и отмечает результат.
// Отметка — слово пользователя: статус раздела не меняется, в отпечаток SHA-256 не входит, в тексте —
// «Проверено вами …» и оговорка «Делоскоп её не проверял»; никогда «подтверждено». Хранилищ браузера и сети нет.
// node --test tests/pasport_otmetka.test.js
'use strict';
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'js', 'pasport-kontragenta.js'));
const pustoj = { checked_at: '2026-09-30T15:10:00+03:00', company: { inn: '7707083893', kind: 'LEGAL', status: 'ACTIVE', name_short: 'ООО «Пример»' }, signals: [] };
const SEG = new Date(2026, 8, 30, 17, 5);
const stop = () => P.sobrat(pustoj).razdely.find((r) => r.id === 'stoplisty');

test('отметка: «Проверено вами» с датой и местом, оговорка пользователя; ни слова «подтвержден»', () => {
  const x = stop();
  ['net', 'est', 'ne_udalos'].forEach((rez) => {
    const o = P.otmetka(x, { rez, ist: 0, data: '30.09.2026', vremya: '10:00' }, SEG);
    assert.ok(o.ok, rez);
    assert.match(o.tekst, /^Проверено вами 30\.09\.2026 в 10:00 МСК — /);
    assert.ok(o.tekst.includes(x.sam[0].tekst));
    assert.strictEqual(o.ogovorka, 'Отметка поставлена пользователем, Делоскоп её не проверял.');
    const vse = o.tekst + ' ' + o.sovet + ' ' + o.ogovorka;
    assert.ok(!/подтвержд/i.test(vse), vse);
    assert.ok(!P.SLOVAR_222.test(vse), vse);
    assert.ok(!/(^|\s)(чисто|рисков\s+нет|долгов\s+нет)/i.test(vse), vse);
  });
  assert.match(P.otmetka(x, { rez: 'est', ist: 0, data: '30.09.2026', vremya: '10:00' }, SEG).sovet, /снимок экрана/);
  assert.match(P.otmetka(x, { rez: 'est', ist: 0, data: '30.09.2026', vremya: '10:00' }, SEG).sovet, /объяснение и документы/);
  assert.match(P.otmetka(x, { rez: 'ne_udalos', ist: 0, data: '30.09.2026', vremya: '10:00' }, SEG).sovet, /непроверенным/);
});

test('отметка не меняет Паспорт: статус раздела «не проверяли», отпечаток тот же', async () => {
  const p = P.sobrat(pustoj);
  const h1 = await P.vypustit(p);
  const do_ = JSON.stringify(p);
  const x = p.razdely.find((r) => r.id === 'stoplisty');
  P.otmetka(x, { rez: 'net', ist: 1, data: '29.09.2026', vremya: '10:00' }, SEG);
  assert.strictEqual(JSON.stringify(p), do_);
  assert.strictEqual(x.status, 'not_checked');
  assert.strictEqual(await P.vypustit(p), h1);
});

test('ошибки ввода: без результата, дата в будущем, неверная дата, чужой раздел, несуществующая ссылка', () => {
  const x = stop();
  assert.strictEqual(P.otmetka(x, { data: '30.09.2026', vremya: '10:00' }, SEG).ok, false);
  assert.match(P.otmetka(x, { rez: 'net', data: '01.10.2026', vremya: '10:00' }, SEG).oshibka, /не позже сегодняшней/);
  assert.match(P.otmetka(x, { rez: 'net', data: '31.09.2026', vremya: '10:00' }, SEG).oshibka, /ДД\.ММ\.ГГГГ/);
  assert.match(P.otmetka(x, { rez: 'net', data: '2026-09-30' }, SEG).oshibka, /ДД\.ММ\.ГГГГ/);
  assert.match(P.otmetka(x, { rez: 'net', ist: 9, data: '30.09.2026', vremya: '10:00' }, SEG).oshibka, /где проверяли/);
  const polucheno = Object.assign({}, x, { status: 'found' });
  assert.strictEqual(P.otmetka(polucheno, { rez: 'net', data: '30.09.2026', vremya: '10:00' }, SEG).ok, false);
});

test('давняя проверка (> 30 дней) — просим перепроверить перед оплатой', () => {
  // papka-v1.1: у ЗСК (ist 0) свой срок свежести — день (tests/papka.test.js); правило 30 дней проверяем на списке нелегальных ЦБ (ist 1).
  const o = P.otmetka(stop(), { rez: 'net', ist: 1, data: '15.08.2026', vremya: '10:00' }, SEG);
  assert.ok(o.ok);
  assert.ok(o.dnej > P.OTM_SVEZHEST_DNEJ);
  assert.match(o.sovet, /перепроверьте/);
  assert.ok(!/перепроверьте/.test(P.otmetka(stop(), { rez: 'net', ist: 1, data: '30.09.2026', vremya: '10:00' }, SEG).sovet));
});

test('сводка для «Решения о сделке» — по номеру раздела, с оговоркой; пусто — пустая строка', () => {
  const p = P.sobrat(pustoj);
  const a = P.otmetka(p.razdely.find((r) => r.id === 'stoplisty'), { rez: 'net', data: '30.09.2026', vremya: '10:00' }, SEG);
  const ne = p.razdely.filter((r) => r.status === 'not_checked' && r.sam && r.sam.length && r.id !== 'stoplisty')[0];
  const b = P.otmetka(ne, { rez: 'ne_udalos', data: '29.09.2026', vremya: '10:00' }, SEG);
  const t = P.otmetkiSvodka([a, b, { ok: false }]);
  assert.match(t, /\(30\.09\.2026 в 10:00 МСК\)/);
  const nomera = (t.match(/раздел (\d+)/g) || []).map((m) => +m.split(' ')[1]);
  assert.deepStrictEqual(nomera, [ne.n, a.razdel].sort((x, y) => x - y), t);
  assert.match(t, /^Самопроверка заказчика: /);
  assert.ok(t.endsWith(P.OTM_OGOVORKA));
  assert.strictEqual(P.otmetkiSvodka([]), '');
});

test('страница: отметка только в памяти вкладки — без fetch в обработчике и без хранилищ; форма не печатается', () => {
  const t = fs.readFileSync(path.join(ROOT, 'pasport/kontragent/index.html'), 'utf8');
  const kod = t.slice(t.indexOf('var OTM={}'), t.indexOf('function razdelHtml'));
  assert.ok(kod.length > 500, 'блок отметки не найден');
  assert.ok(!/localStorage|sessionStorage|indexedDB|fetch\(|sendBeacon|XMLHttpRequest/.test(kod));
  assert.match(kod, /class="otm-f noprint"/);
  assert.match(kod, /class="otm-l /);
  assert.ok(!/class="otm-l[^"]*noprint/.test(kod), 'строка «Проверено вами» должна попадать в PDF');
  assert.match(t, /P\.otmetkiSvodka/);
});

// ── otmetka-v2 (Ночные 30.09 19:05): время, адрес, кто проверял, приложение, выписка с ЭП ──────────────
const egrulRazdel = () => P.sobrat(pustoj).razdely.find((r) => r.status === 'not_checked' && (r.sam || []).some((a) => /egrul\.nalog\.ru/.test(a.url)));

test('v2: время обязательно и не в будущем; дата-время в тексте, пояс из браузера', () => {
  const x = stop();
  assert.match(P.otmetka(x, { rez: 'net', data: '30.09.2026' }, SEG).oshibka, /ЧЧ:ММ/);
  assert.match(P.otmetka(x, { rez: 'net', data: '30.09.2026', vremya: '25:00' }, SEG).oshibka, /ЧЧ:ММ/);
  assert.match(P.otmetka(x, { rez: 'net', data: '30.09.2026', vremya: '17:06' }, SEG).oshibka, /не позже текущего/);
  assert.ok(P.otmetka(x, { rez: 'net', data: '30.09.2026', vremya: '17:05' }, SEG).ok);
  assert.ok(P.otmetka(x, { rez: 'net', data: '29.09.2026', vremya: '23:59' }, SEG).ok, 'вчера поздно — можно');
  const o = P.otmetka(x, { rez: 'net', data: '30.09.2026', vremya: '9:07', tz: 'UTC+5' }, SEG);
  assert.strictEqual(o.vremya, '09:07');
  assert.match(o.tekst, /30\.09\.2026 в 09:07 UTC\+5/);
});

test('v2: полный адрес страницы — https и тот же сайт, что у ссылки раздела; по умолчанию — ссылка раздела', () => {
  const x = stop(), u = x.sam[0].url, host = u.split('/')[2];
  const o = P.otmetka(x, { rez: 'net', data: '30.09.2026', vremya: '10:00' }, SEG);
  assert.strictEqual(o.adres, u);
  assert.ok(o.stroki.includes('Адрес страницы: ' + u));
  const glub = 'https://' + host + '/some/page?inn=7707083893';
  assert.strictEqual(P.otmetka(x, { rez: 'net', data: '30.09.2026', vremya: '10:00', adres: glub }, SEG).adres, glub);
  ['http://' + host + '/', 'https://evil.example/' + host, 'https://' + host + '.evil.ru/', 'javascript:alert(1)', 'ftp://' + host].forEach((a) =>
    assert.match(P.otmetka(x, { rez: 'net', data: '30.09.2026', vremya: '10:00', adres: a }, SEG).oshibka || '', /https и тот же сайт/, a));
  assert.ok(P.tuZheSajt('https://www.cbr.ru/x', 'https://cbr.ru/'));
  assert.ok(!P.tuZheSajt('https://notcbr.ru/x', 'https://cbr.ru/'));
});

test('v2: кто проверял (должность, без ФИО) и номер приложения — в строках PDF; номер только число', () => {
  const x = stop();
  const o = P.otmetka(x, { rez: 'est', data: '30.09.2026', vremya: '10:00', dolzhnost: 'Бухгалтер', fio: 'Иванова И. И.', pril: '№ 2' }, SEG);
  assert.strictEqual(o.dolzhnost, 'Бухгалтер');
  assert.ok(!JSON.stringify(o).includes('Иванова'), 'ФИО не берём даже если передали');
  assert.ok(o.stroki.includes('Снимок экрана — приложение № 2.'));
  assert.ok(!/Сохраните снимок/.test(o.sovet), 'снимок уже приложен — не просим снова');
  assert.match(P.otmetka(x, { rez: 'net', data: '30.09.2026', vremya: '10:00', pril: 'два' }, SEG).oshibka, /число/);
  assert.match(P.otmetkiSvodka([o]), /снимок — прил\. № 2/);
});

test('v2: выписка ФНС с ЭП — только у ЕГРЮЛ; у ЕГРЮЛ без неё — подсказка про выписку', () => {
  const e = egrulRazdel();
  assert.ok(e, 'нет раздела со ссылкой на egrul.nalog.ru');
  const i = e.sam.findIndex((a) => /egrul\.nalog\.ru/.test(a.url));
  const s = P.otmetka(e, { rez: 'net', ist: i, data: '30.09.2026', vremya: '10:00', ep: true, pril: '1' }, SEG);
  assert.ok(s.ep);
  assert.ok(s.stroki.some((t) => /выписка ЕГРЮЛ в PDF с электронной подписью ФНС — приложение № 1/.test(t)));
  assert.match(P.otmetkiSvodka([s]), /выписка с ЭП — прил\. № 1/);
  assert.ok(P.otmetka(e, { rez: 'net', ist: i, data: '30.09.2026', vremya: '10:00' }, SEG).sovet.includes(P.OTM_EP));
  const ch = P.otmetka(stop(), { rez: 'net', data: '30.09.2026', vremya: '10:00', ep: true }, SEG);
  assert.strictEqual(ch.ep, false, 'ЭП ФНС у чужого сайта не ставим');
});

test('v2: ни одного обещания исхода — «суд примет», «гарантия», «доказано»; подсказка о снимке с оговоркой «оценивает суд»', () => {
  const x = stop(), e = egrulRazdel();
  const vse = [P.OTM_SNIMOK, P.OTM_EP, P.OTM_OGOVORKA];
  ['net', 'est', 'ne_udalos'].forEach((rez) => [x, e].forEach((r) => {
    const o = P.otmetka(r, { rez, data: '15.08.2026', vremya: '10:00', pril: '3' }, SEG);
    vse.push(o.tekst, o.sovet, o.stroki.join(' '), P.otmetkiSvodka([o]));
  }));
  const t = vse.join(' ');
  assert.ok(!/суд прим|налогов\S* прим|гарант|доказан|подтвержд|безопасн/i.test(t), t);
  assert.ok(!P.SLOVAR_222.test(t));
  assert.match(P.OTM_SNIMOK, /оценивает его суд/);
  assert.match(P.OTM_SNIMOK, /адрес страницы, ИНН, результат, дата и время/);
});

test('v2: страница — ФИО не спрашиваем, должность только во вкладке; в печати место для подписи у отметки и у «Решения о сделке»', () => {
  const t = fs.readFileSync(path.join(ROOT, 'pasport/kontragent/index.html'), 'utf8');
  const kod = t.slice(t.indexOf('var OTM={}'), t.indexOf('function razdelHtml'));
  assert.ok(!/localStorage|sessionStorage|indexedDB|fetch\(|sendBeacon|XMLHttpRequest|navigator\.clipboard/.test(kod));
  assert.ok(!/name="fio"|ФИО/.test(kod), 'ФИО — только от руки');
  assert.match(kod, /name="vremya"/);
  assert.match(kod, /name="adres"/);
  assert.match(kod, /подпись и расшифровка ______/);
  assert.match(t, /class="podpis pechat"><div>Решение принял: подпись и расшифровка/);
  assert.match(t, /\.pechat\{display:none\}/);
  assert.match(t, /@media print\{[\s\S]*\.pechat\{display:inline!important\}/);
});

test('v2: ссылки первоисточников — актуальные домены (bo.nalog.gov.ru, https для cbr.ru)', () => {
  const { execSync } = require('child_process');
  const out = execSync("git grep -l -e 'bo\\.nalog\\.ru' -e 'http://www\\.cbr\\.ru' -e 'http://cbr\\.ru' -- '*.html' '*.js' '*.json' ':!tests/*' || true", { cwd: ROOT }).toString().trim();
  assert.strictEqual(out, '', out);
});
