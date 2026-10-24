#!/usr/bin/env python3
"""kartochki-chisla-v1 (24.10.2026, [Ночные-2]): на карточках /company/ число держится со словом — как tipograf-chisla-v1
у статей и разборов (tests/tipograf_statej.py): «17 разделов», «20 лет», «142 млрд», «35 %», «им. В.Д.» (замер 24.10 по
видимому тексту 167 карточек: 379 + 441 + 35 мест → 0).
Сторож: (1) разрывов этих видов в видимом тексте нет; (2) без NB_T карточка — байт в байт прежняя разметка (слова,
<head>, JSON-LD, шапка и подвал не меняются; pochinit_* видят обычный пробел); (3) повторный вызов — те же байты;
(4) «21.1 129-ФЗ» и «129-ФЗ» не трогаем; (5) соседние сборщики берут названия компаний без NB_T."""
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kartochka_render as K  # noqa: E402
import tipograf_statej as TS  # noqa: E402
from test_kartochki_tipograf import kartochki, vidimyj  # noqa: E402

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAZRYVY = {
    "число и единица": re.compile(r"\d (?:₽|%|млн|млрд|тыс|дн|месяц|год|лет|час|минут|рабоч)"),
    "сокращение": TS.SOKR,
}


class TestKartochkiChisla(unittest.TestCase):
    def test_net_razryvov(self):
        plohie, n = [], 0
        for d, t in kartochki():
            n += 1
            tx = vidimyj(t)
            for imya, rx in RAZRYVY.items():
                m = rx.search(tx)
                if m:
                    plohie.append("%s — %s: …%s…" % (d, imya, tx[max(0, m.start() - 20):m.end() + 10]))
            for m in TS.CHISLO.finditer(tx):
                if not TS.METKA.search(tx[max(0, m.start() - 40):m.start()].lower()):
                    plohie.append("%s — счёт: …%s…" % (d, tx[max(0, m.start() - 20):m.end() + 10]))
                    break
        self.assertGreater(n, 100)
        self.assertEqual(plohie[:10], [])

    def test_bez_nb_t_razmetka_prezhnyaya(self):
        # NB_T ставит только этот типограф; снимаем — и повторный проход прежних правил ничего не меняет
        for d, t in list(kartochki())[:30]:
            self.assertIn(K.NB_T, t, d)
            b = K.bez_tipografa(t)
            self.assertEqual(K.tipograf_kartochki(b, chisla=False), b, d)
            self.assertEqual(K.tipograf_kartochki(b, chisla=True), t, d)

    def test_povtor(self):
        for d, t in list(kartochki())[:20]:
            self.assertEqual(K.tipograf_kartochki(t, chisla=True), t, d)

    def test_head_skripty_nomera_zakonov(self):
        t = ('<html><head><title>Балл от 1 до 99 для АО «Х»</title></head><body>'
             '<script type="application/ld+json">{"d": "в 17 разделах"}</script>'
             '<!--podval--><p>Проверка по ИНН</p><!--/podval-->'
             '<p>Балл для АО «Х»: 17 разделов, у каждой — ст. 21.1 129-ФЗ и 30 000 ₽ за 20 лет; им. В.Д. Шашина</p>'
             '</body></html>')
        r = K.tipograf_kartochki(t, chisla=True)
        self.assertIn("<title>Балл от 1 до 99 для АО «Х»</title>", r)
        self.assertIn('{"d": "в 17 разделах"}', r)
        self.assertIn("<!--podval--><p>Проверка по ИНН</p><!--/podval-->", r)
        nb = K.NB_T
        for kusok in ("17" + nb + "разделов", "ст. 21.1 129-ФЗ", "30" + nb + "000" + nb + "₽", "за 20" + nb + "лет",
                      "им." + nb + "В.Д.", "от 1 до 99"):
            self.assertIn(kusok, r)
        self.assertNotIn("&#8209;", r)
        self.assertEqual(K.bez_tipografa(r).replace(K.NB, " "), t)

    def test_pravila_kak_u_statej(self):
        # копия правил tipograf-chisla-v1 (модуль карточки — общий с API, сборщики сайта не импортирует)
        self.assertEqual(K._TK_CHISLO.pattern, TS.CHISLO.pattern)
        self.assertEqual(K._TK_METKA.pattern, TS.METKA.pattern)
        self.assertEqual(K._TK_SOKR.pattern, TS.SOKR.pattern)

    def test_sosednie_sborshchiki_bez_nb_t(self):
        # названия компаний из H1 карточек уходят в статьи и справочник ФНС — без знака типографа карточек
        for put in ("nalogi/nagruzka-po-otraslyam-2025/index.html", "nalogi/kody-statusa-egryul/index.html"):
            with open(os.path.join(KOREN, put), encoding="utf-8") as fh:
                self.assertNotIn(K.NB_T, fh.read(), put)


if __name__ == "__main__":
    unittest.main()
