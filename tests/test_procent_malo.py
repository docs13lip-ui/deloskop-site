#!/usr/bin/env python3
"""procent-malo-v1 (17.11.2026): доля меньше 0,05 % — не «0 %», рост прибыли в 3 раза и больше — «в N раз».
Опубликованные карточки чинит pochinit_procenty по числам самой страницы (perepechatat)."""
import os
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

NB = K.NB
KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Procenty(unittest.TestCase):
    def test_malye_ne_nol(self):
        self.assertEqual(K._proc(283e6 / 1.8e12), "0,016" + NB + "%")
        self.assertEqual(K._proc(-0.000003), "−0,0003" + NB + "%")
        self.assertEqual(K._zn_proc(0.0004), "0,04" + NB + "%")
        self.assertEqual(K._proc(0), "0" + NB + "%")          # настоящий ноль — ноль
        self.assertEqual(K._proc(0.0072), "0,7" + NB + "%")   # обычные — как были
        self.assertEqual(K._proc(0.153), "15" + NB + "%")

    def test_rost_v_raz(self):
        self.assertEqual(K._raz(100, 100 + 6531), "66" + NB + "раз")
        self.assertEqual(K._raz(100, 340), "3,4" + NB + "раза")

    def test_pochinka_stranicy(self):
        t = ('<section class="co-sec" aria-labelledby="fin"><h2 id="fin">Выручка</h2><table class="table"><thead><tr><th>Год</th>'
             '<th>Выручка</th><th>Чистая прибыль</th></tr></thead><tbody>'
             '<tr><td>2021</td><td class="num">2&nbsp;трлн&nbsp;₽</td><td class="num">18,8&nbsp;млрд&nbsp;₽</td></tr>'
             '<tr><td>2020</td><td class="num">1,8&nbsp;трлн&nbsp;₽</td><td class="num">283&nbsp;млн&nbsp;₽</td></tr></tbody></table>'
             '</section><p>Чистая прибыль за&nbsp;2021&#160;— 18,8&nbsp;млрд&nbsp;₽, на&nbsp;6531&nbsp;% больше, чем годом раньше</p>'
             '<p>Чистая рентабельность за&nbsp;2021&#160;— 0,9&nbsp;%, годом раньше&#160;— 0&nbsp;%.</p>')
        u = K.pochinit_procenty(t)
        self.assertIn("в" + NB + "66" + NB + "раз больше, чем годом раньше", u)
        self.assertIn("годом раньше&#160;— 0,016&nbsp;%.", u)
        self.assertNotIn("6531", u)
        self.assertEqual(K.pochinit_procenty(u), u)  # повтор ничего не меняет

    def test_net_chisla_ne_trogaem(self):
        t = '<p>Чистая рентабельность за&nbsp;2025&#160;— 0&nbsp;%, годом раньше&#160;— 1,1&nbsp;%.</p>'
        self.assertEqual(K.pochinit_procenty(t), t)  # таблицы нет — ноль мог быть настоящим
        t2 = '<p>Собственный капитал: 100&nbsp;%; обязательства&#160;— 0&nbsp;% (долгосрочные меньше 1&nbsp;%)</p>'
        self.assertEqual(K.pochinit_procenty(t2), t2)  # доли баланса — не наше

    def test_na_opublikovannyh_net_nolya(self):
        """Сторож: после perepechatat на карточках нет «рентабельность/налоги — 0 %» при ненулевой прибыли в таблице
        и нет «Чистая прибыль … на 200+ % больше»."""
        import glob
        import re
        bad = []
        for f in glob.glob(os.path.join(KOREN, "company", "*", "index.html")):
            with open(f, encoding="utf-8") as fh:
                t = fh.read()
            u = K.pochinit_procenty(K.bez_tipografa(t))
            if u != K.bez_tipografa(t):
                bad.append(os.path.basename(os.path.dirname(f)))
        self.assertEqual(bad, [], "карточки не перепечатаны: python3 tests/kartochki.py perepechatat")


class JsNagruzka(unittest.TestCase):
    def test_js_pct(self):
        kod = ("const m=require(%r);console.log([m.pct(0.016),m.pct(-0.003),m.pct(0),m.pct(2.64)].join('|'))"
               % os.path.join(KOREN, "js", "nagruzka-proverka.js"))
        out = subprocess.run(["node", "-e", kod], capture_output=True, text=True).stdout.strip()
        self.assertEqual(out, "|".join(["0,016" + NB + "%", "−0,003" + NB + "%", "0,0" + NB + "%", "2,6" + NB + "%"]))


if __name__ == "__main__":
    unittest.main()
