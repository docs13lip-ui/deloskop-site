#!/usr/bin/env python3
"""kartochki-unik-v8 ([Ночные-2] 20.10): «Перед оплатой» у карточек без замечаний — совет из пула фактов страницы
(прибыль упала ≥ 20 %, адрес без отметки о недостоверности, документ приёмки по разделу ОКВЭД, налоги, руководитель /
возраст в реестре), а не два совета по чётности ИНН. Запуск: python3 tests/test_kartochki_unik8.py"""
import collections
import pathlib
import re
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochka_render as R  # noqa: E402

NB = "\u00a0"
KOREN = pathlib.Path(__file__).resolve().parent.parent / "company"


def fakty(**kw):
    f = {"imya": "ООО «Ромашка»", "inn": "7700000000", "osnovana": None, "na": None, "otrasl": None,
         "ryad": [{"god": 2024, "dohod": 1e9, "pribyl": 1e8}, {"god": 2025, "dohod": 1.05e9, "pribyl": 5e7}],
         "V": [("ok", "Налоговой задолженности в данных ФНС нет (на 1 сентября 2026)"),
               ("ok", "Адрес и руководитель в реестре — без отметок о недостоверности"),
               ("info", "Чистая прибыль за 2025 — 50 млн ₽, на 50 % меньше, чем годом раньше")],
         "gorod": "Казань", "razdel": "Торговля"}
    f.update(kw)
    return f


class TestPul(unittest.TestCase):
    def test_varianty(self):
        v = R.un_pered_varianty(fakty())
        tekst = " ".join(v).replace(NB, " ")
        self.assertIn("Налогового долга у «Ромашка» не было на 1 сентября 2026", tekst)
        self.assertIn("на 50 % меньше, чем годом раньше: крупный аванс разбейте на этапы", tekst)
        self.assertIn("Адрес «Ромашка» в ЕГРЮЛ (Казань) — без отметки о недостоверности", tekst)
        self.assertIn("Товар от «Ромашка» принимайте по УПД", tekst)
        self.assertEqual(len(v), len(set(v)))
        for s in v:
            self.assertFalse(R.STOP_SLOVA.search(s), s)

    def test_vybor_po_inn_i_postoyanen(self):
        vse = set()
        for i in range(12):
            f = fakty(inn="7700000%03d" % i)
            s = R._un_pered_fakt(f)
            self.assertEqual(s, R._un_pered_fakt(f))
            vse.add(re.sub(r"«[^»]*»", "«X»", s)[:30])
        self.assertGreaterEqual(len(vse), 4)

    def test_dvizhenie_vyruchki_pervym(self):
        f = fakty(ryad=[{"god": 2024, "dohod": 1e9, "pribyl": 1e8}, {"god": 2025, "dohod": 8e8, "pribyl": 5e7}])
        v = R.un_pered_varianty(f)
        self.assertEqual(len(v), 1)
        self.assertIn("ниже, чем за", v[0])

    def test_adres_formulirovka_prava(self):
        # ✏ [Право] 20.10: юридически значимые сообщения можно направить и по адресу ЕГРЮЛ (ст. 165.1 ГК) —
        # не «по нему направляют», а «удобно направлять»; «надёжный адрес» не писать.
        v = " ".join(R.un_pered_varianty(fakty()))
        self.assertIn("удобно направлять претензии и документы", v.replace("\u00a0", " ").replace("&nbsp;", " "))
        for p in [R.__file__] + list(KOREN.glob("*/index.html")):
            t = open(p, encoding="utf-8").read()
            self.assertNotIn("направляют претензии", t, p)
            self.assertNotIn("надёжный адрес", t, p)

    def test_bez_faktov(self):
        f = fakty(V=[], gorod="", razdel="", inn="7700000001")
        self.assertIsNone(R._un_pered_fakt(f))

    def test_opublikovannye(self):
        vse = list(KOREN.glob("*/index.html"))
        if not vse:
            self.skipTest("карточек нет")
        c = collections.Counter()
        n = 0
        for p in vse:
            t = p.read_text(encoding="utf-8")
            m = re.search(r'<h2 id="pered">Перед оплатой</h2><ul><li>(.*?)</li>', t, re.S)
            if not m:
                continue
            n += 1
            c[re.sub(r"«[^»]*»", "«X»", re.sub(r"<[^>]+>", "", m.group(1)))[:25]] += 1
        self.assertLessEqual(c.get("«X» в реестре с&nbsp;", 0), 25)
        self.assertLess(max(c.values()) / max(n, 1), 0.2, c.most_common(3))


if __name__ == "__main__":
    unittest.main()
