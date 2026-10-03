// vhod-soglasie-v1: галочка рассылок при входе, строка об оферте, карточка «Письма Делоскопа» (ТЗ [Продукт] 02.10, разд. 1.1;
// тексты — [Юрист 115-ФЗ] 26.09, /rassylki/). Запуск: node --test tests/vhod_soglasie.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const K = path.join(__dirname, '..');
const chit = (f) => fs.readFileSync(path.join(K, f), 'utf8');
const S = chit('cabinet.html');
const prosto = (h) => h.replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const TEKST = 'Хочу получать письма Делоскопа о новых функциях, статьях и специальных предложениях. Согласие можно отозвать в любой момент ссылкой «Отписаться» в каждом письме.';
const vhod = S.slice(S.indexOf('<section class="card" id="login"'), S.indexOf('</section>', S.indexOf('id="login"')));

test('галочка: по умолчанию снята, скрыта, пока API её не принимает; текст = /rassylki/ дословно', () => {
  const lab = S.match(/<label class="sogl" id="soglVhod" hidden>([\s\S]*?)<\/label>/);
  assert.ok(lab, 'галочка в форме входа, скрыта до ответа /api/rassylki');
  assert.ok(/<input type="checkbox" id="rassylki">/.test(lab[1]));
  assert.ok(!/checked/.test(lab[1]), 'по умолчанию снята');
  assert.ok(prosto(lab[1]).startsWith(TEKST), prosto(lab[1]));
  assert.ok(lab[1].includes('<a href="/rassylki/">Подробнее</a>'));
  assert.ok(prosto(chit('rassylki/index.html')).includes('«' + TEKST.replace(/\.$/, '') + '»'), 'тот же текст на /rassylki/');
  assert.ok(S.indexOf('id="soglVhod"') > S.indexOf('id="fEmail"') && S.indexOf('id="soglVhod"') < S.indexOf('id="fCode"'), 'под полем почты');
});

test('строка об оферте под кнопкой; вход не зависит от галочки', () => {
  assert.ok(prosto(vhod.replace(/<\/?a[^>]*>/g, '')).includes('Входя, вы принимаете оферту. Как мы обрабатываем данные — в Политике.'));
  assert.ok(vhod.includes('<a href="/oferta/">оферту</a>') && vhod.includes('<a href="/politika/">Политике</a>'));
  assert.ok(/\.oferta-vhod\{[^}]*font-size:12\.5px/.test(S));
  // поле rassylki уходит только при отмеченной и видимой галочке; кнопки входа не блокируются
  assert.ok(S.includes("function sGalochkoj(b){if(galochka())b.rassylki=true;return b}"));
  assert.ok(S.includes("return !!(g&&!$('soglVhod').hidden&&g.checked)"));
  assert.ok(S.includes("body:sGalochkoj({email:email})") && S.includes("body:sGalochkoj({email:email,code:code})"));
  assert.ok(!/rassylki'\)\.checked\)\s*return/.test(S) && !/disabled=!\$\('rassylki'\)/.test(S), 'галочка — не условие входа');
});

test('галочка показывается только при ответе API той же редакции', () => {
  assert.ok(S.includes("var SOGL_VERSIYA='2026-09-26';"));
  assert.ok(S.includes("call('/api/rassylki').then(function(j){if(j&&j.versiya===SOGL_VERSIYA)$('soglVhod').hidden=false}).catch(function(){})"));
});

test('без давления и обещаний в форме входа', () => {
  const t = prosto(vhod).toLowerCase();
  for (const s of ['успейте', 'только сегодня', 'бесплатно навсегда', 'скидк', 'гарантир']) assert.ok(!t.includes(s), s);
});

test('цель Метрики rassylki_soglasie — только при согласии', () => {
  assert.ok(S.includes("if(sogl)dlkGoal('rassylki_soglasie')"));
  assert.ok(S.includes("if(vkl&&window.dlkGoal)dlkGoal('rassylki_soglasie')"));
});

test('карточка «Письма Делоскопа»: скрыта без поля rassylki в /api/me; три состояния; итог по ссылке из письма', () => {
  assert.ok(/<section class="card" id="pisma" hidden>/.test(S));
  assert.ok(S.includes("if(st!=='net'&&st!=='zhdet'&&st!=='da'){$('pisma').hidden=true;return}"));
  assert.ok(S.includes('Вы подписаны на письма Делоскопа.'));
  assert.ok(S.includes('. Нажмите в нём «Подтвердить подписку» — до этого писем не будет.'));
  assert.ok(S.includes('data-pisma="on" disabled>Подписаться'), 'подписаться — только после галочки');
  assert.ok(S.includes('>Отписаться</button>'));
  assert.ok(S.includes("ok:['Подписка подтверждена.','ok']"));
  assert.ok(/rassylki=\(ok\|otpiska\|staraya\)/.test(S));
  assert.ok(S.includes('history.replaceState(null,\'\',location.pathname+location.hash)'), 'параметр убираем из адреса');
  // карточка не перетягивает главное действие: обычная .card, кнопка не primary
  const k = S.slice(S.indexOf('id="pisma"'), S.indexOf('</section>', S.indexOf('id="pisma"')));
  assert.ok(!k.includes('primary'));
  assert.ok(!/data-pisma="(on|off)"[^>]*class="btn primary/.test(S));
});
