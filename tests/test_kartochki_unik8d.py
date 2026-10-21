#!/usr/bin/env python3
"""kartochki-unik-v8d ([Ночные-2] 21.10): возраст компании стоял на карточке четыре раза (под H1, «Коротко», «Даты из
реестра» и «в реестре с … года (N лет)» первым предложением «Что это значит для вас» — 165 из 167). В «Что это
значит» возраст остаётся только у молодых (до 3 лет), у остальных абзац начинается с выручки и руководителя.
Запуск: python3 tests/test_kartochki_unik8d.py"""
import html
import pathlib
import re
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochka_render as R  # noqa: E402

NB = "\u00a0"
KOREN = pathlib.Path(__file__).resolve().parent.parent / "company"
_ZN = re.compile(r'<section class="co-sec co-znachit".*?</section>', re.S)


def ist(r0, r1, ruk=None, ryad=None):
    return R.un_istoriya_v8d("«А»", ruk, {"god": 2020, "dohod": r0}, {"god": 2025, "dohod": r1}, ryad).replace(NB, " ")


class TestIstoriya(unittest.TestCase):
    def test_varianty(self):
        self.assertEqual(ist(1e9, 2e9), "С 2020 по 2025 год выручка «А» выросла в 2 раза — с 1 млрд ₽ до 2 млрд ₽.")
        self.assertEqual(ist(1e9, 5e8), "Выручка «А» за 2025 год — 500 млн ₽, на 50 % меньше, чем в 2020 (1 млрд ₽).")
        self.assertEqual(ist(1e9, 1.1e9), "Выручка «А» — 1 млрд ₽ в 2020 году и 1,1 млрд ₽ в 2025.")
        ryad = [{"god": g, "dohod": d} for g, d in ((2020, 1e9), (2021, 1.2e9), (2022, 1.5e9), (2023, 2e9))]
        self.assertTrue(ist(1e9, 2e9, ryad=ryad).startswith("Выручка «А» росла каждый год из 4 лет"))

    def test_rukovoditel(self):
        self.assertTrue(ist(1e9, 2e9, "2015").endswith("; руководитель тот же с 2015 года."))
        self.assertEqual(R.un_korotkaya_v8d("«А»", "2015", 2, False).replace(NB, " "),
                         "Руководитель «А» не менялся с 2015 года; открытой отчётности на странице — 2 года.")
        self.assertEqual(R.un_korotkaya_v8d("«А»", None, 2, False).replace(NB, " "),
                         "У «А» открытой отчётности на странице — 2 года.")
        self.assertEqual(R.un_korotkaya_v8d("«А»", None, 1, True),
                         "По «А» на странице — только доход за год по данным ФНС.")

    def test_bez_vozrasta_i_stop_slov(self):
        for a, b in ((1e9, 2e9), (1e9, 5e8), (1e9, 1.1e9)):
            s = ist(a, b, "2015")
            self.assertNotIn("в реестре", s)
            self.assertNotRegex(s, r"\d лет\)")
            self.assertFalse(R.STOP_SLOVA.search(s), s)


class TestOpublikovannye(unittest.TestCase):
    """Сторож по карточкам в company/: «в реестре с» в «Что это значит» — только у компаний моложе 3 лет."""

    def test_vozrast_ne_povtoryaetsya(self):
        stranic = 0
        for p in sorted(KOREN.glob("*/index.html")):
            s = p.read_text(encoding="utf-8")
            m = _ZN.search(s)
            if not m:
                continue
            stranic += 1
            t = html.unescape(re.sub(r"<[^>]+>", "", m.group(0))).replace(NB, " ")
            v = re.search(r"в реестре с \d{4} года \((\d+) (?:год|года|лет)\)", t)
            if v:
                self.assertLess(int(v.group(1)), 3, "%s: возраст повторён в «Что это значит»" % p.parent.name)
        if KOREN.exists():
            self.assertGreater(stranic, 0)


if __name__ == "__main__":
    unittest.main(verbosity=1)
