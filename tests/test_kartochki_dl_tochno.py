#!/usr/bin/env python3
"""kartochki-dl-tochno-v1 (30.10.2026, [Ночные-2]): рост выручки к прошлому году на одной карточке /company/ — одно число.
Абзацы «Что это значит» и «Перед оплатой» считали его по округлённым суммам таблицы («1 трлн ₽ / 944 млрд ₽» → 5,9 %),
а вывод «Коротко» — по точным (10 %). Сторож: (1) на всех опубликованных карточках число в «выросла на N %, до…»,
«на N % ниже», «на N % больше прошлогоднего», «выросшей на N %», «год упала на N %» равно числу вывода «Выручка за ГГГГ —
…, на N % больше/меньше, чем годом раньше»; (2) zn_dl: есть вывод — берёт его, нет — считает по суммам."""
import glob
import html
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_V = re.compile(r"Выручка за (\d{4}) — [\d,]+ (?:трлн|млрд|млн|тыс\.) ₽, на ([\d,]+) % (?:больше|меньше), чем")
_U = re.compile(r"выросла на ([\d,]+) %, до|на ([\d,]+) % ниже|на ([\d,]+) % больше прошлогоднего|выросшей на ([\d,]+) %|год упала на ([\d,]+) %")


class TestDlTochno(unittest.TestCase):
    def test_opublikovannye(self):
        n, plohie = 0, []
        for f in sorted(glob.glob(os.path.join(KOREN, "company", "*", "index.html"))):
            with open(f, encoding="utf-8") as fh:
                t = html.unescape(re.sub(r"<[^>]+>", " ", fh.read())).replace(" ", " ")
            a = _V.search(t)
            if not a:
                continue
            for g in _U.findall(t):
                n += 1
                if next(x for x in g if x) != a.group(2):
                    plohie.append(os.path.basename(os.path.dirname(f)))
        self.assertGreater(n, 80)
        self.assertEqual(plohie[:5], [])

    def test_zn_dl(self):
        p0, p1 = {"god": 2024, "dohod": 944e9}, {"god": 2025, "dohod": 1e12}
        f = {"dl_tochno": K._zn_dl_tochno([("ok", "Выручка за 2025 — 1 трлн ₽, на 10 % больше, чем годом раньше")])}
        self.assertAlmostEqual(K.zn_dl(f, p1, p0), 0.10)
        self.assertAlmostEqual(K.zn_dl({"dl_tochno": {}}, p1, p0), 1e12 / 944e9 - 1)
        f = {"dl_tochno": K._zn_dl_tochno([("warn", "Выручка за 2025 — 2,7 трлн ₽, на 7,5 % меньше, чем годом раньше")])}
        self.assertAlmostEqual(K.zn_dl(f, p1, p0), -0.075)
        self.assertAlmostEqual(K.zn_dl(f, p1, {"god": 2023, "dohod": 944e9}), 1e12 / 944e9 - 1)


if __name__ == "__main__":
    unittest.main()
