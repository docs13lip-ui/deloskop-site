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
            if statya in S.BEZ_IMEN:
                continue
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
            self.assertIn(S.PODPIS, b, statya + ": подпись [Право] 24.10 «Компании — для примера раздела…»")
        self.assertGreaterEqual(vsego, 6 * (len(S.TEMY) - len(S.BEZ_IMEN)))

    def test_signaly_bez_imen(self):
        """stati-imena-v1 (ответ [Право] 24.10, разд. 1.1): в статьях о сигналах — ни одной ссылки на карточку."""
        dolzhny = {"nalogi/nedostovernyj-adres-egryul", "115-fz/proverit-kontragenta-zsk-po-inn",
                   "115-fz/zapros-banka-po-115-fz-kak-otvetit"}
        self.assertTrue(dolzhny <= S.BEZ_IMEN, "темы [Право] «ЗСК», «запрос банка», «недостоверный адрес» — без имён")
        temy = {statya for statya, *_ in S.TEMY}
        self.assertTrue(S.BEZ_IMEN <= temy, "в BEZ_IMEN — статья вне TEMY: %s" % (S.BEZ_IMEN - temy))
        for statya in S.BEZ_IMEN:
            t, b = blok_stati(statya)
            self.assertNotRegex(t, r'href="/company/\d', statya + ": в статье о сигнале — ссылка на карточку компании")
            self.assertIn('href="/company/"', b, statya)
            self.assertIn("проверкой по&nbsp;реестрам", b, statya)
        # и наоборот: сигнальное слово в заголовке статьи из TEMY → статья обязана быть в BEZ_IMEN
        for statya in temy - S.BEZ_IMEN:
            zag = (S.zagolovok_stati(statya) or "").lower()
            for slovo in ("зск", "115-фз", "запрос банка", "недостовер", "нет бухотч", "реквизит"):
                self.assertNotIn(slovo, zag, "%s: «%s» в заголовке — статья о сигнале, имена убрать" % (statya, slovo))

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


class TestKartochkiStati(unittest.TestCase):
    """kartochki-stati-v1: карточка → статья раздела (обратное направление)."""

    def stroki(self):
        out = {}
        for d in sorted(os.listdir(os.path.join(KOREN, "company"))):
            put = os.path.join(KOREN, "company", d, "index.html")
            if re.match(r"^\d{10}-", d) and os.path.isfile(put):
                out[d] = (open(put, encoding="utf-8").read(), None)
                t = out[d][0]
                out[d] = (t, S.K_METKI.findall(t))
        return out

    def test_u_kazhdoj_v_indekse_odna(self):
        for d, (t, st) in self.stroki().items():
            if d in KART:
                self.assertEqual(len(st), 1, d + ": у карточки в индексе — ровно одна строка «По теме раздела»")
            else:
                self.assertEqual(st, [], d + ": карточка вне индекса (или ИП) — без строки")

    def test_v_razdele_temy_i_vzaimno(self):
        temy = {statya: (yakor, filtr) for statya, yakor, _, filtr in S.TEMY}
        vpered = {}
        for statya in temy:
            for p in re.findall(r'href="/company/([^/"]+)/#', blok_stati(statya)[1]):
                vpered.setdefault(p, set()).add(statya)
        schet = {}
        for d, (t, st) in self.stroki().items():
            if not st:
                continue
            statya = re.search(r'href="/([^"]+)/"', st[0]).group(1)
            self.assertIn(statya, temy, d)
            yakor, filtr = temy[statya]
            sek = re.search(r'<section[^>]*aria-labelledby="%s"[^>]*>(.*?)</section>' % yakor, t, re.S)
            self.assertTrue(sek and S.K_METKI.search(sek.group(1)), "%s: строка не в разделе #%s" % (d, yakor))
            if filtr:
                self.assertIn(filtr, KART[d][4], d)
            if d in vpered and not any('href="/%s/"' % x in KART[d][6] for x in vpered[d]):
                self.assertIn(statya, vpered[d], d + ": статья назвала карточку — карточка ссылается на неё же")
            self.assertEqual(S._TEG.sub("", st[0]).count(S.zagolovok_stati(statya)), 1, d + ": заголовок статьи")
            self.assertEqual(KART[d][6].count('href="/%s/"' % statya), 0, d + ": статья уже есть на карточке — второй раз не ставим")
            schet[statya] = schet.get(statya, 0) + 1
        nejtr = set(temy) - S.BEZ_IMEN
        self.assertFalse(set(schet) & S.BEZ_IMEN, "stati-kartochki-v3: карточки не ссылаются на статьи-«сигналы»: %s" % (set(schet) & S.BEZ_IMEN))
        if len(KART) >= len(nejtr) * 3:
            self.assertEqual(set(schet), nejtr, "каждая нейтральная статья получает ссылки с карточек")
            self.assertLessEqual(max(schet.values()) - min(schet.values()), 2, "ссылки распределены ровно: %s" % schet)

    def test_net_signalov_na_kartochkah(self):
        """stati-kartochki-v3: ни одна карточка /company/ не ведёт на статью из BEZ_IMEN — ни строкой «По теме», ни иначе."""
        for d in sorted(os.listdir(os.path.join(KOREN, "company"))):
            put = os.path.join(KOREN, "company", d, "index.html")
            if re.match(r"^\d{10}-", d) and os.path.isfile(put):
                t = open(put, encoding="utf-8").read()
                for statya in S.BEZ_IMEN:
                    self.assertNotIn('href="/%s/"' % statya, "".join(S.K_METKI.findall(t)), d)

    def test_bez_slov_ocenki(self):
        for d, (t, st) in self.stroki().items():
            for x in st:
                b = html.unescape(S._TEG.sub(" ", x)).lower()
                for slovo in ("надёжн", "надежн", "лучш", "худш", "рекомендуем", "опасн", "сомнительн", "техническ", "рейтинг"):
                    self.assertNotIn(slovo, b, d)

    def test_snyat_i_postavit(self):
        d = sorted(KART)[0]
        t = open(os.path.join(KOREN, "company", d, "index.html"), encoding="utf-8").read()
        bez = S.ubrat_iz_kartochki(t)
        self.assertNotIn("karta-statya", bez)
        st = re.search(r'href="/([^"]+)/"', S.K_METKI.search(t).group(0)).group(1)
        yakor = dict((a, b) for a, b, _, _ in S.TEMY)[st]
        self.assertEqual(S.vstavit_v_kartochku(t, st, yakor, S.zagolovok_stati(st)), t, "повторная вставка меняет страницу")


if __name__ == "__main__":
    unittest.main()
