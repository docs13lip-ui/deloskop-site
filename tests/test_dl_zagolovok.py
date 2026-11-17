#!/usr/bin/env python3
"""dl-zagolovok-v1 (17.11.2026, [Ночные]): изменение выручки к прошлому году на карточке /company/ — одно число.
На карточках без вывода «Выручка за ГГГГ — …» в «Коротко» заголовок раздела говорил «Выручка снизилась на 7 % за год»
(точные суммы при сборке), а «Что это значит» и «Перед оплатой» — «на 7,9 % ниже» (округлённые суммы таблицы
«6,3 / 5,8 трлн ₽»). Сторож: (1) на всех опубликованных карточках без вывода «Коротко» числа «на N % ниже»,
«выросла на N %, до», «на N % больше прошлогоднего», «последний, ГГГГ год — спад на N %» равны числу заголовка;
(2) _zn_dl_h2 берёт только «за год» / «за ГГГГ год» последнего года таблицы; (3) zn_dl: «Коротко» → заголовок → таблица."""
import glob
import html
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_H2 = re.compile(r'<h2 id="fin">Выручка (?:выросла|снизилась) на ([\d,]+) % за(?: \d{4})? год</h2>')
_V = re.compile(r"Выручка за \d{4} — [\d,]+ (?:трлн|млрд|млн|тыс\.) ₽, (?:на|в) [\d,]+ (?:%|раза?) (?:больше|меньше), чем")
_U = re.compile(r"выросла на ([\d,]+) %, до|на ([\d,]+) % ниже|на ([\d,]+) % больше прошлогоднего|"
                r"выросшей на ([\d,]+) %|год упала на ([\d,]+) %|последний, \d{4} год — спад на ([\d,]+) %")
NB = " "


def _chist(t):
    return html.unescape(t).replace(NB, " ")


class TestOpublikovannye(unittest.TestCase):
    def test_odno_chislo(self):
        n, plohie = 0, []
        for f in sorted(glob.glob(os.path.join(KOREN, "company", "*", "index.html"))):
            with open(f, encoding="utf-8") as fh:
                syroj = _chist(fh.read())
            h = _H2.search(syroj)
            t = re.sub(r"<[^>]+>", " ", syroj)
            if not h or _V.search(t):
                continue
            for g in _U.findall(t):
                n += 1
                if next(x for x in g if x) != h.group(1):
                    plohie.append((os.path.basename(os.path.dirname(f)), h.group(1), next(x for x in g if x)))
        self.assertGreater(n, 30)
        self.assertEqual(plohie[:5], [])


class TestZnDlH2(unittest.TestCase):
    RYAD = [{"god": 2023, "dohod": 5.6e12}, {"god": 2024, "dohod": 6.3e12}, {"god": 2025, "dohod": 5.8e12}]

    def h2(self, t):
        return '<section class="co-sec" aria-labelledby="fin"><h2 id="fin">%s</h2></section>' % t

    def test_spad_za_god(self):
        d = K._zn_dl_h2(self.h2("Выручка снизилась на&#160;7&nbsp;% за&#160;год"), self.RYAD)
        self.assertEqual(list(d), [2025])
        self.assertAlmostEqual(d[2025], -0.07)

    def test_rost_v_raz(self):
        d = K._zn_dl_h2(self.h2("Выручка выросла в&#160;3,4&#160;раза за&#160;год"), self.RYAD)
        self.assertAlmostEqual(d[2025], 2.4)

    def test_god_v_zagolovke(self):
        ryad = [{"god": 2020, "dohod": 1e9}, {"god": 2021, "dohod": 1.08e9}]
        d = K._zn_dl_h2(self.h2("Выручка выросла на&#160;8&nbsp;% за&#160;2021&#160;год"), ryad)
        self.assertAlmostEqual(d[2021], 0.08)

    def test_ne_berem(self):
        # пропуск лет («с … по …»), «почти не изменилась», «Доход», год не последний — не берём
        for t in ("Выручка выросла в&#160;37&#160;раз с&#160;2022 по&#160;2025&#160;год",
                  "Выручка почти не изменилась за&#160;год", "Доход вырос на&#160;8&nbsp;% за&#160;год",
                  "Выручка выросла на&#160;8&nbsp;% за&#160;2024&#160;год"):
            self.assertEqual(K._zn_dl_h2(self.h2(t), self.RYAD), {}, t)
        propusk = [{"god": 2022, "dohod": 1e9}, {"god": 2025, "dohod": 2e9}]
        self.assertEqual(K._zn_dl_h2(self.h2("Выручка выросла на&#160;8&nbsp;% за&#160;год"), propusk), {})

    def test_poryadok(self):
        p0, p1 = self.RYAD[1], self.RYAD[2]
        self.assertAlmostEqual(K.zn_dl({"dl_tochno": {}, "dl_h2": {2025: -0.07}}, p1, p0), -0.07)
        self.assertAlmostEqual(K.zn_dl({"dl_tochno": {2025: -0.075}, "dl_h2": {2025: -0.07}}, p1, p0), -0.075)
        self.assertAlmostEqual(K.zn_dl({}, p1, p0), 5.8 / 6.3 - 1)

    def test_spad_poslednego_goda(self):
        ryad = [{"god": 2023, "dohod": 10e9}, {"god": 2024, "dohod": 16.9e9}, {"god": 2025, "dohod": 16e9}]
        self.assertAlmostEqual(K._un_put(ryad, -0.06)[2], 0.06)
        self.assertAlmostEqual(K._un_put(ryad)[2], 1 - 16 / 16.9)


if __name__ == "__main__":
    unittest.main()
