"""nalog-ostatok-v1 ([Ночные-2] 18.11): задолженность по налогам меньше 500 ₽ на карточке /company/ — «Остаток», не минус
([Право · Налоговый] 18.11, разд. 5): «Задолженность по налогам по набору ФНС на {дата} — {X} ₽»; совет КНД 1120101 — без тревоги;
норму (ст. 69–70 НК) в текст не пишем. От 500 ₽ — минус с долей выручки, как было.
nalog-dolg-slova-v1 ([Ночные-2] 21.11): слова — [Право] 19.11 вечер, разд. 1 (5): «Долг по налогам — {сумма} ₽ на {дата} (ФНС).
Небольшая сумма — уточните у компании, погашена ли»."""
import datetime as dt
import html
import os
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = Path(__file__).resolve().parent.parent
NB = K.NB
_FAKT = re.compile(r'<span>Задолженность по налогам</span><span class="fact__v">([^<]*)</span>')
_PM = re.compile(r'<section class="co-sec co-pm".*?</section>', re.S)
_ITOG = re.compile(r'<section class="co-itog".*?<!--/co-itog-->', re.S)
_PERED = re.compile(r'<section class="co-sec co-pered".*?</section>', re.S)
_KOR = re.compile(r'<section class="co-sec" aria-labelledby="korotko">.*?</section>', re.S)
_ZNACH = re.compile(r'<section class="co-sec co-znachit".*?</section>', re.S)
TREVOGA = re.compile(r"(?i)был[аи]? (долг|задолженност)|долг перед бюджетом|обратите внимание|не(доимк|уплат)")


def txt(s):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", s)).replace(NB, " ").split())


def summa(zn):
    m = re.fullmatch(r"(\d{1,3})(?:&nbsp;| | )₽", zn)
    return int(m.group(1)) if m else None


class TestOpublikovannye(unittest.TestCase):
    def test_kartochki(self):
        n = 0
        for p in sorted((KOREN / "company").glob("*/index.html")):
            t = p.read_text(encoding="utf-8")
            m = _FAKT.search(t)
            s = summa(m.group(1)) if m else None
            if not s or s >= K.NO_POROG:
                self.assertNotIn("pm__ost", t, p.parent.name)
                continue
            n += 1
            imya = p.parent.name
            pm = _PM.search(t).group(0)
            self.assertNotIn('data-pm="tax_debt"', pm.split('<p class="pm__ne pm__ost">')[0], imya + ": не в колонках")
            # nalog-dolg-slova-v1: слова [Право] 19.11 вечер, разд. 1 (5)
            self.assertRegex(txt(pm), r"Долг по налогам — %d ₽ на \d\d\.\d\d\.\d{4} \(ФНС\)\. Небольшая сумма — уточните у компании, "
                             r"погашена ли\." % s, imya)
            self.assertNotIn("Остаток", txt(pm), imya + ": прежнее слово 18.11 снято")
            itog = _ITOG.search(t).group(0)
            ost = re.search(r'<p class="caption co-itog__n co-itog__o">(.*?)</p>', itog, re.S)
            self.assertTrue(ost, imya + ": строка долга под «Не проверяли»")
            self.assertRegex(txt(ost.group(1)), r"^Долг по налогам — %d ₽ на \d\d\.\d\d\.\d{4} \(ФНС\)\. Небольшая сумма" % s, imya)
            self.assertNotIn("Долг по налогам", txt(itog.replace(ost.group(0), "")), imya + ": не в главном и не в «Небольших суммах»")
            self.assertNotIn("Остаток", txt(itog), imya)
            kor = _KOR.search(t).group(0)
            self.assertIn("co-v--info", kor)
            self.assertNotIn("Задолженность перед бюджетом", kor, imya)
            self.assertNotIn("по набору ФНС на", txt(kor), imya + ": «Коротко» — словами [Право] 19.11")
            self.assertRegex(txt(kor), r"Долг по налогам — %d ₽ на \d\d\.\d\d\.\d{4}\. Небольшая сумма — уточните у компании, "
                             r"погашена ли" % s, imya)
            for blok in (_PERED.search(t), _ZNACH.search(t)):
                if blok:
                    self.assertFalse(TREVOGA.search(txt(blok.group(0))), imya + ": " + txt(blok.group(0))[:200])
            pered = txt(_PERED.search(t).group(0))
            self.assertIn("КНД 1120101", pered, imya + ": совет о справке остаётся")
            self.assertNotRegex(t, r"(?i)ст\.\s*(69|70)\s*НК", imya + ": норму до сверки не пишем")
            u = t.replace("&nbsp;", NB)
            self.assertEqual(K.nalog_ostatok_korotko(u), u, imya + ": повтор не меняет байты")
        self.assertGreaterEqual(n, 10, "карточек с остатком меньше 500 ₽ — около 20")

    def test_ot_500_minus(self):
        for p in sorted((KOREN / "company").glob("*/index.html")):
            t = p.read_text(encoding="utf-8")
            m = _FAKT.search(t)
            s = summa(m.group(1)) if m else None
            if s and s >= K.NO_POROG:
                self.assertIn('data-pm="tax_debt"', _PM.search(t).group(0), p.parent.name)


class TestFunkcii(unittest.TestCase):
    LI = ('<li class="co-v co-v--warn"><span class="co-v__z" role="img" aria-label="обратите внимание"></span><div><p>Задолженность '
          'перед бюджетом&#160;— %s&nbsp;₽ на&nbsp;1&nbsp;октября&nbsp;2026. Могла быть погашена после этой даты</p><span class="co-src">'
          'ФНС, открытые данные · сведения на&#160;01.10.2026 · ● подтверждено источником</span></div></li>')

    def test_korotko_porog(self):
        a = K.nalog_ostatok_korotko(self.LI % "499")
        self.assertIn("co-v--info", a)
        self.assertIn("Долг по" + NB + "налогам" + NB + "— 499" + NB + "₽ на" + NB + "01.10.2026. Небольшая сумма" + NB +
                      "— уточните у" + NB + "компании, погашена ли", a)
        self.assertEqual(K.nalog_ostatok_korotko(a), a)
        self.assertEqual(K.nalog_ostatok_korotko(self.LI % "500"), self.LI % "500")

    def test_vyvody(self):
        k = {"fakty": {"nedoimka": {"znachenie": 2, "data": dt.date(2026, 10, 1), "istochnik": "ФНС, открытые данные"}}}
        x = K._v("V10", "warn", "Задолженность перед бюджетом — 2 ₽", "ФНС", k["fakty"]["nedoimka"]["data"])
        orig = K._vyvody_bez_ostatka
        try:
            K._vyvody_bez_ostatka = lambda k_: [x]
            V = K.vyvody(k)
        finally:
            K._vyvody_bez_ostatka = orig
        self.assertEqual(V[0]["ton"], "info")
        self.assertEqual(V[0]["tekst"], K.no_tekst(2, "01.10.2026", fns=False))

    def test_slova_18_11_na_opublikovannyh(self):
        """nalog-dolg-slova-v1: строка «Коротко» со словами 18.11 → слова [Право] 19.11; от 500 ₽ и повтор — без изменений."""
        st = ('<li class="co-v co-v--info"><span class="co-v__z" role="img" aria-label="справочно"></span><div><p>Задолженность '
              'по&nbsp;налогам по&nbsp;набору ФНС на&nbsp;01.10.2026&nbsp;— %s&nbsp;₽</p><span class="co-src">ФНС · сведения на'
              '&#160;01.10.2026</span></div></li>')
        a = K.nalog_ostatok_korotko(st % "8")
        self.assertIn("<p>" + K.no_tekst(8, "01.10.2026", fns=False) + "</p>", a)
        self.assertNotIn("набору ФНС", a)
        self.assertEqual(K.nalog_ostatok_korotko(a), a)
        self.assertEqual(K.nalog_ostatok_korotko(st % "500"), st % "500")

    def test_pered_sovet(self):
        """Совет о справке КНД 1120101 узнаёт новую строку «Коротко» (порядок «сумма — дата»)."""
        orig = K._un_pered_bez_ostatka
        try:
            K._un_pered_bez_ostatka = lambda f: []
            s = K.un_pered({"imya": "АО «Экопэт»", "V": [("info", K.no_tekst(1, "01.10.2026", fns=False))]})
        finally:
            K._un_pered_bez_ostatka = orig
        self.assertEqual(len(s), 1)
        self.assertIn("КНД 1120101", s[0])
        self.assertIn("на" + NB + "01.10.2026" + NB + "— долг 1" + NB + "₽.", s[0])


if __name__ == "__main__":
    unittest.main()
