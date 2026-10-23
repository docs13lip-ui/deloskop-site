#!/usr/bin/env python3
"""kartochki-unik-v9 ([Ночные-2] 23.10, ТЗ [Продукт] 23.10 пп. 3Б и 3В): короткая подпись «◆» и WebPage с dateModified —
днём последнего изменения видимого текста карточки (отпечаток рядом с блоком); lastmod в sitemap — не раньше этой даты.
Запуск: python3 tests/test_kartochki_unik9.py"""
import datetime as dt
import json
import pathlib
import re
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochki as R  # noqa: E402  (WebPage — сборка сайта, не общий модуль отрисовки)

KOREN = pathlib.Path(__file__).resolve().parent.parent
PAPKA = KOREN / "company"
D1, D2 = dt.date(2026, 10, 23), dt.date(2026, 10, 30)

STR = ('<html><head><title>АО «А», ИНН 7707083893: проверка — Делоскоп</title>\n'
       '<link rel="canonical" href="https://deloskop.ru/company/7707083893-a/">\n'
       '<script type="application/ld+json">{"@graph": [{"@type": "Organization", "name": "АО «А»", "taxID": "7707083893"}]}'
       '</script>\n</head><body><!--shapka-->ШАПКА<!--/shapka--><main id="main"><h1>АО «А»</h1><p>Выручка 1&nbsp;млрд ₽.</p>'
       '<script>var x=1</script></main><!--podval-->ПОДВАЛ<!--/podval--></body></html>')


def kartochki():
    for d in sorted(PAPKA.iterdir()):
        if re.match(r"^\d{10}-", d.name) and (d / "index.html").is_file():
            yield d.name, (d / "index.html").read_text(encoding="utf-8")


class TestWebPage(unittest.TestCase):
    def test_vstavka_i_povtor(self):
        t1, d = R.vstavit_webpage(STR, D1)
        self.assertEqual(d, D1)
        self.assertEqual(t1.count('data-dlk="webpage"'), 1)
        wp = json.loads(R._WP_BLOK.search(t1).group(2))
        self.assertEqual(wp["@type"], "WebPage")
        self.assertEqual(wp["dateModified"], "2026-10-23")
        self.assertEqual(wp["url"], "https://deloskop.ru/company/7707083893-a/")
        self.assertEqual(wp["about"]["taxID"], "7707083893")
        self.assertEqual(wp["isBasedOn"], R.WP_ISTOCHNIKI)
        self.assertEqual(R.vstavit_webpage(t1, D1), (t1, D1))  # тот же день — те же байты

    def test_data_ne_dvigaetsya_bez_izmeneniya_teksta(self):
        t1, _ = R.vstavit_webpage(STR, D1)
        self.assertEqual(R.vstavit_webpage(t1, D2), (t1, D1))
        # шапка, подвал и скрипт внутри <main> — не текст карточки
        t_obol = t1.replace("ШАПКА", "НОВАЯ ШАПКА").replace("ПОДВАЛ", "НОВЫЙ").replace("var x=1", "var x=2")
        self.assertEqual(R.vstavit_webpage(t_obol, D2)[1], D1)
        # вид пробела — не изменение
        self.assertEqual(R.vstavit_webpage(t1.replace("1&nbsp;млрд", "1 млрд"), D2)[1], D1)

    def test_izmenenie_teksta_dvigaet_datu(self):
        t1, _ = R.vstavit_webpage(STR, D1)
        t2, d = R.vstavit_webpage(t1.replace("1&nbsp;млрд", "2&nbsp;млрд"), D2)
        self.assertEqual(d, D2)
        self.assertEqual(t2.count('data-dlk="webpage"'), 1)
        self.assertIn('"dateModified": "2026-10-30"', t2)

    def test_bez_organization_bez_izmenenij(self):
        t = STR.replace('"taxID": "7707083893"', '"x": 1')
        self.assertEqual(R.vstavit_webpage(t, D1), (t, None))


class TestNaDiske(unittest.TestCase):
    """Опубликованные карточки: WebPage один, отпечаток совпадает с текстом, lastmod в sitemap не раньше dateModified."""

    def test_webpage_i_otpechatok(self):
        sm = (KOREN / "sitemap-companies.xml").read_text(encoding="utf-8")
        lm = dict(re.findall(r"<loc>https://deloskop\.ru(/company/[^<]+)</loc><lastmod>([\d-]+)</lastmod>", sm))
        n = 0
        for papka, t in kartochki():
            self.assertEqual(t.count('data-dlk="webpage"'), 1, papka)
            h, d = R.data_teksta(t)
            self.assertEqual(h, R.otpechatok_teksta(t), papka + ": текст менялся без пересборки — kartochki.py perepechatat")
            self.assertIsNotNone(d, papka)
            a = "/company/%s/" % papka
            if a in lm:
                self.assertGreaterEqual(lm[a], d.isoformat(), papka)
            n += 1
        self.assertGreater(n, 100)


class TestPodpis(unittest.TestCase):
    def test_korotkaya_podpis(self):
        for papka, t in kartochki():
            if 'class="co-sec co-znachit"' not in t:
                continue
            self.assertNotIn("других карточек Делоскопа", t, papka)
            self.assertNotIn("рассчитано Делоскопом по сведениям этой страницы", t, papka)
            self.assertIn("◆ Расчёт Делоскопа по открытым данным.", t, papka)
            self.assertEqual(t.count("Условия сделки решаете вы"), 1, papka)


if __name__ == "__main__":
    unittest.main(verbosity=1)
