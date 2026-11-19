"""perelinkovka-v1 ([Ночные-2] 19.11; решение владельца 18.11 «сайт лучше конкурентов и справочников», разд. 6 Н4):
внизу карточки /company/ — «Рядом в Делоскопе»: «В отрасли», «В регионе», «Близкие по выручке», до 5 в каждом.
Без самой карточки, без повторов с правой колонкой («Похожие», «Ещё …») и между списками, без карточек за воротами
индексации. Заголовок — ссылкой на хаб группы, если хаб есть. Навигация, не сведения: отпечаток текста и dateModified прежние."""
import glob
import os
import re
import sys
import unittest

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(KOREN, "tests"))
import kartochka_render as K  # noqa: E402
import kartochki as KK  # noqa: E402

KARTOCHKI = sorted(glob.glob(os.path.join(KOREN, "company", "[0-9]*", "index.html")))
BLOK = re.compile(r'<section class="co-sec co-ryadom".*?</section><!--/ryadom-->', re.S)
SOS = re.compile(r'<aside class="co-side card" aria-labelledby="sos">.*?</aside>', re.S)
SSYLKA = re.compile(r'<li><a href="/company/([^/"]+)/">')


def kart(inn, region, okved, dohod, god=2025, name=None):
    return {"inn": inn, "name": name or ("ООО «К%s»" % inn[-3:]), "region": region, "gorod": region, "okved": okved,
            "fakty": {"dohod": {"znachenie": dohod, "god": god}}}


class Spiski(unittest.TestCase):
    def setUp(self):
        self.k = kart("7700000001", "Москва", "47.11", 1e9)
        self.vse = [self.k] + [kart("77000001%02d" % i, "Москва" if i % 2 else "Тверская область",
                                    "47.19" if i % 3 else "41.20", 1e9 * (1 + i)) for i in range(20)]

    def test_poryadok_i_razmer(self):
        s = K.ryadom_spiski(self.k, self.vse)
        self.assertEqual([v for v, _, _ in s], ["otrasl", "region", "vyruchka"])
        for _, _, x in s:
            self.assertLessEqual(len(x), K.RYADOM_N)
        self.assertEqual(s[0][1], K.hab_otrasl(self.k))
        self.assertEqual(s[1][1], "Москва")

    def test_bez_sebya_povtorov_uzhe_i_zakrytyh(self):
        uzhe = {"7700000100", "7700000101"}
        zakryty = {"7700000102"}
        s = K.ryadom_spiski(self.k, self.vse, uzhe, zakryty)
        vse_inn = [y["inn"] for _, _, x in s for y in x]
        self.assertEqual(len(vse_inn), len(set(vse_inn)), "одна компания — в одном списке")
        self.assertNotIn(self.k["inn"], vse_inn)
        self.assertFalse(set(vse_inn) & (uzhe | zakryty))

    def test_blizhe_po_oborotu_pervye(self):
        s = dict((v, x) for v, _, x in K.ryadom_spiski(self.k, self.vse))
        d = [K._dohod_kart(y) for y in s["otrasl"]]
        self.assertEqual(d, sorted(d), "в отрасли — от ближнего по обороту")

    def test_bez_vyruchki_net_spiska_vyruchki(self):
        k = kart("7700000002", "Москва", "47.11", 0)
        self.assertNotIn("vyruchka", [v for v, _, _ in K.ryadom_spiski(k, self.vse + [k])])

    def test_html_hab_i_idempotentnost(self):
        s = K.ryadom_spiski(self.k, self.vse)
        kg = {("region", "Москва"): "/company/region/moskva/"}
        b = K.ryadom_html(self.k, s, kg)
        self.assertIn('<a href="/company/region/moskva/">В регионе: Москва</a>', b)
        self.assertIn("Близкие по выручке", b)
        t = '<main><section class="co-sec">x</section><section class="co-sec co-ogov caption"><p>о</p></section></main>'
        t1 = K.vstavit_ryadom(t, b)
        self.assertEqual(K.vstavit_ryadom(t1, b), t1)
        self.assertLess(t1.index("co-ryadom"), t1.index("co-ogov"))
        self.assertEqual(K.ubrat_ryadom(t1), t)
        self.assertEqual(K.vstavit_ryadom(t1, ""), t, "пустой блок — блока нет")

    def test_otpechatok_bez_bloka(self):
        t = ('<main><section class="co-sec" aria-labelledby="a"><h2 id="a">А</h2><p>Текст.</p></section>'
             '<section class="co-sec co-ogov caption"><p>о</p></section></main>')
        b = K.ryadom_html(self.k, K.ryadom_spiski(self.k, self.vse))
        self.assertEqual(KK.otpechatok_teksta(t), KK.otpechatok_teksta(K.vstavit_ryadom(t, b)))


@unittest.skipUnless(KARTOCHKI, "карточек нет")
class NaSajte(unittest.TestCase):
    def test_blok_na_kartochkah(self):
        zakryty = set()
        stranicy = {}
        for p in KARTOCHKI:
            t = open(p, encoding="utf-8").read()
            d = os.path.basename(os.path.dirname(p))
            stranicy[d] = t
            if 'name="robots" content="noindex' in t:
                zakryty.add(d)
        bez = []
        for d, t in stranicy.items():
            m = BLOK.search(t)
            if not m:
                bez.append(d)
                continue
            self.assertEqual(t.count('class="co-sec co-ryadom"'), 1, d)
            self.assertLess(t.index("co-ryadom"), t.index("co-ogov"), d)
            v = SSYLKA.findall(m.group(0))
            self.assertNotIn(d, v, d)
            self.assertEqual(len(v), len(set(v)), d)
            sos = SOS.search(t)
            self.assertFalse(set(v) & set(SSYLKA.findall(sos.group(0) if sos else "")), "повтор с правой колонкой: " + d)
            self.assertFalse(set(v) & zakryty, "ссылка на карточку с noindex: " + d)
            for x in v:
                self.assertIn(x, stranicy, "ссылка на несуществующую карточку: %s → %s" % (d, x))
        self.assertLessEqual(len(bez), len(stranicy) // 20, "без блока: %s" % bez[:5])


if __name__ == "__main__":
    unittest.main()
