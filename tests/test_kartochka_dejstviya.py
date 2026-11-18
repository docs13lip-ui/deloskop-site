"""kartochka-dejstviya-v1 ([Ночные-2] 18.11): на карточке /company/ под «Открыть отчёт» — «Следить за компанией»
и «Сравнить с другой» (✎ [Ночные] 18.11, п. 7 плана 18.11 «на карточке»); в BreadcrumbList — отрасль, когда у неё
и у региона есть хаб — разметка = ссылки видимого пути (✎ [Ночные] 18.11 к kroshki-v1, Н2). Кнопки — шаблон, не сведения: отпечаток текста и dateModified прежние."""
import glob
import json
import os
import re
import sys
import unittest

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(KOREN, "tests"))
import kartochka_render as K  # noqa: E402
import kartochki as KK  # noqa: E402

KARTOCHKI = sorted(glob.glob(os.path.join(KOREN, "company", "[0-9]*", "index.html")))
LD = re.compile(r'<script type="application/ld\+json">(\{"@context": "https://schema.org", "@graph": .*?)</script>', re.S)
KROSH = re.compile(r'<nav class="co-krosh caption" aria-label="Навигация"[^>]*>(.*?)</nav>', re.S)

OBRAZEC = ('<head><script type="application/ld+json">{"@context": "https://schema.org", "@graph": [{"@type": "BreadcrumbList", '
           '"itemListElement": [{"@type": "ListItem", "item": "https://deloskop.ru/", "name": "Делоскоп", "position": 1}, '
           '{"@type": "ListItem", "item": "https://deloskop.ru/company/", "name": "Компании", "position": 2}, '
           '{"@type": "ListItem", "item": "https://deloskop.ru/company/7700000000-test/", "name": "ООО «Тест»", "position": 3}]}, '
           '{"@type": "Organization", "name": "ООО «Тест»", "taxID": "7700000000"}]}</script></head><main>'
           '<nav class="co-krosh caption" aria-label="Навигация" data-okved="47.11"><a href="/">Делоскоп</a> › '
           '<a href="/company/">Компании</a> › <a href="/company/region/moskva/">Москва</a> › '
           '<a href="/company/otrasl/torgovlya/">Торговля</a></nav>'
           '<aside class="co-side card"><h2 class="co-h3">Полный отчёт</h2><p class="small">Финансы за&#160;пять лет.</p>'
           '<a class="btn btn--secondary co-w100" href="/?inn=7700000000">Открыть отчёт</a></aside></main>')


def chitat(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()


def kroshki_ld(t):
    ld = json.loads(LD.search(t).group(1).replace("<\\/", "</"))
    bc = next(x for x in ld["@graph"] if x.get("@type") == "BreadcrumbList")
    return sorted(bc["itemListElement"], key=lambda x: x["position"])


class TestFunkcii(unittest.TestCase):
    def test_knopki(self):
        t = K.dejstviya_kartochki(OBRAZEC)
        self.assertIn('href="/cabinet.html?inn=7700000000#watch" rel="nofollow" data-cel="kartochka_sled"', t)
        self.assertIn('href="/sravnit/?a=7700000000" rel="nofollow" data-cel="kartochka_sravnit"', t)
        self.assertIn("Следить за компанией", t)
        self.assertIn("Сравнить с другой", t)
        self.assertEqual(K.dejstviya_kartochki(t), t, "повторный вызов ничего не меняет")
        self.assertLess(t.index("Открыть отчёт"), t.index("Следить"), "под главной кнопкой, не вместо")

    def test_haby_v_razmetke(self):
        t = K.kroshki_ld_otrasl(OBRAZEC)
        el = kroshki_ld(t)
        self.assertEqual([x["name"] for x in el], ["Делоскоп", "Компании", "Москва", "Торговля", "ООО «Тест»"])
        self.assertEqual(el[3]["item"], "https://deloskop.ru/company/otrasl/torgovlya/")
        self.assertEqual([x["position"] for x in el], [1, 2, 3, 4, 5])
        self.assertEqual(K.kroshki_ld_otrasl(t), t, "повторный вызов ничего не меняет")

    def test_hab_propal(self):
        t = K.kroshki_ld_otrasl(OBRAZEC)
        bez = t.replace('<a href="/company/region/moskva/">Москва</a>', "Москва")
        self.assertEqual([x["name"] for x in kroshki_ld(K.kroshki_ld_otrasl(bez))], ["Делоскоп", "Компании", "Торговля", "ООО «Тест»"])
        bez = bez.replace('<a href="/company/otrasl/torgovlya/">Торговля</a>', "Торговля")
        self.assertEqual([x["name"] for x in kroshki_ld(K.kroshki_ld_otrasl(bez))], ["Делоскоп", "Компании", "ООО «Тест»"],
                         "нет хаба — нет уровня в разметке")

    def test_otpechatok_ne_menyaetsya(self):
        self.assertEqual(KK.otpechatok_teksta(K.dejstviya_kartochki(OBRAZEC)), KK.otpechatok_teksta(OBRAZEC),
                         "кнопки шаблона — не изменение сведений: dateModified не сдвигается")


class TestOpublikovannye(unittest.TestCase):
    def test_vse_kartochki(self):
        self.assertGreater(len(KARTOCHKI), 100)
        s_haby = 0
        for p in KARTOCHKI:
            t = chitat(p)
            inn = os.path.basename(os.path.dirname(p))[:10]
            self.assertEqual(t.count('class="co-dejstv"'), 1, p)
            self.assertIn('/cabinet.html?inn=%s#watch' % inn, t, p)
            self.assertIn('/sravnit/?a=%s"' % inn, t, p)
            el = kroshki_ld(t)
            kr = KROSH.search(t).group(1)
            ssylki = re.findall(r'<a href="([^"]+)">', kr)
            self.assertEqual(["https://deloskop.ru" + a for a in ssylki], [x["item"] for x in el[:-1]],
                             "разметка = ссылки видимого пути: " + p)
            for a in ssylki[2:]:
                s_haby += 1
                self.assertTrue(os.path.isfile(os.path.join(KOREN, a.strip("/"), "index.html")), "хаб есть: " + p)
            self.assertEqual([x["position"] for x in el], list(range(1, len(el) + 1)), p)
            self.assertTrue(el[-1]["item"].endswith("/%s/" % os.path.basename(os.path.dirname(p))), p)
        self.assertGreater(s_haby, 100)


if __name__ == "__main__":
    unittest.main()
