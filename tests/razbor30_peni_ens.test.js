// razbor30-v1 ([Ночные запуски] 28.10): Разбор № 30 «Уточнёнка за 2019 год воскресила пени» — текст [Право] 28.10
// (claude/Право_блоки_28.10.md, по PDF vsrf.ru stor_pdf_ec/2570098). Норму п. 9.1 ст. 88 НК [Право] дословно не сверяло —
// подаём «как в определении ВС»; длинных цитат из акта нет — только «прямо не взаимосвязана»; исход не обещаем.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const KOREN = path.join(__dirname, '..');
const chitat = (f) => fs.readFileSync(path.join(KOREN, f), 'utf8');
const un = (s) => s.replace(/&nbsp;| /g, ' ').replace(/‑/g, '-');
const SLUG = 'utochnenka-i-peni-ens';
const URL = '/praktika/nalogi/' + SLUG + '/';

test('Разбор № 30: данные — ВС № 306-ЭС26-4683 от 25.09.2026, раздел «Налоги», первым в списке, 2 входящие', () => {
  const D = JSON.parse(chitat('praktika/dela.json'));
  const r = D.razbory.find((x) => x.slug === SLUG);
  assert.ok(r && r.razdel === 'nalogi');
  assert.ok(D.razbory.slice(0, 4).some((x) => x.slug === SLUG), 'новые разборы — первыми (среди четырёх свежих)');
  assert.deepStrictEqual(r.dela.map((d) => d.nomer + ' ' + d.data + ' ' + d.itog), ['№ 306-ЭС26-4683 2026-09-25 В пользу налоговой']);
  assert.strictEqual(r.dela[0].istochnik, 'https://vsrf.ru/lk/practice/stor_pdf_ec/2570098');
  assert.ok(r.dela[0].delo.includes('А72-16379/2024'));
  assert.strictEqual(r.knopka.cel, 'razbor30_check');
  assert.ok(r.zakon.some((z) => /п\. 9\.1 ст\. 88 НК РФ.*как в определении ВС/.test(z[0])), '◐ норма — «как в определении ВС»');
  for (const f of ['nalogi/statya-54-1-nk-prostymi-slovami/index.html', 'nalogi/nagruzka/index.html']) {
    assert.ok(D.ssylki_s_sajta[f].includes(SLUG), 'входящая ссылка с ' + f);
    assert.ok(un(chitat(f)).includes(URL), 'ссылка собрана в ' + f);
  }
});

test('Разбор № 30: суммы и даты по тексту [Право], без обещаний исхода', () => {
  const t = un(chitat('tests/praktika/' + SLUG + '.html'));
  for (const s of ['5 764 124,51 ₽', '116 027,07 ₽', '10 раз', '«прямо не взаимосвязана»', 'п. 5 ст. 11.3 НК РФ', 'ст. 46–47 и 70 НК РФ'])
    assert.ok(t.includes(s), s);
  for (const d of ['2026-09-23', '2026-09-25']) assert.ok(t.includes('datetime="' + d + '"'), 'дата ' + d);
  assert.ok(!/blockquote/.test(t), 'длинных цитат без сверки буква в букву не ставим');
  assert.ok(!/(?<!не )гарантир|вернут(?!ь)|точно уберут/i.test(t), 'исход не обещаем');
  const s = un(chitat('praktika/nalogi/' + SLUG + '/index.html'));
  assert.ok(/"@type": ?"FAQPage"/.test(s) && s.includes('razbor30_check'));
});
