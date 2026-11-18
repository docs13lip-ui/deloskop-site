"""oglavlenie-kartochki-v1 ([Ночные-2] 18.11): оглавление карточки /company/ — сбоку на компьютере, строкой на телефоне.
Решение владельца 18.11 разд. 3 пп. 5 и 14, разд. 6 Н3."""
import glob
import os
import re
import sys
import unittest

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(KOREN, "tests"))
import kartochka_render as K  # noqa: E402

KARTOCHKI = sorted(glob.glob(os.path.join(KOREN, "company", "[0-9]*", "index.html")))


def chitat(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()


class TestOpublikovannye(unittest.TestCase):
    def test_dva_spiska_i_skript(self):
        self.assertGreater(len(KARTOCHKI), 100)
        for p in KARTOCHKI:
            t = chitat(p)
            self.assertEqual(t.count('<nav class="co-og" '), 1, p)
            self.assertEqual(t.count('<nav class="co-ogm" '), 1, p)
            self.assertEqual(t.count(K.OG_SKRIPT), 1, p)
            self.assertLess(t.index('<nav class="co-ogm" '), t.index('<div class="co-grid">'), p)
            self.assertLess(t.index('<div class="co-aside">'), t.index('<nav class="co-og" '), p)
            self.assertLess(t.index('<nav class="co-og" '), t.index("<h2 class=\"co-h3\">Полный отчёт</h2>"), p)

    def test_ssylki_vedut_na_razdely(self):
        for p in KARTOCHKI:
            t = chitat(p)
            nav = re.search(r'<nav class="co-og" .*?</nav>', t, re.S).group(0)
            ids = re.findall(r'href="#([a-z]+)"', nav)
            self.assertGreaterEqual(len(ids), 8, p)
            for i in ids:
                self.assertEqual(t.count('id="%s"' % i), 1, (p, i))
            # порядок пунктов = порядок разделов на странице
            poz = [t.index('id="%s"' % i) for i in ids]
            self.assertEqual(poz, sorted(poz), p)

    def test_povtor_te_zhe_bajty(self):
        for p in KARTOCHKI[:40]:
            t = K.bez_tipografa(chitat(p))
            self.assertEqual(K.oglavlenie_kartochki(t), t, p)

    def test_magnit(self):
        t = chitat(os.path.join(KOREN, "company", "2309085638-magnit", "index.html"))
        nav = re.search(r'<nav class="co-og" .*?</nav>', t, re.S).group(0)
        self.assertIn('co-og__t--warn', nav)  # минус есть, существенных нет
        self.assertIn('+8', nav)
        self.assertIn(">Реестры</span><span class=\"co-og__n\">8<", nav)
        self.assertNotRegex(nav, r"надёжн|благонад|опасн|рискован|чист")

    def test_tochka_po_itogu(self):
        for p in KARTOCHKI:
            t = chitat(p)
            itog = K._rk_tekst(re.search(r'<h2 id="itog"[^>]*>(.*?)</h2>', t, re.S).group(1))
            pm = re.search(r'<a href="#pm" data-og="pm">(.*?)</a>', t, re.S).group(1)
            mn = int(re.search(r'data-minusy="(\d+)"', t).group(1))
            if itog.startswith("Есть "):
                self.assertIn("co-og__t--bad", pm, p)
                self.assertIn("есть существенные минусы", pm, p)
            elif mn:
                self.assertIn("co-og__t--warn", pm, p)
            else:
                self.assertIn("co-og__t--ok", pm, p)


class TestShablon(unittest.TestCase):
    T = ('<main><section class="co-itog" aria-labelledby="itog"><h2 id="itog" class="co-itog__s">Есть 1&nbsp;существенный минус</h2></section>'
         '<nav class="co-ogm" aria-label="x"><ol></ol></nav><!--/co-og-->\n'
         '<div class="co-grid">\n<div class="co-main">'
         '<section class="co-sec co-pm" aria-labelledby="pm" data-plyusy="3" data-minusy="2"><h2 id="pm">П</h2></section>'
         '<section class="co-sec" aria-labelledby="korotko"><h2 id="korotko">К</h2><ul><li class="co-v co-v--ok"></li><li class="co-v co-v--info"></li></ul></section>'
         '<section class="co-sec" aria-labelledby="reestry"><h2 id="reestry">Р</h2><div class="fact"></div><div class="fact"></div></section>'
         '</div>\n<div class="co-aside">\n<aside class="co-side card"><h2 class="co-h3">Полный отчёт</h2></aside>\n</div></div></main>')

    def test_sborka(self):
        t = K.oglavlenie_kartochki(self.T)
        self.assertEqual(t.count('<nav class="co-ogm" '), 1)
        self.assertEqual(t.count('<nav class="co-og" '), 1)
        self.assertIn('co-og__t--bad', t)
        self.assertIn(': плюсов 3, минусов 2', t)
        self.assertRegex(t, r'data-og="korotko"><i class="co-og__t co-og__t--ok"')
        self.assertIn('<span class="co-og__p">Реестры</span><span class="co-og__n">2</span>', t)
        self.assertEqual(K.oglavlenie_kartochki(t), t)
        self.assertEqual(t.count(K.OG_SKRIPT), 1)

    def test_malo_razdelov_net(self):
        t = re.sub(r'<section class="co-sec" aria-labelledby="reestry">.*?</section>', "", self.T)
        t = K.oglavlenie_kartochki(t)
        self.assertNotIn("<nav", t)
        self.assertNotIn(K.OG_SKRIPT, t)


if __name__ == "__main__":
    unittest.main()
