#!/usr/bin/env python3
"""kartochki-unik-v6 ([Ночные-2] 19.10): «Перед оплатой» без замечаний — совет из фактов страницы (движение выручки,
дата сведений о налогах, возраст в реестре, руководитель), а не одна строка «замечаний нет — остаётся сверить счёт»
на 113 карточках. Запуск: python3 tests/test_kartochki_unik6.py"""
import datetime as dt
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochka_render as R  # noqa: E402

NB = "\u00a0"
KOREN = pathlib.Path(__file__).resolve().parent.parent / "company"


def fakty(ryad, V=(), inn="7700000000", osnovana=dt.date(2001, 1, 1)):
    return {"imya": "ООО «Ромашка»", "inn": inn, "osnovana": osnovana, "na": dt.date(2026, 10, 1), "V": list(V),
            "ryad": [{"god": g, "dohod": d, "pribyl": p} for g, d, p in ryad], "otrasl": None}


class TestPered(unittest.TestCase):
    def test_spad_i_rost(self):
        s = R.un_pered(fakty([(2024, 1e9, 1e7), (2025, 9e8, 1e7)]))
        self.assertEqual(len(s), 2)
        self.assertIn("на 10 % ниже, чем за 2024", s[0].replace(NB, " "))
        s = R.un_pered(fakty([(2024, 1e9, 1e7), (2025, 1.5e9, 1e7)]))
        self.assertIn("выросла на 50 %, до 1,5 млрд ₽", s[0].replace(NB, " "))
        self.assertTrue(s[1].startswith("Счёт от «Ромашка»: сверьте ИНН"))

    def test_nalog_i_vozrast_po_inn(self):
        V = [("ok", "Налоговой задолженности в данных ФНС нет (на 1 сентября 2026)")]
        r = [(2024, 1.1e9, 1e7), (2025, 1.2e9, 1e7)]
        a = R.un_pered(fakty(r, V, inn="7700000000"))[0].replace(NB, " ")
        b = R.un_pered(fakty(r, V, inn="7700000001"))[0].replace(NB, " ")
        self.assertIn("Налогового долга у «Ромашка» не было на 1 сентября 2026", a)
        self.assertIn("100 млн ₽ (средняя месячная выручка за 2025)", a)
        self.assertIn("в реестре с 2001 года", b)

    def test_zamechaniya_ne_trogaet(self):
        s = R.un_pered(fakty([(2024, 1e9, 1e7), (2025, 1e9, -5e7)]))
        self.assertTrue(any("убыток" in x for x in s))

    def test_net_faktov(self):
        s = R.un_pered(fakty([(2024, 1e9, 1e7), (2025, 1.1e9, 1e7)], osnovana=dt.date(2020, 1, 1)))
        self.assertEqual(len(s), 1)
        self.assertIn("замечаний нет", s[0])

    def test_opublikovannye(self):
        vse = list(KOREN.glob("*/index.html"))
        if not vse:
            self.skipTest("карточек нет")
        n = sum("замечаний нет — перед оплатой" in p.read_text(encoding="utf-8").replace("&nbsp;", NB) for p in vse)
        self.assertLessEqual(n, 10, "одна строка «замечаний нет» снова на многих карточках")
        for p in vse:
            t = p.read_text(encoding="utf-8")
            i = t.find('<h2 id="pered">')
            if i >= 0:
                self.assertFalse(R.STOP_SLOVA.search(t[i:t.find("</section>", i)]), p)


if __name__ == "__main__":
    unittest.main()
