#!/usr/bin/env python3
"""zajmy-raz-v1 (17.11.2026): в таблице «Кто кому должен» кредиты к выручке в 3 раза и больше — «в 33 раза больше
выручки за 2025», а не «3306 % выручки» (рядом фраза уже говорила «в 33 раза»). Ниже трёх раз — проценты, как было.
Опубликованные чинит pochinit_procenty по числу самой ячейки (perepechatat); фраза выводов читает обе формы."""
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


class Yachejka(unittest.TestCase):
    def test_slova(self):
        self.assertEqual(K.k_vyruchke(96e9, 2.904e9, 2025), "в" + NB + "33" + NB + "раза больше выручки за" + NB + "2025")
        self.assertEqual(K.k_vyruchke(2.5e9, 1e9, 2025), "250" + NB + "% выручки за" + NB + "2025")
        self.assertEqual(K.k_vyruchke(3.44e9, 1e9, 2025), "в" + NB + "3,4" + NB + "раза больше выручки за" + NB + "2025")
        self.assertEqual(K.k_vyruchke(5e9, 1e9, 2025), "в" + NB + "5" + NB + "раз больше выручки за" + NB + "2025")
        self.assertEqual(K.k_vyruchke(0.76e9, 1e9, 2025), "76" + NB + "% выручки за" + NB + "2025")

    def test_tablica_i_fraza(self):
        k = {"raschety": {"god": 2025, "rec": 45.1e9, "pay": 3.6e9, "loan": 96e9},
             "finansy": [{"god": 2025, "dohod": 2.904e9}], "finansy_istochnik": "ГИР БО, бухгалтерская отчётность"}
        h = K.balans_html(k)
        self.assertIn("в" + NB + "33" + NB + "раза больше выручки за" + NB + "2025", h)
        self.assertNotIn("3306", h)
        fr = " ".join(K.bv_frazy(h, "«Образец»"))
        self.assertIn("в" + NB + "33" + NB + "раза больше выручки за" + NB + "2025" + NB + "год.", fr)

    def test_pochinka(self):
        t = ('<tr><td>Кредиты и&#160;займы</td><td class="num">96&nbsp;млрд&nbsp;₽</td>'
             '<td class="num">3306&nbsp;% выручки за&nbsp;2025</td></tr>')
        u = K.pochinit_procenty(t)
        self.assertIn(">в" + NB + "33" + NB + "раза больше выручки за" + NB + "2025<", u)
        self.assertEqual(K.pochinit_procenty(u), u)
        t2 = t.replace("3306", "250")
        self.assertEqual(K.pochinit_procenty(t2), t2)  # ниже трёх раз — как было


class Opublikovannye(unittest.TestCase):
    """Сторож: на карточках в «К выручке» нет процентов от 300 и выше."""

    def test_net_tysyach_procentov(self):
        plohie = []
        for f in sorted(glob.glob(os.path.join(KOREN, "company", "*", "index.html"))):
            t = html.unescape(open(f, encoding="utf-8").read()).replace(NB, " ")
            for m in re.finditer(r">(\d+) % выручки за \d{4}<", t):
                if int(m.group(1)) >= 300:
                    plohie.append((os.path.basename(os.path.dirname(f)), m.group(1)))
        self.assertEqual(plohie, [])


if __name__ == "__main__":
    unittest.main()
