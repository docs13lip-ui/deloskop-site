#!/usr/bin/env python3
"""kartochki-nalogi-sverka-v1 ([Ночные-2] 16.11): выручка года ≥ 1 млрд ₽, а налогов и взносов того же года уплачено
меньше 0,01 % — карточку не публикуем до сверки единиц ГИР БО: новые — воротами, опубликованные — при sobrat --dobavit.
Запуск: python3 tests/test_kartochki_nalogi_sverka.py"""
import glob
import os
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochki as K  # noqa: E402

KOREN = str(pathlib.Path(__file__).resolve().parent.parent)
NB = "&nbsp;"


def stranica(vyr, nal, god_nal="2025"):
    return ('<section class="co-sec" aria-labelledby="fin"><h2 id="fin">Выручка</h2><div class="table-wrap"><table class="table">'
            '<thead><tr><th>Год</th><th>Выручка</th></tr></thead><tbody><tr><td>2025</td><td class="num">%s</td></tr></tbody>'
            '</table></div></section><div class="fact"><span>Налоги и взносы за год</span><span class="fact__v">%s за' + NB
            + '%s</span><span class="fact__src co-src">ФНС</span></div>') % (vyr, nal, god_nal)


class TestNalogiSverka(unittest.TestCase):
    def k(self, vyr, nal, god_nal=2025):
        return {"inn": "0000000000", "finansy": [{"god": 2025, "dohod": vyr}],
                "fakty": {"nalogi": {"znachenie": nal, "god": god_nal}}}

    def test_slovar(self):
        self.assertLess(K.nalogi_k_vyruchke(self.k(32.7e9, 185e3)), K.NALOGI_DOLYA_MIN)  # «ТС»
        self.assertGreater(K.nalogi_k_vyruchke(self.k(54.2e9, 10.6e6)), K.NALOGI_DOLYA_MIN)  # ближайшая честная, 0,0196 %
        self.assertIsNone(K.nalogi_k_vyruchke(self.k(900e6, 1e3)))  # меньше 1 млрд ₽ — не трогаем
        self.assertIsNone(K.nalogi_k_vyruchke(self.k(32.7e9, 185e3, 2024)))  # налоги другого года — не мерило
        self.assertIsNone(K.nalogi_k_vyruchke(self.k(32.7e9, 0)))  # 0 ₽ или нет набора — ворота не применяются

    def test_vorota(self):
        src = open(os.path.join(KOREN, "tests", "kartochka_render.py"), encoding="utf-8").read()
        self.assertIn("nv < NALOGI_DOLYA_MIN", src)
        self.assertEqual(K.NALOGI_DOLYA_MIN, 1e-4)

    def test_html(self):
        self.assertTrue(K.nalogi_nesvereny(stranica("32,7" + NB + "млрд" + NB + "₽", "185" + NB + "тыс." + NB + "₽")))
        x = K.nalogi_k_vyruchke_html(stranica("39" + NB + "млрд" + NB + "₽", "2" + NB + "млн" + NB + "₽"))
        self.assertEqual(x[0], 2025)
        self.assertAlmostEqual(x[3], 2e6 / 39e9)
        self.assertFalse(K.nalogi_nesvereny(stranica("108" + NB + "млрд" + NB + "₽", "174" + NB + "млн" + NB + "₽")))
        self.assertFalse(K.nalogi_nesvereny(stranica("32,7" + NB + "млрд" + NB + "₽", "185" + NB + "тыс." + NB + "₽", "2024")))
        self.assertFalse(K.nalogi_nesvereny(stranica("900" + NB + "млн" + NB + "₽", "1" + NB + "тыс." + NB + "₽")))

    def test_na_sajte_net_nesverennyh(self):
        plohie = []
        for p in sorted(glob.glob(os.path.join(KOREN, "company", "[0-9]*", "index.html"))):
            with open(p, encoding="utf-8") as fh:
                if K.nalogi_nesvereny(fh.read()):
                    plohie.append(os.path.basename(os.path.dirname(p)))
        self.assertEqual(plohie, [], "карточки с налогами < 0,01 % выручки — sobrat --dobavit снимает их")
        for inn in ("0273945361", "6163140887", "3604085475", "2100018421"):
            self.assertEqual(glob.glob(os.path.join(KOREN, "company", inn + "-*")), [])


if __name__ == "__main__":
    unittest.main()
