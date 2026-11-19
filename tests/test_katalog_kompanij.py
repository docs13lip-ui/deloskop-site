#!/usr/bin/env python3
"""katalog-kompanij-v1 (решение владельца 18.11, Н5): /company/ — «Каталог» со всеми отраслями и регионами, где есть
карточки; страницы групп — от HAB_STRANICA_OT карточек (в индекс — от HAB_GRUPPY_OT), по HAB_GRUPPY_NA на страницу,
карточки — по обороту (большой первым). Проверяет и собранное в репозитории, и правила на образце."""
import html
import os
import pathlib
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochki as K  # noqa: E402

KOREN = pathlib.Path(__file__).resolve().parent.parent


def chitat(p):
    return pathlib.Path(p).read_text(encoding="utf-8")


def k_(inn, name, otr, reg, dohod=None):
    k = {"inn": inn, "name": name, "region": reg, "gorod": "", "okved": "", "razdel": otr, "fakty": {}}
    if dohod:
        k["fakty"]["dohod"] = {"znachenie": dohod, "god": 2025}
    return k


class Pravila(unittest.TestCase):
    def test_porogi(self):
        self.assertEqual(K.HAB_STRANICA_OT, 10)
        self.assertEqual(K.HAB_GRUPPY_OT, 30, "порог индекса не трогаем")
        self.assertEqual(K.HAB_GRUPPY_NA, 50)

    def test_po_oborotu(self):
        vse = [k_("7700000001", "Б", "Торговля", "Москва", 5e6), k_("7700000002", "А", "Торговля", "Москва"),
               k_("7700000003", "В", "Торговля", "Москва", 9e9), k_("7700000004", "Г", "Торговля", "Москва", 5e6)]
        g = K.gruppy_haba(vse, 1)
        self.assertEqual([x["inn"] for x in g[0]["kart"]], ["7700000003", "7700000001", "7700000004", "7700000002"])

    def test_katalog_ssylki(self):
        vse = [k_("77000000%02d" % i, "К%d" % i, "Торговля" if i < 3 else "Строительство", "Москва" if i < 2 else "Тверская область")
               for i in range(5)]
        kg = {("otrasl", "Торговля"): "/company/otrasl/torgovlya/"}
        t = K.katalog_html(vse, kg, {"Строительство"})
        self.assertIn('<a href="/company/otrasl/torgovlya/">Торговля</a><span class="caption num">3</span>', t)
        self.assertIn('<a href="#%s">Строительство</a>' % K.yakor_otrasli("Строительство"), t)
        self.assertIn("<span>Москва</span>", t, "регион без страницы — текстом, без битой ссылки")
        self.assertNotIn("Отрасль не указана", t)
        self.assertEqual(K.katalog_html([], {}), "")

    def test_esche_regionov(self):
        vse = [k_("77000001%02d" % i, "К%d" % i, "Торговля", "Регион %02d" % i) for i in range(K.KATALOG_REG_VIDNO + 3)]
        t = K.katalog_html(vse, {})
        self.assertIn("Ещё 3 региона", t)


@unittest.skipUnless((KOREN / "company" / "index.html").is_file(), "нет собранного хаба")
class NaSajte(unittest.TestCase):
    def setUp(self):
        self.hub = chitat(KOREN / "company" / "index.html")

    def test_katalog_na_habe(self):
        self.assertEqual(self.hub.count('aria-label="Каталог компаний"'), 1)
        self.assertIn('id="po-otraslyam"', self.hub)
        # каждая ссылка каталога — на существующую страницу или раздел этой страницы
        kat = re.search(r'<nav class="co-sec co-kat".*?</nav>', self.hub, re.S).group(0)
        for a in re.findall(r'href="([^"]+)"', kat):
            if a.startswith("#"):
                self.assertIn('id="%s"' % a[1:], self.hub, a)
            else:
                self.assertTrue((KOREN / a.strip("/") / "index.html").is_file(), a)
        # строки регионов в шапке больше нет (каталог — одно место)
        self.assertNotIn("По регионам:", self.hub)

    def test_gruppy_po_50_i_po_oborotu(self):
        for p in (KOREN / "company").glob("*/*/index.html"):
            if p.parts[-3] not in K.GRUPPY_VIDY:
                continue
            t = chitat(p)
            self.assertIn(K.HAB_PORYADOK_OBOROT, html.unescape(t).replace(" ", " "), p)
            n = len(re.findall(r'<li><a href="/company/\d{10}-', t))
            self.assertLessEqual(n, K.HAB_GRUPPY_NA, p)
            if p.parts[-3] == "otrasl":
                ob = []
                for m in re.finditer(r'оборот за \d{4} — ([\d,]+) (трлн|млрд|млн|тыс\.)',
                                     html.unescape(t)):
                    ob.append(float(m.group(1).replace(",", ".")) * {"трлн": 1e12, "млрд": 1e9, "млн": 1e6, "тыс.": 1e3}[m.group(2)])
                self.assertEqual(ob, sorted(ob, reverse=True), p)

    def test_maly_gruppy_ne_v_indekse(self):
        sm = chitat(KOREN / "sitemap-companies.xml")
        for p in (KOREN / "company").glob("*/*/index.html"):
            if p.parts[-3] not in K.GRUPPY_VIDY:
                continue
            adr = "/" + str(p.parent.relative_to(KOREN)) + "/"
            noindex = 'content="noindex, follow"' in chitat(p)
            self.assertEqual(noindex, ("https://deloskop.ru%s<" % adr) not in sm, adr)


if __name__ == "__main__":
    unittest.main()
