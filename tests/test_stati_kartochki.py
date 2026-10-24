#!/usr/bin/env python3
"""stati-kartochki-v1 (24.10.2026): статьи /nalogi/ и /115-fz/ ссылаются на карточки /company/ по теме.
Сторож: блок собран (повторная сборка ничего не меняет); каждая ссылка — на карточку юрлица в индексе и на раздел,
который на ней есть (и строку-фильтр темы); до 6 карточек на статью, по алфавиту, «это не рейтинг»; одна карточка —
не больше чем в 2 статьях, пока карточек хватает; статей-оценок (признаки «технических», 54.1, блокировки, зоны ЗСК)
в списке нет; слов оценки в блоке нет."""
import html
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sobrat_stati_kartochki as S  # noqa: E402

KOREN = S.KOREN
KART = {k[0]: k for k in S.kartochki(KOREN)}


def blok_stati(statya):
    t = open(os.path.join(KOREN, statya, "index.html"), encoding="utf-8").read()
    m = S.METKI.search(t)
    return t, (m.group(0) if m else "")


class TestStatiKartochki(unittest.TestCase):
    def test_sobrano(self):
        self.assertEqual(S.sobrat(proverit=True), 0, "блок устарел — python3 tests/sobrat_stati_kartochki.py")

    def test_ssylki_vedut_na_razdel(self):
        vsego = 0
        for statya, yakor, _, filtr in S.TEMY:
            t, b = blok_stati(statya)
            self.assertTrue(b, "нет блока в " + statya)
            self.assertLess(t.find("<!--stati-kartochki-->"), t.find("</article>"), statya + ": блок вне статьи")
            ssylki = re.findall(r'href="/company/([^/"]+)/#([a-z0-9-]+)"', b)
            self.assertTrue(0 < len(ssylki) <= S.NA_STATYU, statya)
            for papka, y in ssylki:
                vsego += 1
                self.assertRegex(papka, r"^\d{10}-", "ИП (12 цифр) не публикуем: " + papka)
                self.assertIn(papka, KART, "карточки нет или она под noindex: " + papka)
                self.assertEqual(y, yakor)
                self.assertIn(y, KART[papka][5], "%s: на карточке нет раздела #%s" % (papka, y))
                if filtr:
                    self.assertIn(filtr, KART[papka][4], "%s: на карточке нет строки «%s»" % (papka, filtr))
            imena = [KART[p][3] for p, _ in ssylki]
            self.assertEqual(imena, sorted(imena), statya + ": не по алфавиту")
            self.assertIn("это не&nbsp;рейтинг", b)
        self.assertGreaterEqual(vsego, 60)

    def test_raspredeleny(self):
        schet = {}
        for statya, *_ in S.TEMY:
            for p in re.findall(r'href="/company/([^/"]+)/#', blok_stati(statya)[1]):
                schet[p] = schet.get(p, 0) + 1
        if len(KART) >= len(S.TEMY) * S.NA_STATYU:
            self.assertLessEqual(max(schet.values()), 1, "карточек хватает — одна карточка в одной статье")
        self.assertLessEqual(max(schet.values()), 2)

    def test_net_statej_ocenok(self):
        zapret = ("priznaki-tehnicheskoj", "tehnicheskij-postavshchik", "54-1", "zablokirovali", "zsk-zony-riska",
                  "sovpadenie-s-perechnem", "perevod-ip")
        for statya, *_ in S.TEMY:
            self.assertFalse(any(z in statya for z in zapret), statya)
            self.assertFalse(re.search(r"<!--stati-kartochki-->", open(os.path.join(KOREN, statya, "index.html"), encoding="utf-8").read()) is None)
        for z in zapret:
            for d in ("nalogi", "115-fz"):
                for p in os.listdir(os.path.join(KOREN, d)):
                    if z in p and os.path.isfile(os.path.join(KOREN, d, p, "index.html")):
                        t = open(os.path.join(KOREN, d, p, "index.html"), encoding="utf-8").read()
                        self.assertNotIn("<!--stati-kartochki-->", t, p)

    def test_bez_slov_ocenki(self):
        for statya, *_ in S.TEMY:
            b = html.unescape(re.sub(r"<[^>]+>", " ", blok_stati(statya)[1])).lower()
            for slovo in ("надёжн", "надежн", "лучш", "худш", "рекомендуем", "опасн", "сомнительн", "техническ"):
                self.assertNotIn(slovo, b, statya)

    def test_odinakovo(self):
        kart = list(KART.values())
        self.assertEqual(S.raspredelit(kart), S.raspredelit(list(reversed(kart))), "выбор зависит от порядка файлов")


if __name__ == "__main__":
    unittest.main()
