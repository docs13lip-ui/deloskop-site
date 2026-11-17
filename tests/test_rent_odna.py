#!/usr/bin/env python3
"""rent-odna-v1 (17.11.2026): одна рентабельность на странице карточки.
Абзац «… в своём разделе» считал чистую рентабельность из округлённой таблицы («19,4 млрд ₽» / «2,9 млрд ₽» → 669 %),
а «Разбор по цифрам» — из точных рядов (−667 %): на одной странице два разных числа одного показателя.
Теперь абзац берёт число «Разбора» (знак — как у прибыли); числа нет — считает по таблице, как раньше."""
import glob
import html
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

NB = K.NB
KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _tekst(t):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", t, flags=re.S)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t)))


class Razbor(unittest.TestCase):
    def test_chitaet_chislo(self):
        t = "<p>Чистая рентабельность за&nbsp;2025&#160;— −667&nbsp;%.</p><p>Чистая рентабельность за 2024 — 4,3" + NB + "%</p>"
        self.assertEqual(sorted((int(g), v) for g, v in K._UN_RENT.findall(t.replace("&nbsp;", NB))),
                         [(2024, "4,3"), (2025, "−667")])

    def test_tochno_i_znak(self):
        f = {"rent": {2025: -6.67}}
        self.assertEqual(K._un_rent_tochno(f, {"god": 2025, "pribyl": -19.4e9}), -6.67)
        self.assertIsNone(K._un_rent_tochno(f, {"god": 2025, "pribyl": 1e9}))   # знак не сошёлся — не верим
        self.assertIsNone(K._un_rent_tochno(f, {"god": 2024, "pribyl": -1e9}))  # другой год
        self.assertIsNone(K._un_rent_tochno({}, {"god": 2025, "pribyl": -1e9}))

    def test_zapas_po_tablice(self):
        self.assertAlmostEqual(K._un_rent({"rent1": None, "pr1": -19.4e9, "r1": 2.9e9}), -19.4 / 2.9)
        self.assertEqual(K._un_rent({"rent1": -6.67, "pr1": -19.4e9, "r1": 2.9e9}), -6.67)
        self.assertEqual(K._zn_proc(K._un_rent({"rent1": -6.67, "pr1": -1, "r1": 1})), "667" + NB + "%")


class Opublikovannye(unittest.TestCase):
    """Сторож: на каждой карточке рентабельность в «Разборе» и в абзаце «в своём разделе» — одно число."""

    def test_odno_chislo(self):
        plohie = []
        for f in sorted(glob.glob(os.path.join(KOREN, "company", "*", "index.html"))):
            t = _tekst(open(f, encoding="utf-8").read())
            a = re.search(r"Чистая рентабельность за (\d{4}) — (−?[\d,]+) %", t)
            b = re.search(r"(?:рентабельность|убыток к выручке)[^.]{0,40}за (\d{4}) год — (−?[\d,]+) % выручки", t)
            if a and b and a.group(1) == b.group(1):
                x = abs(float(a.group(2).replace("−", "").replace(",", ".")))
                y = float(b.group(2).replace(",", "."))
                if abs(x - y) > 0.05:
                    plohie.append((os.path.basename(os.path.dirname(f)), a.group(2), b.group(2)))
        self.assertEqual(plohie, [])


if __name__ == "__main__":
    unittest.main()
