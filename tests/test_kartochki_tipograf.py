#!/usr/bin/env python3
"""kartochki-tipograf-v1 (24.10.2026, [Ночные-2]): на карточках /company/ даты, «ООО «…»» и «млн ₽» не рвутся переносом —
те же правила, что tipograf-daty-v1 и tipograf-mln-v1 для остального сайта (до правки: 394 «месяц год», 168 «ООО «»,
57 «день месяц», 4 «млн ₽» на 167 карточках). Сторож: в видимом тексте <body> карточек обычного пробела в этих местах нет;
<head>, JSON-LD, скрипты и блоки сборщиков (шапка, подвал) не трогаются; повторный вызов ничего не меняет; слова прежние."""
import html
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAPKA = os.path.join(KOREN, "company")
MES = "января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря"
PRAVILA = {
    "день и месяц": re.compile(r"(?:^|[^\d,.])\d{1,2} (?:%s)(?![а-яё])" % MES),
    "месяц и год": re.compile(r"(?:^|[^а-яё])(?:%s) \d{4}(?!\d)" % MES),
    "организация": re.compile(r"(?:^|[^\wА-яЁё«-])(?:ООО|ОАО|ЗАО|ПАО|НАО|АО|АНО|НКО|ГУП|МУП|ФГУП) «"),
    "млн ₽": re.compile(r"(?:млн|млрд|трлн|тыс\.) ₽"),
}


def kartochki():
    for d in sorted(os.listdir(PAPKA)):
        put = os.path.join(PAPKA, d, "index.html")
        if re.match(r"^\d{10}-", d) and os.path.isfile(put):
            yield d, open(put, encoding="utf-8").read()


def vidimyj(t):
    t = t[t.find("<body"):]
    t = re.sub(r"<(script|style|code|pre|textarea)\b.*?</\1>", "", t, flags=re.S | re.I)
    t = re.sub(r"<!--([a-z0-9-]+)-->.*?<!--/\1-->", "", t, flags=re.S)
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    return re.sub(r"<[^>]*>", "", t)


class TestKartochkiTipograf(unittest.TestCase):
    def test_na_kartochkah_net_razryva(self):
        plohie = []
        n = 0
        for d, t in kartochki():
            n += 1
            tx = vidimyj(t)
            for imya, rx in PRAVILA.items():
                m = rx.search(tx)
                if m:
                    plohie.append("%s — %s: %s" % (d, imya, m.group(0).strip()))
        self.assertGreater(n, 100)
        self.assertEqual(plohie, [])

    def test_povtor_nichego_ne_menyaet(self):
        for d, t in list(kartochki())[:20]:
            self.assertEqual(K.tipograf_kartochki(t), t, d)

    def test_head_skripty_i_bloki_ne_trogaet(self):
        t = ('<html><head><title>ООО «Лента», 1 сентября 2026</title></head><body>'
             '<script type="application/ld+json">{"name": "ООО «Лента»", "d": "1 сентября 2026"}</script>'
             '<!--podval--><p>ООО «Пример» 2 октября 2026</p><!--/podval-->'
             '<a title="ООО «Лента»" href="/x/">ООО «Лента»</a> на 1 сентября 2026 долг 31,1 млн ₽'
             '</body></html>')
        r = K.tipograf_kartochki(t)
        self.assertIn("<title>ООО «Лента», 1 сентября 2026</title>", r)
        self.assertIn('{"name": "ООО «Лента»", "d": "1 сентября 2026"}', r)
        self.assertIn("<!--podval--><p>ООО «Пример» 2 октября 2026</p><!--/podval-->", r)
        self.assertIn('title="ООО «Лента»"', r)
        self.assertIn((">ООО&nbsp;«Лента»</a> на 1&nbsp;сентября&nbsp;2026 долг 31,1 млн&nbsp;₽").replace("&nbsp;", K.NB), r)

    def test_slova_prezhnie(self):
        t = "<body><p>с 17 апреля 2026 ПАО «Сбербанк» — 2,4 млрд ₽, 2025 год, «ОАО» и АО «Х»</p></body>"
        r = K.tipograf_kartochki(t)
        norm = lambda s: " ".join(html.unescape(s).replace("\xa0", " ").split())  # noqa: E731
        self.assertEqual(norm(r), norm(t))
        self.assertNotEqual(r, t)

    def test_novaya_summa_v_pered_oplatoj(self):
        # «Перед оплатой» берёт сумму из вывода «Коротко» — неразрывно уже в сборщике (ответ на ✎ Ночных запусков 13:55)
        self.assertEqual(K._zn_ed(" 36,1 млрд ₽ "), "36,1" + K.NB + "млрд" + K.NB + "₽")
        self.assertEqual(K._zn_ed("6 тыс. ₽"), "6" + K.NB + "тыс." + K.NB + "₽")


if __name__ == "__main__":
    unittest.main()
