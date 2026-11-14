#!/usr/bin/env python3
"""kartochki-balans-sverka-v1 ([Ночные-2] 14.11): выручка года в 1 000+ раз больше баланса того же года (≥ 1 млрд ₽) —
карточку не публикуем до сверки единиц ГИР БО: новые — воротами, опубликованные — при perepechatat (по странице).
Запуск: python3 tests/test_kartochki_balans_sverka.py"""
import glob
import os
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochki as K  # noqa: E402

KOREN = str(pathlib.Path(__file__).resolve().parent.parent)
NB = "&nbsp;"


def stranica(vyr, kap, pay=None, god_bal="2025"):
    ras = ""
    if pay:
        ras = ('<h3 class="co-h3">Кто кому должен&#160;— расчёты ООО&nbsp;«Х» на&nbsp;31.12.%s</h3><div class="table-wrap">'
               '<table class="table"><thead><tr><th>Расчёты</th><th>Сумма</th><th>К&#160;выручке</th></tr></thead><tbody><tr>'
               '<td>Фирма должна поставщикам</td><td class="num">%s</td><td class="num"></td></tr></tbody></table></div>'
               % (god_bal, pay))
    return ('<section class="co-sec" aria-labelledby="fin"><h2 id="fin">Выручка</h2><div class="table-wrap"><table class="table">'
            '<thead><tr><th>Год</th><th>Выручка</th><th>Чистая прибыль</th></tr></thead><tbody><tr><td>2025</td>'
            '<td class="num">%s</td><td class="num">1' + NB + 'млн' + NB + '₽</td></tr></tbody></table></div></section>'
            '<section class="co-sec" aria-labelledby="bal"><h2 id="bal">Баланс и&#160;расчёты</h2><h3 class="co-h3">На&#160;чём '
            'держится ООО&nbsp;«Х»&#160;— баланс на&nbsp;31.12.%s</h3><div class="table-wrap"><table class="table"><thead><tr>'
            '<th>Источник средств</th><th>Сумма</th><th>Доля</th></tr></thead><tbody><tr><td>Собственный капитал</td>'
            '<td class="num">%s</td><td class="num">100' + NB + '%%</td></tr></tbody></table></div>%s</section>') % (vyr, god_bal, kap, ras)


class TestBalansSverka(unittest.TestCase):
    def test_slovar(self):
        k = {"finansy": [{"god": 2025, "dohod": 17.7e9}], "balans": {"god": 2025, "kap": 16e3, "dol": None, "kor": None}}
        self.assertGreaterEqual(K.vyruchka_k_balansu(k), K.BALANS_POROG)
        k["raschety"] = {"god": 2025, "rec": 900e6, "pay": None, "loan": None}  # расчёты того же года — мера баланса
        self.assertLess(K.vyruchka_k_balansu(k), K.BALANS_POROG)
        k2 = {"finansy": [{"god": 2025, "dohod": 900e6}], "balans": {"god": 2025, "kap": 1e3}}
        self.assertIsNone(K.vyruchka_k_balansu(k2))  # меньше 1 млрд ₽ — не трогаем
        k3 = {"finansy": [{"god": 2025, "dohod": 17.7e9}], "balans": {"god": 2024, "kap": 16e3}}
        self.assertIsNone(K.vyruchka_k_balansu(k3))  # баланс другого года — не мерило

    def test_vorota_prichina(self):
        k = {"finansy": [{"god": 2025, "dohod": 17.7e9}], "balans": {"god": 2025, "kap": 16e3, "dol": None, "kor": None}}
        vb = K.vyruchka_k_balansu(k)
        self.assertIn("выручка ×%d к балансу" % round(vb), "выручка ×%d к балансу того же года" % round(vb))
        src = open(os.path.join(KOREN, "tests", "kartochka_render.py"), encoding="utf-8").read()
        self.assertIn("vb >= BALANS_POROG", src)

    def test_html(self):
        self.assertTrue(K.balans_nesveren(stranica("17,7" + NB + "млрд" + NB + "₽", "16" + NB + "тыс." + NB + "₽")))
        # Сибирь: капитал 500 тыс., поставщикам 3,9 млн → мера 3,9 млн
        x = K.vyruchka_k_balansu_html(stranica("63,2" + NB + "млрд" + NB + "₽", "500" + NB + "тыс." + NB + "₽", "3,9" + NB + "млн" + NB + "₽"))
        self.assertEqual(x[0], 2025)
        self.assertAlmostEqual(x[2], 63.2e9 / 3.9e6, delta=1)
        self.assertFalse(K.balans_nesveren(stranica("17,7" + NB + "млрд" + NB + "₽", "20" + NB + "млн" + NB + "₽")))
        self.assertFalse(K.balans_nesveren(stranica("17,7" + NB + "млрд" + NB + "₽", "16" + NB + "тыс." + NB + "₽", god_bal="2024")))
        self.assertFalse(K.balans_nesveren(stranica("900" + NB + "млн" + NB + "₽", "1" + NB + "тыс." + NB + "₽")))

    def test_na_sajte_net_nesverennyh(self):
        plohie = []
        for p in sorted(glob.glob(os.path.join(KOREN, "company", "[0-9]*", "index.html"))):
            with open(p, encoding="utf-8") as fh:
                if K.balans_nesveren(fh.read()):
                    plohie.append(os.path.basename(os.path.dirname(p)))
        self.assertEqual(plohie, [], "карточки с выручкой ×1000+ к балансу — perepechatat снимает их")
        for inn in ("9726049490", "7203559982"):
            self.assertEqual(glob.glob(os.path.join(KOREN, "company", inn + "-*")), [])


if __name__ == "__main__":
    unittest.main()
