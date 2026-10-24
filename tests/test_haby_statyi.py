#!/usr/bin/env python3
"""haby-statyi-v1 (24.10.2026): хабы /company/otrasl/ и /company/region/ — раздел «Перед сделкой с компанией из списка»
(#chitat) на 1-й странице: у хаба отрасли — строки справочника ФНС, к которым относятся карточки группы (число и %
— из data/fns-normy-2025.json), у всех — нейтральные статьи о проверке перед сделкой. Сторож: раздел есть и собран,
ссылки живые и открыты роботам, статей о сигналах (BEZ_IMEN) рядом со списком компаний нет, на страницах 2…N раздела нет."""
import glob
import html
import json
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as R  # noqa: E402
import sobrat_stati_kartochki as SK  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NORMY = json.load(open(os.path.join(KOREN, "data", "fns-normy-2025.json"), encoding="utf-8"))["nagruzka"]
SPR = open(os.path.join(KOREN, "nalogi", "nagruzka-po-otraslyam-2025", "index.html"), encoding="utf-8").read()
SEC = re.compile(r'<section class="co-sec co-hab__chitat" id="chitat">.*?</section>', re.S)


def haby(vid):
    return sorted(glob.glob(os.path.join(KOREN, "company", vid, "*", "index.html")))


def chitat(put):
    m = SEC.search(open(put, encoding="utf-8").read())
    return m.group(0) if m else ""


class TestHabyStatyi(unittest.TestCase):
    def test_razdel_na_kazhdom_habe(self):
        vse = haby("otrasl") + haby("region")
        self.assertGreaterEqual(len(vse), 2)
        for p in vse:
            s = chitat(p)
            self.assertTrue(s, "%s: нет раздела #chitat — python3 tests/kartochki.py perepechatat" % p)
            for st in R.HAB_STATYI:
                self.assertIn('href="/%s/"' % st, s, "%s: нет статьи %s" % (p, st))

    def test_bez_statej_o_signalah(self):
        self.assertFalse(set(R.HAB_STATYI) & SK.BEZ_IMEN, "статья о сигнале рядом со списком компаний (ответ [Право] 24.10, 1.1)")
        for p in haby("otrasl") + haby("region"):
            for st in SK.BEZ_IMEN:
                self.assertNotIn("/%s/" % st, chitat(p), p)

    def test_ssylki_zhivye_i_otkrytye(self):
        for p in haby("otrasl") + haby("region"):
            for a in re.findall(r'href="(/(?:nalogi|115-fz)/[^"#]+/)', chitat(p)):
                f = os.path.join(KOREN, a.strip("/"), "index.html")
                self.assertTrue(os.path.isfile(f), a)
                self.assertNotRegex(open(f, encoding="utf-8").read(), r'<meta name="robots" content="[^"]*noindex', a)

    def test_stroki_fns_iz_spravochnika(self):
        po_kodu = {R.yakor_normy(r["kod"]): r for r in NORMY}
        for p in haby("otrasl"):
            s = chitat(p)
            stroki = re.findall(r'<li><a href="/nalogi/nagruzka-po-otraslyam-2025/#(n-[0-9a-z-]+)">([^<]+)</a>'
                                r'<span class="caption">[^<]*?(\d+,\d)&nbsp;%[^<]*· (\d+)&nbsp;', s)
            self.assertTrue(stroki, "%s: нет строк справочника ФНС" % p)
            self.assertLessEqual(len(stroki), R.HAB_NORM_MAKS)
            n_kart = len(re.findall(r'<li><a href="/company/\d{10}-', open(p, encoding="utf-8").read()))
            self.assertLessEqual(sum(int(x[3]) for x in stroki), n_kart)
            for y, nz, proc, _ in stroki:
                self.assertIn('id="%s"' % y, SPR, "якорь %s есть в справочнике" % y)
                r = po_kodu[y]
                self.assertEqual(proc, ("%.1f" % r["nagruzka"]["2025"]).replace(".", ","), y)
                self.assertEqual(html.unescape(nz), R._nazv_normy(r))

    def test_hab_i_spravochnik_drug_na_druga(self):
        for p in haby("otrasl"):
            adr = "/" + os.path.relpath(os.path.dirname(p), KOREN) + "/"
            if ('href="%s"' % adr) in SPR:
                self.assertIn("/nalogi/nagruzka-po-otraslyam-2025/#", chitat(p), "справочник → %s есть, обратно — нет" % adr)

    def test_tolko_pervaya_stranica(self):
        for p in glob.glob(os.path.join(KOREN, "company", "*", "*", "*", "*", "index.html")):
            if "/otrasl/" in p or "/region/" in p:
                self.assertFalse(chitat(p), "%s: раздел — только на 1-й странице" % p)

    def test_hab_chitat_pusto_bez_dannyh(self):
        self.assertEqual(R.hab_chitat({"vid": "region", "kart": []}, NORMY, ()), "")
        self.assertEqual(R.hab_normy({"vid": "region", "kart": [{"okved": "35.11"}]}, NORMY), [])
        g = {"vid": "otrasl", "kart": [{"okved": "35.11"}, {"okved": "35.12"}, {"okved": "35.30"}]}
        self.assertEqual([(r["kod"], n) for r, n in R.hab_normy(g, NORMY)][0][1], 2)


if __name__ == "__main__":
    unittest.main()
