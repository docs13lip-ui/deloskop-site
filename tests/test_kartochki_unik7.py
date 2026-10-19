#!/usr/bin/env python3
"""kartochki-unik-v7 ([Ночные-2] 19.10): (1) история выручки — каким путём шла (росла каждый год / самый глубокий
годовой спад), а не одна формула «с N по N год выросла в N раза» на 99 карточках; (2) «По прибыли — N год, …»
обрывком без начала фразы (47 карточек) → лучший год прибыли против последнего. Запуск: python3 tests/test_kartochki_unik7.py"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochka_render as R  # noqa: E402

NB = " "
KOREN = pathlib.Path(__file__).resolve().parent.parent / "company"


def ryad(*d):
    return [{"god": 2020 + i, "dohod": v, "pribyl": 1e6} for i, v in enumerate(d)]


class TestPut(unittest.TestCase):
    def test_kazhdyj(self):
        r = ryad(1e9, 1.2e9, 1.5e9, 2e9)
        s = R.un_istoriya("«Р»", "в реестре с 2001 года", "", r[0], r[-1], r).replace(NB, " ")
        self.assertIn("росла каждый год из 4 лет открытой отчётности", s)

    def test_spad(self):
        r = ryad(1e9, 1.5e9, 1.2e9, 2e9)
        s = R.un_istoriya("«Р»", "в реестре с 2001 года", "", r[0], r[-1], r).replace(NB, " ")
        self.assertIn("За 2020–2023 годы выручка «Р» выросла в 2 раза", s)
        self.assertIn("; 2022 год — спад на 20 %", s)
        r = ryad(1e9, 1.5e9, 2.5e9, 2e9)
        s = R.un_istoriya("«Р»", "в реестре с 2001 года", "", r[0], r[-1], r).replace(NB, " ")
        self.assertIn("последний, 2023 год — спад на 20 %", s)

    def test_propusk_goda(self):
        r = ryad(1e9, 1.2e9, 1.5e9, 2e9)
        r[2]["god"] = 2025
        r[3]["god"] = 2026
        s = R.un_istoriya("«Р»", "в реестре с 2001 года", "", r[0], r[-1], r).replace(NB, " ")
        self.assertIn("выручка выросла в 2 раза", s)

    def test_opublikovannye(self):
        vse = list(KOREN.glob("*/index.html"))
        if not vse:
            self.skipTest("карточек нет")
        obryv = sum(">По прибыли —" in p.read_text(encoding="utf-8") for p in vse)
        self.assertEqual(obryv, 0, "«По прибыли — N год» без начала фразы")
        for p in vse:
            t = p.read_text(encoding="utf-8").replace("&nbsp;", NB)
            self.assertNotIn(" в" + NB + "2022" + NB + "год —", t, p)


if __name__ == "__main__":
    unittest.main()
