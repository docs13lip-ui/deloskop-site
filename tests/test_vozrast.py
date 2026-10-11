"""vozrast-segodnya-v1: pochinit_vozrast — возраст на день сборки, идемпотентность, подпись второй даты реестра."""
import datetime as dt
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

STR = ('<script type="application/ld+json">{"@graph": [{"@type": "Organization", "foundingDate": "2001-10-10"}]}</script>'
       '<p class="co-sub">Действующая · Москва · с&nbsp;2001 года (24&nbsp;года) · ОГРН&nbsp;1</p>'
       '<li class="co-v co-v--ok"><span></span><div><p>Работает 24&nbsp;года — с&nbsp;2001 года</p></div></li>'
       '<p>ПАО «Х» — в реестре с&nbsp;2001&nbsp;года (24&nbsp;года); дальше</p>'
       '<dt>Зарегистрирована</dt> <dd><span class="num">10&nbsp;октября&nbsp;2001&nbsp;года</span> '
       '<span class="co-daty__p">— 24&nbsp;года назад</span></dd>'
       '<dt>Сведения в&nbsp;реестре актуальны на</dt><dd>1</dd>'
       '<p>Руководитель тот же 7&nbsp;лет — с&nbsp;2019 года</p>\n</body>')


class Vozrast(unittest.TestCase):
    def test_do_godovshhiny_chislo_to_zhe(self):
        t = K.pochinit_vozrast(STR, dt.date(2026, 10, 9))
        self.assertEqual(t.count('<span class="vozr" data-s="2001-10-10">24&nbsp;года</span>'), 4)

    def test_posle_godovshhiny_25_let_vezde(self):
        t = K.pochinit_vozrast(STR, dt.date(2026, 10, 12))
        self.assertEqual(t.count('<span class="vozr" data-s="2001-10-10">25&nbsp;лет</span>'), 4)
        self.assertNotIn("24&nbsp;года", t)
        self.assertIn("Руководитель тот же 7&nbsp;лет", t)  # стаж руководителя не трогаем
        self.assertIn("Последнее изменение записи в&nbsp;ЕГРЮЛ", t)
        self.assertEqual(t.count('<script src="/js/vozrast.js" defer></script>'), 1)

    def test_idempotentno_i_cherez_god(self):
        a = K.pochinit_vozrast(STR, dt.date(2026, 10, 12))
        self.assertEqual(K.pochinit_vozrast(a, dt.date(2026, 10, 12)), a)
        b = K.pochinit_vozrast(a, dt.date(2027, 10, 10))
        self.assertEqual(b.count("26&nbsp;лет</span>"), 4)
        self.assertEqual(b.count("vozrast.js"), 1)

    def test_bez_daty_registracii_ne_trogaem(self):
        s = STR.replace('"foundingDate": "2001-10-10"', '"x": 1')
        t = K.pochinit_vozrast(s, dt.date(2026, 10, 12))
        self.assertNotIn('class="vozr"', t)
        self.assertIn("Работает 24&nbsp;года", t)


if __name__ == "__main__":
    unittest.main()
