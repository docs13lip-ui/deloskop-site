#!/usr/bin/env python3
"""Сторож seo-haby-v1 (25.10.2026): крошки и состав разделов в разметке для поиска (tests/seo_haby.py).

1) У каждой индексируемой страницы, кроме главной и карточек /company/ (их крошки держит test_kartochki), есть
   BreadcrumbList, и его последний шаг — адрес самой страницы (canonical).
2) Хабы /115-fz/ и /nalogi/: CollectionPage с описанием и ItemList; список = все ссылки хаба на свои статьи
   (без noindex), по порядку; имена — <h1> статей; второй шаг крошек хаба = второй шаг крошек его статей.
3) Шаг сборки повторно ничего не меняет.
"""
import glob
import json
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import seo_haby as SH  # noqa: E402

KOREN = SH.KOREN
PROPUSK = {"yandex_d591aeadaadcae21.html"}  # файл подтверждения Вебмастера — не трогаем


def stranicy():
    for p in sorted(glob.glob(os.path.join(KOREN, "**", "*.html"), recursive=True)):
        r = os.path.relpath(p, KOREN)
        if r.split(os.sep)[0] in ("tests", "сайт", "partials", "company", "node_modules") or r in PROPUSK:
            continue
        s = open(p, encoding="utf-8").read()
        if SH.NOINDEX.search(s):
            continue
        yield r, s


def ld(s):
    out = []
    for j in SH.LD.findall(s):
        d = json.loads(j)
        out.extend(d if isinstance(d, list) else [d])
    return out


class TestSeoHaby(unittest.TestCase):
    def test_kroshki_vezde(self):
        net = []
        for r, s in stranicy():
            m = SH.CANON.search(s)
            if not m or m.group(1) == "/":
                continue
            bl = [x for x in ld(s) if x.get("@type") == "BreadcrumbList"]
            if not bl:
                net.append(r)
                continue
            self.assertEqual(bl[0]["itemListElement"][-1]["item"], SH.SAJT + m.group(1), r)
        self.assertEqual(net, [], "страницы без BreadcrumbList — добавьте адрес в seo_haby.PRODUKTY")

    def test_haby(self):
        for url, imya in SH.HABY.items():
            s = open(os.path.join(KOREN, url.strip("/"), "index.html"), encoding="utf-8").read()
            d = ld(s)
            cp = [x for x in d if x.get("@type") == "CollectionPage"]
            self.assertEqual(len(cp), 1, url)
            cp = cp[0]
            self.assertTrue(cp.get("description"), url)
            spisok = cp["mainEntity"]["itemListElement"]
            ozhid = SH.stati_haba(s, url)
            self.assertGreaterEqual(len(ozhid), 5, url)
            self.assertEqual([(x["url"], x["name"]) for x in spisok], [(SH.SAJT + h, n) for h, n in ozhid], url)
            self.assertEqual(cp["mainEntity"]["numberOfItems"], len(spisok))
            self.assertEqual([x["position"] for x in spisok], list(range(1, len(spisok) + 1)))
            # ссылки в теле хаба на свои статьи — все в списке (кроме noindex)
            telo = re.sub(r"<script\b.*?</script>", "", s, flags=re.S)
            for h in set(re.findall(r'href="(' + re.escape(url) + r'[a-z0-9-]+/)"', telo)):
                f = open(os.path.join(KOREN, h.strip("/"), "index.html"), encoding="utf-8").read()
                if not SH.NOINDEX.search(f):
                    self.assertIn(SH.SAJT + h, [x["url"] for x in spisok], h)
                    # крошки статьи называют хаб так же
                    bl = [x for x in ld(f) if x.get("@type") == "BreadcrumbList"]
                    self.assertEqual(bl[0]["itemListElement"][1]["name"], imya, h)

    def test_imya_bez_metki(self):
        self.assertEqual(SH.tekst('Делопись<span class="dp-beta">бета</span>'), "Делопись")
        self.assertEqual(SH.tekst("Скорая 115&#8209;ФЗ"), "Скорая 115-ФЗ")
        self.assertEqual(SH.tekst("Кому вы&nbsp;платите"), "Кому вы платите")

    def test_povtor_nichego_ne_menyaet(self):
        for url in list(SH.HABY) + list(SH.PRODUKTY):
            s = open(os.path.join(KOREN, url.strip("/"), "index.html"), encoding="utf-8").read()
            self.assertEqual(SH.primenit(s), s, url)

    def test_drugie_ne_trogaem(self):
        s = '<head><link rel="canonical" href="https://deloskop.ru/tarify/"></head>'
        self.assertEqual(SH.primenit(s), s)
        self.assertEqual(SH.primenit("<head></head>"), "<head></head>")


if __name__ == "__main__":
    unittest.main()
