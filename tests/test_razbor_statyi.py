#!/usr/bin/env python3
"""razbor-statyi-v1 (19.11.2026, [Ночные-2], Н4): у каждого разбора в «Читайте также» есть статья или инструмент по теме,
и это статья, которая сама ссылается на разбор (связь в обе стороны). Адрес живой, заголовок = <h1> статьи, без повторов."""
import html
import os
import re
import sys
import unittest

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(KOREN, "tests"))
import sobrat_praktika as P  # noqa: E402


def chitat(*p):
    with open(os.path.join(KOREN, *p), encoding="utf-8") as fh:
        return fh.read()


def blok_sos(txt):
    m = re.search(r'<h2>(Читайте также|Похожие разборы)</h2>\n<div class="sos">(.*?)</div>', txt, re.S)
    return m.group(1), m.group(2)


def h1(url):
    m = re.search(r"<h1[^>]*>(.*?)</h1>", chitat(*url.strip("/").split("/"), "index.html"), re.S)
    return html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()


class RazborStatyi(unittest.TestCase):
    def setUp(self):
        self.D = P.dannye()

    def test_u_kazhdogo_razbora_est_statya(self):
        for r in self.D["razbory"]:
            z, sos = blok_sos(chitat(*P.url_razbora(r).strip("/").split("/"), "index.html"))
            statyi = [u for u in re.findall(r'<a class="pk" href="([^"]+)"', sos) if not u.startswith("/praktika/")]
            self.assertTrue(statyi, r["slug"] + ": нет статьи в «Читайте также»")
            self.assertEqual(z, "Читайте также", r["slug"])
            self.assertLessEqual(len(statyi) - len(r.get("statyi", [])), P.STATEJ_OBRATNO, r["slug"])
            self.assertEqual(len(statyi), len(set(statyi)), r["slug"] + ": повтор")

    def test_svyaz_v_obe_storony(self):
        for r in self.D["razbory"]:
            for u in P.statyi_razbora(r, self.D):
                if u in r.get("statyi", []):
                    continue
                self.assertIn(P.url_razbora(r), chitat(*u.strip("/").split("/"), "index.html"),
                              "%s ведёт на %s, а обратной ссылки нет" % (r["slug"], u))

    def test_zagolovok_kartochki_eto_h1(self):
        for r in self.D["razbory"]:
            sos = blok_sos(chitat(*P.url_razbora(r).strip("/").split("/"), "index.html"))[1]
            for u, q in re.findall(r'<a class="pk" href="([^"]+)"><span class="pk__q">(.*?)</span>', sos):
                if u.startswith("/praktika/"):
                    continue
                norm = lambda s: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s)).replace(" ", " ")).strip()
                self.assertEqual(norm(q), norm(h1(u)), u)

    def test_podpis_kalkulyatora(self):
        txt = chitat("praktika", "nalogi", "utochnenka-i-peni-ens", "index.html")
        self.assertIn('href="/nalogi/nagruzka/"', txt)
        self.assertIn("Калькулятор Делоскопа", txt)

    def test_haby_i_pasport_ne_berem(self):
        for r in self.D["razbory"]:
            for u in P.statyi_razbora(r, self.D):
                self.assertNotIn(u, ("/115-fz/", "/nalogi/", "/pasport/", "/skoraya-115-fz/"), r["slug"])


if __name__ == "__main__":
    unittest.main()
