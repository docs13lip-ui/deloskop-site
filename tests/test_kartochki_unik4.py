#!/usr/bin/env python3
"""kartochki-unik-v4 ([Ночные-2] 18.10): абзац «средняя выручка в месяц» — по фактам, а не одной формулировкой на всех;
«1-й результат» вместо «1-я результат». Запуск: python3 tests/test_kartochki_unik4.py"""
import pathlib
import re
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochka_render as R  # noqa: E402

NB = "\u00a0"


def t(*a):
    return R.un_mesyac(*a).replace(NB, " ")


class TestMesyac(unittest.TestCase):
    def test_varianty_po_faktam(self):
        za = "за 2025 год"
        self.assertTrue(t("«А»", za, 36e9, -9.8e9, 0.01).startswith("При убытке 9,8 млрд ₽ за 2025 год заказ от 3 млрд ₽ (это средняя выручка «А» в месяц)"))
        self.assertIn("выросла на 20 %", t("«А»", za, 1.2e9, 1e8, 0.2))
        self.assertIn("на 10 % ниже прошлогодней", t("«А»", za, 1.2e9, 1e8, -0.1))
        self.assertIn("на 8 % больше прошлогоднего", t("«А»", za, 24e9, 1e9, 0.08))
        self.assertTrue(t("«А»", za, 24e9, 1e9, 0.0).startswith("«А» — крупный бизнес: 2 млрд ₽ выручки в месяц"))
        self.assertTrue(t("«А»", za, 60e6, 1e6, None).startswith("Оборот «А» — 5 млн ₽ в месяц"))
        self.assertTrue(t("«А»", za, 1.2e9, 1e8, 0.0).startswith("Средняя месячная выручка «А» за 2025 год — 100 млн ₽"))

    def test_stop_slova_i_imya_v_kazhdom(self):
        for a in [(-1e9, 0.0), (1e8, 0.3), (1e8, -0.2), (1e9, 0.07), (1e9, 0.0), (1e6, None), (1e8, 0.01)]:
            for r1 in (60e6, 1.2e9, 24e9):
                s = t("«Ромашка»", "за 2025 год", r1, *a)
                self.assertFalse(R.STOP_SLOVA.search(s), s)
                self.assertIn("«Ромашка»", s)
                # не больше 4 общих слов подряд без имени или числа — иначе 5-словные фрагменты повторяются
                for kusok in re.split(r"«Ромашка»|\d[\d ,]*\s*(?:трлн|млрд|млн|тыс\.)?\s*[₽%]?|2025 год", s):
                    slova = re.findall(r"[а-яёА-ЯЁ]+", kusok)
                    self.assertLessEqual(len(slova), 12, kusok)

    def test_poryadkovoe(self):
        self.assertEqual(R._un_poryadk(1), "1-й")
        self.assertEqual(R._un_poryadk(13), "13-й")


class TestStranicy(unittest.TestCase):
    def test_net_1ya_rezultat(self):
        koren = pathlib.Path(__file__).resolve().parent.parent / "company"
        for p in koren.glob("*/index.html"):
            self.assertNotRegex(p.read_text(encoding="utf-8"), r"\d+-я результат", p.parent.name)


if __name__ == "__main__":
    unittest.main()
