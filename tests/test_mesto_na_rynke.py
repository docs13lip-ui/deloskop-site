"""mesto-na-rynke-v1 ([Ночные-2] 19.11; решение владельца 18.11, разд. 3 п. 11): в «Рядом в Делоскопе» — место компании
по обороту среди карточек той же отрасли и того же региона с оборотом за тот же год, «в базе Делоскопа», от MESTO_OT
компаний. У головных (прибыль больше выручки) места нет. Вне отпечатка текста — dateModified от новых волн не сдвигается."""
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
MESTO = re.compile(r'<p class="co-ryadom__m caption">([^<]*)</p>')


def kart(inn, region, okved, dohod, god=2025):
    return {"inn": inn, "name": "ООО «К%s»" % inn[-3:], "region": region, "gorod": region, "okved": okved,
            "fakty": {"dohod": {"znachenie": dohod, "god": god}}}


class Mesto(unittest.TestCase):
    def setUp(self):
        self.vse = [kart("77000001%02d" % i, "Москва", "47.19", 1e9 * (i + 1)) for i in range(12)]

    def test_mesto_i_chislo(self):
        k = self.vse[9]  # 10 млрд — третья сверху из 12
        self.assertEqual(K.mesto_v_gruppe(k, self.vse, "region"), (3, 12, 2025))
        self.assertEqual(K.mesto_v_gruppe(self.vse[11], self.vse, "otrasl")[0], 1)

    def test_malo_kompanij_ili_drugoj_god(self):
        self.assertIsNone(K.mesto_v_gruppe(self.vse[0], self.vse[:K.MESTO_OT - 1], "region"))
        drugoj = [kart("77000002%02d" % i, "Москва", "47.19", 1e9, god=2024) for i in range(5)]
        vse = self.vse[:K.MESTO_OT - 1] + drugoj
        self.assertIsNone(K.mesto_v_gruppe(self.vse[0], vse, "region"), "оборот за другой год не сравниваем")
        self.assertIsNone(K.mesto_v_gruppe(kart("7700000300", "Москва", "47.19", 0), self.vse, "region"))

    def test_html(self):
        h = K.mesto_html((3, 21, 2025), "otrasl")
        self.assertIn("3-е место", h)
        self.assertIn("21 компании этой отрасли", h.replace(K.NB, " "))
        self.assertIn("базе Делоскопа", h.replace(K.NB, " "))
        self.assertEqual(K.mesto_html(None, "region"), "")

    def test_otpechatok_bez_mesta(self):
        k = self.vse[0]
        t = ('<main><section class="co-sec" aria-labelledby="a"><h2 id="a">А</h2><p>Текст.</p></section>'
             '<section class="co-sec co-ogov caption"><p>о</p></section></main>')
        sp = K.ryadom_spiski(k, self.vse)
        b1 = K.ryadom_html(k, sp, mesta={"region": (1, 12, 2025)})
        b2 = K.ryadom_html(k, sp, mesta={"region": (2, 40, 2025)})
        self.assertIn("co-ryadom__m", b1)
        self.assertEqual(KK.otpechatok_teksta(K.vstavit_ryadom(t, b1)), KK.otpechatok_teksta(K.vstavit_ryadom(t, b2)))


@unittest.skipUnless(KARTOCHKI, "карточек нет")
class NaSajte(unittest.TestCase):
    def test_magnit_bez_mesta(self):
        p = os.path.join(KOREN, "company", "2309085638-magnit", "index.html")
        if os.path.isfile(p):
            self.assertNotIn("co-ryadom__m", open(p, encoding="utf-8").read(), "у головной место по обороту не пишем")

    def test_mesta_v_bloke_i_chestno(self):
        est = 0
        for p in KARTOCHKI:
            t = open(p, encoding="utf-8").read()
            m = MESTO.findall(t)
            if not m:
                continue
            est += 1
            if K.MESTO_NE_PRIMENIMO in t:
                self.fail("место у головной: " + p)
            b = K.RYADOM_BLOK.search(t)
            self.assertTrue(b and all(x in b.group(0) for x in m), "место — только в «Рядом в Делоскопе»: " + p)
            for x in m:
                x = re.sub(r"&#160;|&nbsp;", " ", x)
                n, iz = map(int, re.search(r"— (\d+)-е место из (\d+) ", x).groups())
                self.assertTrue(1 <= n <= iz and iz >= K.MESTO_OT, p)
                self.assertIn("в базе Делоскопа", x, p)
        self.assertGreater(est, len(KARTOCHKI) // 2)


if __name__ == "__main__":
    unittest.main()
