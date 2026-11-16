#!/usr/bin/env python3
"""kartochki-skachok-v3 ([Ночные-2] 16.11): ворота «скачок выручки ×100» не отключаются пропуском года в ряду
(сравнение — с последним годом, где выручка > 0) и применяются к опубликованным карточкам по странице при
sobrat --dobavit — как ворота баланса и налогов.
Запуск: python3 tests/test_kartochki_skachok_v3.py"""
import glob
import os
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochki as K  # noqa: E402

KOREN = str(pathlib.Path(__file__).resolve().parent.parent)
NB = "&nbsp;"


def stranica(stroki):
    tb = "".join('<tr><td>%d</td><td class="num">%s</td><td class="num">0' % (g, v) + NB + "₽</td></tr>" for g, v in stroki)
    return ('<div class="table-wrap"><table class="table"><thead><tr><th>Год</th><th>Выручка</th><th>Чистая прибыль</th>'
            '</tr></thead><tbody>%s</tbody></table></div>') % tb


GLAVHLEB = [(2025, "125" + NB + "млрд" + NB + "₽"), (2023, "0" + NB + "₽"), (2022, "141" + NB + "тыс." + NB + "₽"),
            (2021, "0" + NB + "₽"), (2020, "593" + NB + "тыс." + NB + "₽")]


class TestSkachokV3(unittest.TestCase):
    def test_propusk_goda(self):
        k = {"finansy": [{"god": 2022, "dohod": 1.41e5}, {"god": 2023, "dohod": 0}, {"god": 2025, "dohod": 1.25e11}]}
        self.assertGreater(K.skachok_vyruchki(k), K.SKACHOK_POROG)
        k = {"finansy": [{"god": 2022, "dohod": 4e7}, {"god": 2025, "dohod": 6e8}]}
        self.assertLess(K.skachok_vyruchki(k), K.SKACHOK_POROG)
        self.assertIsNone(K.skachok_vyruchki({"finansy": [{"god": 2023, "dohod": 0}, {"god": 2025, "dohod": 5e9}]}))

    def test_ryad_so_stranicy(self):
        r = K.ryad_vyruchki_html(stranica(GLAVHLEB))
        self.assertEqual([x["god"] for x in r], [2020, 2021, 2022, 2023, 2025])
        self.assertEqual(r[-1]["dohod"], 1.25e11)
        self.assertEqual(r[2]["dohod"], 1.41e5)
        self.assertEqual(K.ryad_vyruchki_html("<p>нет таблицы</p>"), [])

    def test_html(self):
        self.assertTrue(K.skachok_nesveren(stranica(GLAVHLEB)))
        self.assertFalse(K.skachok_nesveren(stranica([(2025, "54,2" + NB + "млрд" + NB + "₽"),
                                                      (2024, "41" + NB + "млрд" + NB + "₽")])))
        self.assertFalse(K.skachok_nesveren(stranica([(2025, "5" + NB + "млрд" + NB + "₽")])))

    def test_dobavit_snimaet(self):
        src = open(os.path.join(KOREN, "tests", "kartochki.py"), encoding="utf-8").read()
        self.assertIn("or skachok_nesveren(t_)", src)

    def test_na_sajte_net_skachkov(self):
        plohie = []
        for p in sorted(glob.glob(os.path.join(KOREN, "company", "[0-9]*", "index.html"))):
            with open(p, encoding="utf-8") as fh:
                if K.skachok_nesveren(fh.read()):
                    plohie.append(os.path.basename(os.path.dirname(p)))
        self.assertEqual(plohie, [], "карточки со скачком выручки ×100+ — sobrat --dobavit снимает их")
        self.assertEqual(glob.glob(os.path.join(KOREN, "company", "7729442810-*")), [])


if __name__ == "__main__":
    unittest.main()
