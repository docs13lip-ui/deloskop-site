"""kartochki-hab-v3 (ТЗ [Продукт] 23.10 С2): хаб /company/ ссылается на ВСЕ карточки из sitemap-companies.xml.

Сторож на файлах репозитория: множество ссылок страницы 1 хаба = множеству карточек в sitemap; число в h1 и description —
это же число; JSON-LD CollectionPage + ItemList по тем же адресам; длинные отрасли — под <details>, ссылки в HTML (без JS).
Карточки вне sitemap — на /company/stranica/N/ (noindex, follow); ИП (12 цифр) на хабе нет."""
import html
import json
import pathlib
import re
import sys
import unittest

KOREN = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(KOREN / "tests"))
import kartochka_render as K  # noqa: E402

SM = KOREN / "sitemap-companies.xml"
HUB = KOREN / "company" / "index.html"


def adresa(t):
    return set(re.findall(r'<li><a href="(/company/\d{10}-[a-z0-9-]+/)"', t))


@unittest.skipUnless(SM.is_file() and HUB.is_file(), "нет хаба или sitemap")
class TestHabV3(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.hub = HUB.read_text(encoding="utf-8")
        sm = SM.read_text(encoding="utf-8")
        cls.v_sm = {u.replace(K.SAJT, "") for u in re.findall(r"<loc>([^<]+/company/\d{10}-[^<]+)</loc>", sm)}

    def test_ssylki_hab_ravny_sitemap(self):
        if len(self.v_sm) > K.HAB_PERVAYA_MAKS:
            self.skipTest("больше HAB_PERVAYA_MAKS — остаток несут хабы отраслей")
        self.assertEqual(adresa(self.hub), self.v_sm, "ссылки хаба ≠ карточки sitemap-companies.xml")

    def test_chislo_v_h1_i_description(self):
        n = len(self.v_sm)
        h1 = html.unescape(re.search(r"<h1>(.*?)</h1>", self.hub).group(1))
        d = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', self.hub).group(1))
        self.assertTrue(h1.startswith("%d\u00a0" % n), h1)
        self.assertTrue(d.startswith("%d " % n), d)
        self.assertLessEqual(len(d), 160)

    def test_collectionpage(self):
        ld = [json.loads(x) for x in re.findall(r'<script type="application/ld\+json">(.*?)</script>', self.hub)]
        self.assertEqual([x["@type"] for x in ld], ["BreadcrumbList", "CollectionPage"])
        il = ld[1]["mainEntity"]
        self.assertEqual(il["@type"], "ItemList")
        urls = [x["url"].replace(K.SAJT, "") for x in il["itemListElement"]]
        self.assertEqual(set(urls), self.v_sm)
        self.assertEqual(il["numberOfItems"], len(urls))
        self.assertEqual([x["position"] for x in il["itemListElement"]], list(range(1, len(urls) + 1)))

    def test_details_bez_js(self):
        for sek in re.findall(r'<section class="co-sec"><h2>.*?</section>', self.hub):
            vidno = sek.split("<details")[0]
            self.assertLessEqual(len(adresa(vidno)), K.HAB_VIDNO + 1, "в отрасли видно больше HAB_VIDNO")
            if "<details" in sek:
                n = len(adresa(sek)) - K.HAB_VIDNO
                self.assertIn("<summary>Ещё\u00a0%d\u00a0" % n, html.unescape(sek))
        self.assertNotIn("<details open", self.hub)

    def test_ostalnye_na_stranicah(self):
        vse = set()
        for p in sorted((KOREN / "company" / "stranica").glob("*/index.html")):
            t = p.read_text(encoding="utf-8")
            self.assertIn('content="noindex, follow"', t)
            vse |= adresa(t)
        self.assertFalse(vse & self.v_sm, "карточка из sitemap — и на странице 2…")
        kart = {"/company/%s/" % p.parent.name for p in (KOREN / "company").glob("[0-9]*/index.html")}
        self.assertEqual(vse | adresa(self.hub), kart, "каждая карточка — на одной из страниц хаба")

    def test_net_ip(self):
        self.assertIsNone(re.search(r'href="/company/\d{12}-', self.hub))


class TestStranicyHaba(unittest.TestCase):
    def k(self, i, otr="Торговля"):
        return {"inn": "77%08d" % i, "name": "ООО «К%03d»" % i, "slug": "k%03d" % i, "okved": "47.11", "_razdel": otr}

    def test_bez_sitemap_kak_ran(self):
        kart = [self.k(i) for i in range(25)]
        self.assertEqual([len(x) for x in K.stranicy_haba(kart, 10)], [10, 10, 5])

    def test_pervaya_vse_iz_sitemap(self):
        kart = [self.k(i) for i in range(25)]
        v = {K.adres_str(x) for x in kart[:17]}
        st = K.stranicy_haba(kart, 10, v)
        self.assertEqual([len(x) for x in st], [17, 8])
        self.assertEqual({K.adres_str(x) for x in st[0]}, v)
        self.assertEqual([len(x) for x in K.stranicy_haba(kart, 10, v, pervaya=5)], [5, 10, 10])


if __name__ == "__main__":
    unittest.main()
