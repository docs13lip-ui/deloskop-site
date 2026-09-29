// beta-v1: два взгляда на страницу для автотестов — то же, что tests/beta.py, на JS.
//   platnyj(html) — страница, какой она будет при "beta": false (оплата видна, бета-половины в <template>);
//   vidimoe(html) — то, что видят посетитель и робот: без содержимого <template>.
// Тесты, которые проверяют устройство оплаты (кнопки, счёт, бронь), смотрят на vidimoe(platnyj(html)) —
// оплата не потерялась, а только спрятана; тесты беты (tests/beta.test.js) — на vidimoe(html).
const BLOK = /<!--oplata-->([\s\S]*?)<!--\/oplata-->(?:<!--v-bete-->([\s\S]*?)<!--\/v-bete-->)?/g;
const snyat = (s, open) => (s.startsWith(open) && s.endsWith('</template>'))
  ? s.slice(open.length, -'</template>'.length).split(' data-oplata-href=').join(' href=') : s;
const spryatat = (s, open) => s ? open + s.split(' href=').join(' data-oplata-href=') + '</template>' : s;
function platnyj(html) {
  return html.replace(BLOK, (m, o, b) => '<!--oplata-->' + snyat(o, '<template data-oplata>') + '<!--/oplata--><!--v-bete-->' +
    spryatat(snyat(b || '', '<template data-v-bete>'), '<template data-v-bete>') + '<!--/v-bete-->')
    .replace('<meta name="deloskop-rezhim" content="beta">\n', '')
    .replace(/<!--beta-polosa-->[\s\S]*?<!--\/beta-polosa-->\n?/, '');
}
const vidimoe = (html) => html.replace(/<template\b[\s\S]*?<\/template>/g, '');
module.exports = { platnyj, vidimoe };
