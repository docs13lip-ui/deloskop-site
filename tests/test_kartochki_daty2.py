"""kartochki-daty-v2 ([Ночные-2] 17.10): «Последнее изменение записи в ЕГРЮЛ» на карточке — настоящая дата изменения,
а не день получения сведений. Живой /api/check 17.10: «ЕГРЮЛ/ЕГРИП — на 17.10.2026; последнее изменение записи
ЕГРЮЛ/ЕГРИП — 07.10.2026», а карточка «Газпром переработки» писала 11.10.2026 (день сведений) — так на 106 из 142.
python3 tests/test_kartochki_daty2.py"""
import datetime as dt
import glob
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NB = "\u00a0"
ZHIVOJ = "ЕГРЮЛ/ЕГРИП — на 17.10.2026; последнее изменение записи ЕГРЮЛ/ЕГРИП — 07.10.2026; задолженность — на 01.09.2026"


def blok(izm, sved):
    return ('<section class="co-sec co-daty" aria-labelledby="daty"><h2 id="daty">Даты из реестра</h2><dl class="co-daty__sp">'
            '<div><dt>Зарегистрирована</dt> <dd><span class="num">1&nbsp;мая&nbsp;2007&nbsp;года</span></dd></div>'
            '<div><dt>Последнее изменение записи в&nbsp;ЕГРЮЛ</dt> <dd><span class="num">%s</span></dd></div></dl>'
            '<span class="co-src">ЕГРЮЛ · сведения на %s · ● подтверждено источником</span></section>' % (izm, sved))


class TestDataIzmeneniya(unittest.TestCase):
    def test_state_actuality_date_pervym(self):
        self.assertEqual(K.data_izmeneniya_zapisi({"state_actuality_date": "2026-08-28"}, ZHIVOJ), dt.date(2026, 8, 28))

    def test_zapasnoj_put_stroka_izmeneniya(self):
        self.assertEqual(K.data_izmeneniya_zapisi({}, ZHIVOJ), dt.date(2026, 10, 7))

    def test_na_ne_beryom(self):
        # «— на …» — день получения сведений; другой даты нет — строки нет (не проверяли ≠ не нашли)
        self.assertIsNone(K.data_izmeneniya_zapisi({}, "ЕГРЮЛ/ЕГРИП — на 17.10.2026; задолженность — на 01.09.2026"))
        self.assertIsNone(K.data_izmeneniya_zapisi(None, None))


class TestPochinitIzmenenie(unittest.TestCase):
    def test_den_svedenij_snyat(self):
        t = blok("11&nbsp;октября&nbsp;2026&nbsp;года", "11.10.2026")
        t2 = K.pochinit_izmenenie(t)
        self.assertNotIn("Последнее изменение", t2)
        self.assertIn("Зарегистрирована", t2)
        self.assertEqual(K.pochinit_izmenenie(t2), t2)

    def test_nakanune_snyat(self):
        self.assertNotIn("Последнее изменение", K.pochinit_izmenenie(blok("10&nbsp;октября&nbsp;2026&nbsp;года", "11.10.2026")))

    def test_nastoyashchaya_ostaetsya(self):
        t = blok("28&nbsp;августа&nbsp;2026&nbsp;года", "07.10.2026")
        self.assertEqual(K.pochinit_izmenenie(t), t)

    def test_bez_bloka_bez_izmenenij(self):
        self.assertEqual(K.pochinit_izmenenie("<p>нет</p>"), "<p>нет</p>")


class TestKartochkiNaSajte(unittest.TestCase):
    def test_net_daty_svedenij_vmesto_izmeneniya(self):
        rx_i = re.compile(r"Последнее изменение записи в&nbsp;ЕГРЮЛ</dt> <dd><span class=\"num\">(\d+)&nbsp;(\S+?)&nbsp;(\d{4})")
        rx_s = re.compile(r'co-daty.*?ЕГРЮЛ · сведения на (\d\d)\.(\d\d)\.(\d{4})', re.S)
        plohie = []
        for f in glob.glob(os.path.join(KOREN, "company", "[0-9]*", "index.html")):
            with open(f, encoding="utf-8") as fh:
                t = fh.read()
            m, s = rx_i.search(t), rx_s.search(t)
            if m and s:
                d = dt.date(int(m.group(3)), K.MESYACY.index(m.group(2)) + 1, int(m.group(1)))
                na = dt.date(int(s.group(3)), int(s.group(2)), int(s.group(1)))
                if d >= na - dt.timedelta(days=1):
                    plohie.append(os.path.basename(os.path.dirname(f)))
        self.assertEqual(plohie, [], "дата изменения = день сведений — perepechatat")


if __name__ == "__main__":
    unittest.main()
