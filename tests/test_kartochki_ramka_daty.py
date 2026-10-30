#!/usr/bin/env python3
"""kartochki-ramka-daty-v1 (30.10.2026, [Ночные-2]; решение владельца 30.10 «уникальность — приоритет 1»): две служебные
строки карточек /company/, стоявшие дословно на всех 167 («Здесь — выводы по фактам на дату карточки.» и «ФНС обновляет
набор раз в месяц.»), теперь называют дату со страницы, а строка набора — и компанию («для ООО «…»»). Сторож: (1) на
опубликованных карточках старых формулировок нет, дата в строке Индекса = первая дата ЕГРЮЛ страницы, дата в строке набора
= дата сведений строки недоимки над ней; (2) ramka_daty идемпотентна; (3) без имени с формой (ООО, АО…) строка набора
прежняя; (4) без даты ЕГРЮЛ строка Индекса прежняя."""
import glob
import html
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LD = ('<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization",'
      '"name":"%s"}]}</script>')
IND = '<p class="caption">Балл. Здесь&nbsp;— выводы по&#160;фактам на&#160;дату карточки.</p>'
EGR = '<span class="co-src">ЕГРЮЛ · сведения на&#160;25.10.2026 · ● подтверждено источником</span>'
NED = ('<div class="fact"><span>Задолженность по налогам</span><span class="fact__v">Нет</span><span class="fact__src co-src">'
       'ФНС, открытые данные · сведения на 01.09.2026 · ● подтверждено источником</span></div>'
       '<p class="co-nabor">ФНС обновляет набор раз в&nbsp;месяц.</p>')


def stranica(imya="ООО «Тест»", egr=True):
    return "<head>%s</head><main>%s%s%s</main>" % (LD % imya, IND, EGR if egr else "", NED)


def tekst(t):
    return html.unescape(re.sub(r"<[^>]+>", " ", t)).replace(" ", " ").replace(" ", " ")


class TestRamkaDaty(unittest.TestCase):
    def test_stroki(self):
        t = K.ramka_daty(stranica())
        self.assertIn("Здесь — выводы по фактам, собранным 25.10.2026.", tekst(t))
        self.assertIn("ФНС обновляет набор раз в месяц; для ООО «Тест» здесь — набор на 01.09.2026.", tekst(t))

    def test_idempotentna(self):
        t = K.ramka_daty(stranica())
        self.assertEqual(K.ramka_daty(t), t)
        self.assertEqual(K.ramka_daty(K.tipograf_kartochki(t)), K.tipograf_kartochki(t))

    def test_bez_formy(self):
        t = K.ramka_daty(stranica(imya="ГК Пример"))
        self.assertIn("ФНС обновляет набор раз в месяц.", tekst(t))
        self.assertIn("собранным 25.10.2026", tekst(t))

    def test_bez_daty_egryul(self):
        t = K.ramka_daty(stranica(egr=False))
        self.assertIn("Здесь — выводы по фактам на дату карточки.", tekst(t))

    def test_opublikovannye(self):
        fajly = sorted(glob.glob(os.path.join(KOREN, "company", "[0-9]" * 10 + "-*", "index.html")))
        if not fajly:
            self.skipTest("карточек нет")
        s_imenem = 0
        for f in fajly:
            with open(f, encoding="utf-8") as fh:
                t = fh.read()
            main = re.search(r"<main.*?</main>", t, re.S).group(0)
            tx = tekst(main)
            self.assertNotIn("на дату карточки", tx, f)
            m = re.search(r"[Зз]десь — выводы по фактам, собранным (\d{2}\.\d{2}\.\d{4})\.", tx)
            e = re.search(r"ЕГРЮЛ · сведения на\s*(\d{2}\.\d{2}\.\d{4})", tx)
            if e:
                self.assertTrue(m, f)
                self.assertEqual(m.group(1), e.group(1), f)
            n = re.search(r"сведения на\s*(\d{2}\.\d{2}\.\d{4})[^·]*· ● подтверждено источником\s*ФНС обновляет набор раз в месяц"
                          r"(?:; для (.{3,120}?) здесь — набор на (\d{2}\.\d{2}\.\d{4}))?\.", tx)
            if n and n.group(2):
                s_imenem += 1
                self.assertEqual(n.group(3), n.group(1), f)
                self.assertFalse(K.STOP_SLOVA.search(n.group(2)), f)
        self.assertGreater(s_imenem, len(fajly) // 2)


if __name__ == "__main__":
    unittest.main()
