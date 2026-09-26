#!/usr/bin/env python3
"""Проверки IndexNow (п. 31, автоматизация шаг 4) — без сети.
Запуск: python3 tests/test_indexnow.py"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import indexnow as ix  # noqa: E402


class TestIndexNow(unittest.TestCase):
    def test_klyuch_odin_i_sovpadaet_s_imenem(self):
        k = ix.klyuch()
        self.assertRegex(k, r"^[0-9a-f]{32}$")

    def test_fajl_v_adres(self):
        self.assertEqual(ix.fajl_v_adres("index.html"), "https://deloskop.ru/")
        self.assertEqual(ix.fajl_v_adres("tarify/index.html"), "https://deloskop.ru/tarify/")
        self.assertEqual(ix.fajl_v_adres("115-fz/zsk-zony-riska/index.html"),
                         "https://deloskop.ru/115-fz/zsk-zony-riska/")
        self.assertEqual(ix.fajl_v_adres("report.html"), "https://deloskop.ru/report.html")
        for ne_stranica in ("js/inn.js", "obnovleniya.json", "css/ds.css", "robots.txt"):
            self.assertIsNone(ix.fajl_v_adres(ne_stranica))

    def test_tolko_iz_sitemap_bez_povtorov(self):
        v_sitemap = ix.adresa_sitemap()
        vybor = ix.vybrat(["index.html", "tarify/index.html", "tarify/index.html", "cabinet.html",
                           "admin.html", "404.html", "js/inn.js", "yandex_d591aeadaadcae21.html"], v_sitemap)
        self.assertEqual(vybor, ["https://deloskop.ru/", "https://deloskop.ru/tarify/"])

    def test_zakrytye_stranicy_ne_v_sitemap(self):
        v_sitemap = set(ix.adresa_sitemap())
        for a in ("/cabinet.html", "/admin.html", "/404.html", "/schet/", "/schet/dokument/"):
            self.assertNotIn("https://deloskop.ru" + a, v_sitemap, a)

    def test_vse_adresa_sitemap_na_etom_sajte(self):
        for a in ix.adresa_sitemap():
            self.assertTrue(a.startswith("https://deloskop.ru/"), a)


if __name__ == "__main__":
    unittest.main(verbosity=1)
