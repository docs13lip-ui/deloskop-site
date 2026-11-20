"""otrasl-na-kartochke-v1 ([Ночные-2] 18.11): карточка /company/ — рентабельность активов и налоги со взносами против средних
ФНС по отрасли (data/fns-normy-2025.json) словом «выше / на уровне / ниже средней»; при чистой прибыли больше выручки —
«средние по отрасли не применимы», и ни одной доли «к выручке» от 100 % в «Разборе», «Что это значит» и балансе
(решение владельца 18.11, разд. 3 п. 6 и п. 20: «не повторить ошибку 93 211 %», сторож на «Магните»)."""
import html
import json
import os
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = Path(__file__).resolve().parent.parent
NB = K.NB
D = json.loads((KOREN / "data" / "fns-normy-2025.json").read_text(encoding="utf-8"))
MAGNIT = "2309085638-magnit"
SLOVA = {"выше средней", "на уровне средней", "ниже средней"}


def txt(s):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s)).replace(NB, " ").replace(" ", " ").split())


def kartochki():
    for p in sorted((KOREN / "company").glob("*/index.html")):
        yield p.parent.name, p.read_text(encoding="utf-8")


def chislo(s):
    return float(s.replace(" ", "").replace(",", "."))


class TestRaschet(unittest.TestCase):
    def test_slovo(self):
        self.assertEqual(K.otr_slovo(3.0, 3.4), "ниже средней")
        self.assertEqual(K.otr_slovo(3.2, 3.4), "на уровне средней")
        self.assertEqual(K.otr_slovo(3.75, 3.4), "выше средней")
        self.assertEqual(K.otr_slovo(-1, 3.4), "ниже средней")
        self.assertEqual(K.otr_slovo(5, 0), "")  # «отр» и ноль — без сравнения

    def test_normy(self):
        N = K.otr_normy("41.20.9", 2025, D)
        self.assertEqual(N["nagr"][1:], (15.0, 5.1))
        self.assertTrue(N["rent"][0].startswith("Строительство"))
        self.assertIsNone(K.otr_normy("41.20", 2023, D))  # норм за 2023 в справочнике нет — блока нет
        self.assertIsNone(K.otr_normy("41.20", 2025, None))


class TestKartochki(unittest.TestCase):
    def test_magnit_storozh(self):
        t = (KOREN / "company" / MAGNIT / "index.html").read_text(encoding="utf-8")
        s = txt(t)
        self.assertIn("co-otrs--golova", t)
        self.assertIn("к такой компании не применимы", s)
        self.assertNotIn('class="co-otrs"', t)
        self.assertNotIn("1299", s)
        self.assertNotIn("раз больше выручки за 2025", s)
        self.assertNotIn("сделка от", s)
        # ne-svereno-kartochki-v1 (21.11): выручка 2025 = 2024 до рубля — не сверена, на карточке последний сверенный 2024
        self.assertIn("больше выручки в 155 раз", s)

    def test_golovnye_bez_dolej_bolshe_100(self):
        n = 0
        for papka, t in kartochki():
            if "co-otrs--golova" not in t:
                continue
            n += 1
            s = txt(t)
            for m in re.finditer(r"(\d[\d ]*(?:,\d+)?) ?% выручки", s):
                self.assertLess(chislo(m.group(1)), 100, (papka, s[m.start() - 60:m.end()]))
            for m in re.finditer(r"рентабельност\w* за \d{4}(?: год)? — (\d[\d ]*(?:,\d+)?) ?%", s):
                self.assertLess(chislo(m.group(1)), 100, papka)
            self.assertNotRegex(s, r"раза? больше выручки за \d{4}", papka)
            self.assertNotIn("самая высокая в разделе чистая рентабельность", s.lower(), papka)
            self.assertNotRegex(s, r"С каждых 100 ₽ выручки", papka)
        self.assertGreaterEqual(n, 1)

    def test_blok(self):
        n = 0
        for papka, t in kartochki():
            for b in re.findall(r'<div class="co-otrs".*?</div>', t, re.S):
                n += 1
                s = txt(b)
                self.assertNotIn("co-otrs--golova", t, papka)
                slova = re.findall(r'<b class="co-otrs__s">([^<]*)</b>', b)
                self.assertTrue(slova and set(x.replace(NB, " ") for x in slova) <= SLOVA, (papka, slova))
                self.assertIn("не вывод о компании", s)
                self.assertRegex(s, r"Информация ФНС от (05\.05\.2026|07\.05\.2025)")
                self.assertFalse(K.STOP_SLOVA.search(s), papka)
                if "Налоги и взносы к выручке" in s:
                    self.assertIn("нет НДФЛ за работников", s, papka)
                self.assertNotRegex(t, r'co-okved">[^<]*<span class="num">(64\.1|65)', papka)
        self.assertGreater(n, 100)

    def test_odin_raz_i_povtor(self):
        for papka, t in kartochki():
            self.assertLessEqual(t.count("<!--co-otrs-->"), 1, papka)
        t = K.bez_tipografa((KOREN / "company" / "2609024114-agrostrojpodryad" / "index.html").read_text(encoding="utf-8"))
        K.otr_ustanovit(D)
        try:
            self.assertEqual(K.otrasl_na_kartochke(t).replace(NB, "&nbsp;"), t.replace(NB, "&nbsp;"))
        finally:
            K.otr_ustanovit(None)


if __name__ == "__main__":
    unittest.main()
