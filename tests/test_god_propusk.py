#!/usr/bin/env python3
"""god-propusk-v1 (17.11.2026): пропуск лет в таблице выручки — период явно («с 2022 по 2025 год», «чем в 2022 году»),
а не «за год» / «годом раньше»; рост выручки в 3 раза и больше — «в N раз», а не «на 3577 %».
Опубликованные карточки чинит pochinit_rost_vyruchki по таблице самой страницы (perepechatat)."""
import glob
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402
import sobrat_reyting as R  # noqa: E402

NB = K.NB
KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TAB = ('<section class="co-sec" aria-labelledby="fin"><h2 id="fin">Выручка выросла на&#160;3577&nbsp;% за&#160;год</h2>'
       '<table class="table"><thead><tr><th>Год</th><th>Выручка</th><th>Чистая прибыль</th></tr></thead><tbody>'
       '<tr><td>2025</td><td class="num">2,9&nbsp;млрд&nbsp;₽</td><td class="num">—</td></tr>'
       '<tr><td>2022</td><td class="num">79&nbsp;млн&nbsp;₽</td><td class="num">—</td></tr>'
       '<tr><td>2021</td><td class="num">93,4&nbsp;млн&nbsp;₽</td><td class="num">—</td></tr></tbody></table></section>'
       '<p>Выручка за&nbsp;2025&#160;— 2,9&nbsp;млрд&nbsp;₽, на&nbsp;3577&nbsp;% больше, чем годом раньше</p>')


class Slova(unittest.TestCase):
    def test_rost(self):
        self.assertEqual(K._rost_nb(0.77), "на" + NB + "77" + NB + "%")
        self.assertEqual(K._rost_nb(35.77), "в" + NB + "37" + NB + "раз")
        self.assertEqual(K._zn_rost(2.4), "в 3,4" + NB + "раза")
        self.assertEqual(K._zn_rost(0.31), "на 31" + NB + "%")
        self.assertEqual(R.rost_big(1766), "в" + NB + "19" + NB + "раз")
        self.assertEqual(R.rost_big(77), "+77" + NB + "%")

    def test_tochno_iz_v_raz(self):
        """Абзацы «Что это значит» берут N из «Коротко» и в новой форме «в N раз»."""
        d = K._zn_dl_tochno([("ok", "Выручка за 2025 — 2,1 млрд ₽, в 19 раз больше, чем годом раньше")])  # как _zn_txt
        self.assertEqual(d, {2025: 18.0})
        self.assertEqual(K._zn_rost(d[2025]), "в 19" + NB + "раз")

    def test_reyting_tolko_god_k_godu(self):
        self.assertEqual(R.procent("Выручка за 2025 — 302 млн ₽, на 65 % меньше, чем в 2022 году"), None)
        self.assertEqual(R.procent("Выручка за 2025 — 2,9 млрд ₽, в 37 раз больше, чем в 2022 году"), None)
        self.assertEqual(R.procent("Выручка за 2025 — 2,1 млрд ₽, в 19 раз больше, чем годом раньше"), 1800)
        self.assertEqual(R.procent("Выручка за 2025 — 1 млрд ₽, на 12 % меньше, чем годом раньше"), -12)


class Pochinka(unittest.TestCase):
    def test_propusk(self):
        u = K.pochinit_rost_vyruchki(TAB)
        self.assertIn('<h2 id="fin">Выручка выросла в 37' + NB + "раз с" + NB + "2022 по" + NB + "2025" + NB + "год</h2>", u)
        self.assertIn("₽, в" + NB + "37" + NB + "раз больше, чем в" + NB + "2022" + NB + "году", u)
        self.assertNotIn("годом раньше", u)
        self.assertNotIn("3577", u)
        self.assertEqual(K.pochinit_rost_vyruchki(u), u)

    def test_podryad_tolko_raz(self):
        t = TAB.replace("<td>2022</td>", "<td>2024</td>")
        u = K.pochinit_rost_vyruchki(t)
        self.assertIn("в" + NB + "37" + NB + "раз больше, чем годом раньше", u)
        self.assertIn("выросла в 37" + NB + "раз за&#160;год</h2>", u)

    def test_malyj_rost_ne_trogaem(self):
        t = TAB.replace("<td>2022</td>", "<td>2024</td>").replace("3577", "77")
        self.assertEqual(K.pochinit_rost_vyruchki(t), t)

    def test_bez_tablicy_ne_trogaem(self):
        t = '<p>Выручка за&nbsp;2025&#160;— 2,9&nbsp;млрд&nbsp;₽, на&nbsp;65&nbsp;% меньше, чем годом раньше</p>'
        self.assertEqual(K.pochinit_rost_vyruchki(t), t)  # проверить нечем — как было

    def test_render_vyvod(self):
        """Новая карточка: вывод «Коротко» при пропуске лет — к последнему году ряда; подряд — «годом раньше»."""
        import datetime as dt
        d = {"znachenie": 2.9e9, "god": 2025, "delta": 3577, "istochnik": "ГИР БО, бухгалтерская отчётность",
             "data": dt.date(2025, 12, 31)}
        k = {"fakty": {"dohod": d}, "proverka": dt.date(2026, 11, 1), "pribyl_ryad": {},
             "finansy": [{"god": 2021, "dohod": 93.4e6}, {"god": 2022, "dohod": 79e6}, {"god": 2025, "dohod": 2.9e9}]}
        self.assertTrue(K.vyvody(k)[0]["tekst"].endswith("в" + NB + "37" + NB + "раз больше, чем в" + NB + "2022" + NB + "году"))
        k["finansy"][1]["god"] = 2024
        self.assertTrue(K.vyvody(k)[0]["tekst"].endswith("в" + NB + "37" + NB + "раз больше, чем годом раньше"))
        d["delta"], k["finansy"] = -65, []
        self.assertTrue(K.vyvody(k)[0]["tekst"].endswith("на" + NB + "65" + NB + "% меньше, чем годом раньше"))


class Opublikovannye(unittest.TestCase):
    def test_storozh(self):
        """После perepechatat: нет «на 200+ % больше» у выручки и нет «годом раньше» / «за год», когда в таблице
        страницы между последними годами пропуск."""
        bad = []
        for f in glob.glob(os.path.join(KOREN, "company", "*", "index.html")):
            with open(f, encoding="utf-8") as fh:
                t = K.bez_tipografa(fh.read())
            if K.pochinit_rost_vyruchki(t) != t:
                bad.append(os.path.basename(os.path.dirname(f)))
        self.assertEqual(bad, [], "карточки не перепечатаны: python3 tests/kartochki.py perepechatat")

    def test_rejting_bez_propuska(self):
        p = os.path.join(KOREN, "reyting", "index.html")
        if os.path.exists(p):
            with open(p, encoding="utf-8") as fh:
                t = fh.read()
            big = [int(x) for x in re.findall(r'ry-big">\+(\d+)', t)]
            self.assertEqual([x for x in big if x >= 200], [], "рост ×3+ в рейтинге — «в N раз»")


if __name__ == "__main__":
    unittest.main()
