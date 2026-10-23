"""kartochki-h1-d4 (23.10.2026, [Ночные-2]; ТЗ [Продукт] интенсив 23.10 Д4): h1 карточки — ОПФ не отрывается
от названия, ИНН второй строкой без запятой. python3 tests/test_kartochki_h1_d4.py"""
import pathlib, re, sys, unittest
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import kartochka_render as K

KOREN = pathlib.Path(__file__).resolve().parent.parent
OPF = ("ООО", "АО", "ПАО", "НАО", "ЗАО", "ОАО")


class TestH1D4(unittest.TestCase):
    def test_staryj_vid_perevoditsya(self):
        s = K.h1_d4('ООО «Лента»,<span class="co-h1-inn"> ИНН&nbsp;7814148471</span>', "7814148471")
        self.assertEqual(s, 'ООО&nbsp;«Лента»<span class="co-h1-inn">ИНН&nbsp;7814148471</span>')

    def test_idempotentno(self):
        s = K.h1_d4("ПАО «Сбербанк»", "7707083893")
        self.assertEqual(K.h1_d4(s, "7707083893"), s)
        self.assertEqual(s.count("co-h1-inn"), 1)

    def test_bez_opf_ne_trogaet_nazvanie(self):
        self.assertTrue(K.h1_d4("Банк ВТБ (ПАО)", "7702070139").startswith("Банк ВТБ (ПАО)<span"))

    def test_vse_kartochki(self):
        st = sorted((KOREN / "company").glob("[0-9]*/index.html"))
        self.assertGreater(len(st), 100)
        for p in st:
            h1 = re.findall(r"<h1>(.*?)</h1>", p.read_text(encoding="utf-8"), re.S)
            self.assertEqual(len(h1), 1, p.parent.name)
            self.assertNotIn(",<span", h1[0], p.parent.name)
            self.assertIn('<span class="co-h1-inn">ИНН&nbsp;%s</span>' % p.parent.name[:10], h1[0], p.parent.name)
            opf = h1[0].split("&nbsp;", 1)[0]
            if h1[0].split(" ", 1)[0] in OPF:
                self.fail("ОПФ через обычный пробел: %s" % p.parent.name)
            self.assertTrue(opf in OPF or not h1[0].startswith(OPF), p.parent.name)

    def test_css(self):
        c = (KOREN / "css/co.css").read_text(encoding="utf-8")
        m = re.search(r"\.co-h1-inn\{([^}]*)\}", c)
        self.assertTrue(m and "display:block" in m.group(1) and "var(--muted)" in m.group(1))


if __name__ == "__main__":
    unittest.main()
