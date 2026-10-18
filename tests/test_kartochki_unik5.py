#!/usr/bin/env python3
"""kartochki-unik-v5 ([Ночные-2] 18.10): «с него начинается открытая отчётность на странице» (159 из 167 карточек) →
ход выручки от первого года открытой отчётности до последнего; заголовок «На фоне других компаний Делоскопа.» →
имя компании + с кем сравниваем; цены нет и в скрытой половине беты (решение 16.10, ответ Штаба 18.10 11:35).
Запуск: python3 tests/test_kartochki_unik5.py"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochka_render as R  # noqa: E402

NB = " "
KOREN = pathlib.Path(__file__).resolve().parent.parent / "company"


def ist(r0, r1):
    return R.un_istoriya("«А»", "в реестре с 2001 года (25 лет)", "", {"god": 2020, "dohod": r0},
                         {"god": 2025, "dohod": r1}).replace(NB, " ")


class TestIstoriya(unittest.TestCase):
    def test_varianty(self):
        self.assertIn("с 2020 по 2025 год выручка выросла в 2 раза — с 1 млрд ₽ до 2 млрд ₽.", ist(1e9, 2e9))
        self.assertIn("выручка 2025 года — 500 млн ₽, на 50 % меньше, чем в 2020 (1 млрд ₽).", ist(1e9, 5e8))
        self.assertIn(": 1 млрд ₽ выручки в 2020 году и 1,1 млрд ₽ — в 2025.", ist(1e9, 1.1e9))
        for a, b in ((1e9, 2e9), (1e9, 5e8), (1e9, 1.1e9)):
            s = ist(a, b)
            self.assertTrue(s.startswith("«А» в реестре с 2001 года"), s)
            self.assertNotIn("начинается открытая отчётность", s)
            self.assertFalse(R.STOP_SLOVA.search(s), s)


class TestZagolovok(unittest.TestCase):
    def test_po_vidu(self):
        self.assertEqual(R.un_otlichie_zag("«А»", "razdel"), "«А» в своём разделе.")
        self.assertEqual(R.un_otlichie_zag("«А»", "region"), "«А» в своём регионе.")
        self.assertEqual(R.un_otlichie_zag("«А»", "vse"), "Рядом с «А» по выручке.")
        self.assertEqual(R.un_otlichie_zag("«А»", "nevedomyj"), "«А» среди компаний Делоскопа.")
        self.assertEqual(R.un_otlichie_zag("", "razdel"), "На фоне других компаний Делоскопа.")
        for v in R.UN_ZAG:
            self.assertIn("«А»", R.un_otlichie_zag("«А»", v))


class TestBezCeny(unittest.TestCase):
    def test_vhod(self):
        h = R.pasport_vhod_html("0012345678", 490)
        self.assertNotIn("490", h)
        self.assertNotIn("₽", h)
        self.assertNotIn("«Старт»", h)


class TestStranicy(unittest.TestCase):
    def test_net_shablonov_i_cen(self):
        for p in KOREN.glob("*/index.html"):
            t = p.read_text(encoding="utf-8")
            self.assertNotIn("начинается открытая отчётность на странице", t, p.parent.name)
            self.assertNotIn("На фоне других компаний Делоскопа.", t, p.parent.name)
            self.assertNotRegex(t, r"\d(?:&nbsp;|\s)₽ или в(?:&nbsp;|\s)тарифе", p.parent.name)


if __name__ == "__main__":
    unittest.main()
