"""svernut-kartochki-v1 ([Ночные-2] 18.11): длинные разделы карточки /company/ свёрнуты до главного (<details>),
сведения не теряются. Решение владельца 18.11 разд. 3 п. 5: «длинные разделы свёрнуты до главного … без потери сведений»."""
import glob
import os
import re
import sys
import unittest

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(KOREN, "tests"))
import kartochka_render as K  # noqa: E402

KARTOCHKI = sorted(glob.glob(os.path.join(KOREN, "company", "[0-9]*", "index.html")))
NE_SVORACHIVAT = ("co-itog", "pm", "pered", "daty")  # итог, «Плюсы и минусы», «Перед оплатой», «Даты» и вход в Паспорт


def chitat(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()


class TestOpublikovannye(unittest.TestCase):
    def test_svernuto_i_obratimo(self):
        self.assertGreater(len(KARTOCHKI), 100)
        s_dal = 0
        for p in KARTOCHKI:
            t = chitat(p)
            r = K.razvernut_kartochku(t)
            self.assertNotIn("co-dal", r, p)
            self.assertEqual(K.svernut_kartochku(r), t, p)  # печать = свёртка того, что видят шаги сборки
            self.assertEqual(t.count("<details class=\"co-dal\""), t.count("<!--/co-dal-"), p)
            # ничего не потеряно: текст страницы без тегов свёртки и подписей «Ещё N» — тот же
            bez = re.sub(r'<summary class="co-dal__s">.*?</summary>', "", t)
            self.assertEqual(re.sub(r"<[^>]+>", "", bez), re.sub(r"<[^>]+>", "", r), p)
            s_dal += "co-dal" in t
        self.assertGreater(s_dal, len(KARTOCHKI) * 0.9)

    def test_glavnoe_ne_svernuto(self):
        for p in KARTOCHKI:
            t = chitat(p)
            for d in re.finditer(r'<details class="co-dal".*?<!--/co-dal-[bs]-->', t, re.S):
                blok = d.group(0)
                self.assertNotIn("<h2", blok, p)  # заголовки разделов (цели оглавления) — всегда на виду
                self.assertNotIn("data-rk-kop", blok, p)  # «Скопировать реквизиты»
                self.assertNotIn("karta-statya", blok, p)  # «По теме раздела» — на виду (sobrat_stati_kartochki)
                self.assertNotIn("/pasport/", blok.replace('/pasport/kontragent/?inn=', ''), p)
            for sid in NE_SVORACHIVAT:
                m = re.search(r'<section class="[^"]*" aria-labelledby="%s"[^>]*>.*?</section>' % sid, t, re.S)
                if m:
                    self.assertNotIn("co-dal", m.group(0), (p, sid))

    def test_magnit_koroche(self):
        t = chitat(os.path.join(KOREN, "company", "2309085638-magnit", "index.html"))
        podpisi = re.findall(r'<summary class="co-dal__s">(.*?)</summary>', t)
        self.assertIn("Все реквизиты", podpisi)
        self.assertIn("Таблица по&nbsp;годам", podpisi)
        self.assertIn("Таблицы баланса и&nbsp;расчётов", podpisi)
        kor = re.search(r'aria-labelledby="korotko".*?</section>', t, re.S).group(0)
        vidno = kor.split("<details", 1)[0]
        self.assertEqual(len(re.findall(r'<li class="co-v ', vidno)), K.DAL_KOROTKO)


class TestFunkcii(unittest.TestCase):
    def test_ne_kartochka_ne_menyaetsya(self):
        for t in ("", "<main><section class=\"co-sec\"><h2>Хаб</h2><ul class=\"co-vv\"></ul></section></main>"):
            self.assertEqual(K.svernut_kartochku(t), t)

    def test_tipograf_i_obratno(self):
        t = chitat(os.path.join(KOREN, "company", "2309085638-magnit", "index.html"))
        b = K.bez_tipografa(t)
        self.assertNotIn("co-dal", b)
        self.assertEqual(K.tipograf_kartochki(b, chisla=True), t)
        self.assertNotIn("co-dal", K.tipograf_kartochki(b))  # промежуточные шаги — без свёртки

    def test_odna_stroka_ne_pryachem(self):
        sek = ('<h2 id="korotko">К</h2><ul class="co-vv">' + '<li class="co-v co-v--ok">x</li>' * 4 + '</ul></section>')
        self.assertNotIn("co-dal", K._dal_korotko(sek))
        sek5 = sek.replace("</ul>", '<li class="co-v co-v--ok">y</li></ul>')
        self.assertIn("Ещё 2&nbsp;строки", K._dal_korotko(sek5))


if __name__ == "__main__":
    unittest.main()
