#!/usr/bin/env python3
"""haby-svyazi-v1 (24.10.2026, [Ночные-2]): хабы региона и отрасли /company/ ссылаются друг на друга.

Сторож: (1) на хабе региона заголовок отрасли, у которой есть свой хаб, — ссылка на него; без хаба — текст;
(2) во вводном абзаце хаба имена групп с хабом — ссылки; (3) все ссылки /company/otrasl|region/… ведут на существующие
хабы; (4) без kg — страница как раньше.
"""
import html
import os
import re
import sys
import unittest

TESTS = os.path.dirname(os.path.abspath(__file__))
KOREN = os.path.dirname(TESTS)
sys.path.insert(0, TESTS)
import kartochka_render as R  # noqa: E402


def haby():
    out = {}
    for vid in R.GRUPPY_VIDY:
        papka = os.path.join(KOREN, "company", vid)
        for d in sorted(os.listdir(papka)) if os.path.isdir(papka) else []:
            put = os.path.join(papka, d, "index.html")
            if os.path.isfile(put):
                out["/company/%s/%s/" % (vid, d)] = open(put, encoding="utf-8").read()
    return out


def h1(t):
    m = re.search(r"<h1>(.*?)</h1>", t, re.S)
    return html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).replace("Компании: ", "") if m else ""


class TestHabySvyazi(unittest.TestCase):
    def setUp(self):
        self.h = haby()
        self.otr = {h1(t): a for a, t in self.h.items() if "/otrasl/" in a}
        self.reg = {h1(t): a for a, t in self.h.items() if "/region/" in a}

    def test_zagolovki_otrasley_na_habe_regiona(self):
        self.assertTrue(self.reg and self.otr)
        for a, t in self.h.items():
            if "/region/" not in a:
                continue
            for ssylka, imya in re.findall(r'<section class="co-sec"><h2>(?:<a href="([^"]+)">)?([^<]+)', t):
                imya = html.unescape(imya).strip()
                if imya in self.otr:
                    self.assertEqual(ssylka, self.otr[imya], "%s: «%s» без ссылки на хаб" % (a, imya))
                elif ssylka:
                    self.assertIn(ssylka, self.h, a)

    def test_vvod(self):
        for a, t in self.h.items():
            m = re.search(r'<p class="co-hab__vvod">(.*?)</p>', t, re.S)
            if not m:
                continue
            drugie = self.reg if "/otrasl/" in a else self.otr
            tekst = html.unescape(m.group(1))
            for imya, adres in drugie.items():
                if re.search(r"(с адресом |здесь — |, дальше — )«?%s»? \(" % re.escape(imya), re.sub(r"<[^>]+>", "", tekst)):
                    self.assertIn('href="%s"' % adres, m.group(1), "%s: «%s» во вводном абзаце без ссылки" % (a, imya))

    def test_ssylki_zhivye(self):
        for a, t in self.h.items():
            for s in re.findall(r'href="(/company/(?:otrasl|region)/[^"/]+/)"', t):
                self.assertIn(s, self.h, "%s → %s" % (a, s))

    def test_bez_kg_kak_ranshe(self):
        g = {"vid": "region", "imya": "Москва", "slug": "moskva", "kart": []}
        self.assertEqual(R.hab_ssylki_grupp("<p>x</p>", g, None), "<p>x</p>")


if __name__ == "__main__":
    unittest.main()
