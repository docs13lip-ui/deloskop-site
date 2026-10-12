// testirovshchik-1210: QR СБП для граждан на сайте ⇒ в оферте есть абзац «Оплата гражданами» (id="o-karta")
// и нет запрета для граждан без оговорки «счёт». Ворота [Право] 12.10 10:30.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const kor = path.join(__dirname, "..");
const chitat = (f) => fs.readFileSync(path.join(kor, f), "utf8");

test("QR СБП на /tarify/ или ссылка в sbp-qr.js ⇒ оферта с id=o-karta", () => {
  const qr = /data-sbp-tarify/.test(chitat("tarify/index.html")) || /SSYLKA\s*=\s*"https:\/\/qr\.nspk\.ru\//.test(chitat("js/sbp-qr.js"));
  if (!qr) return;
  const of = chitat("oferta/index.html");
  assert.match(of, /id="o-karta"/, "в оферте нет абзаца «Оплата гражданами» (id=o-karta)");
  assert.doesNotMatch(of, /Если оплата поступила со счёта гражданина/, "оферта всё ещё велит возвращать оплату гражданина");
  assert.doesNotMatch(of, /только по счёту с расчётного счёта организации или индивидуального предпринимателя/, "оферта: «только по счёту»");
});

test("без кассы не обещаем «деньги приходят сразу» / «чек сразу»", () => {
  for (const f of ["js/sbp-qr.js", "tarify/index.html"]) {
    const t = chitat(f);
    assert.doesNotMatch(t, /приходят сразу|чек придёт сразу|моментально/, f);
  }
});
