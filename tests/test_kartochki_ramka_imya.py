#!/usr/bin/env python3
"""kartochki-ramka-imya-v1 (30.10.2026, [Ночные-2]; решение владельца 30.10 «уникальность»): служебные фразы карточек
/company/ — в одном предложении с названием компании. Сторож: на опубликованных карточках нет отдельных предложений
«Здесь — выводы по фактам…», «У каждого факта — источник…» и подписи «◆ Расчёт Делоскопа по открытым данным.» без
названия; ramka_imya идемпотентна."""
import glob
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class TestRamkaImya(unittest.TestCase):
    def test_opublikovannye(self):
        n = 0
        for f in sorted(glob.glob(os.path.join(KOREN, "company", "*", "index.html"))):
            with open(f, encoding="utf-8") as fh:
                t = fh.read()
            txt = K._bv_t(re.sub(r"<[^>]+>", " ", t))
            if "Балл от 1 до 99" not in txt:
                continue
            n += 1
            self.assertNotIn(". Здесь — выводы по фактам", txt, f)
            self.assertNotIn(". У каждого факта — источник", txt, f)
            self.assertNotIn("◆ Расчёт Делоскопа по открытым данным.", txt, f)
            self.assertEqual(K.tipograf_kartochki(K.ramka_imya(K.bez_tipografa(t)), chisla=True), t, f)
        self.assertGreater(n, 140)

    def test_shablon(self):
        t = ('<script type="application/ld+json">{"@graph":[{"@type":"Organization","name":"ООО «Икс»","taxID":"7707083893"}]}</script>'
             '<p>считаем на сегодняшних данных, когда собрано не меньше 60 % сведений. Здесь — выводы по фактам.</p>'
             '<p>документы, которые стоит запросить. У каждого факта — источник и дата.</p>'
             '<p class="caption">◆ Расчёт Делоскопа по открытым данным. Условия</p>')
        r = K.ramka_imya(t)
        self.assertIn("сведений; здесь — выводы", r)
        self.assertIn("запросить; у каждого факта", r)
        self.assertIn("◆ Расчёт Делоскопа для «Икс» по открытым данным.", r)
        self.assertEqual(K.ramka_imya(r), r)


if __name__ == "__main__":
    unittest.main()
