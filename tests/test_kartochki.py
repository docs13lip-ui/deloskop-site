#!/usr/bin/env python3
"""Проверки карточек компаний (karta-v1): ворота индексации, ИП, люди, Индекс, SEO-мета, детерминизм.
Собирает вымышленные компании (регион «00») во временную папку — сайт не трогает.
Запуск: python3 tests/test_kartochki.py"""
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kartochki as K  # noqa: E402
import kartochki_obrazec as O  # noqa: E402

KOREN = pathlib.Path(__file__).resolve().parent.parent
NB = " "


def sobrat(zapisi, **kw):
    d = tempfile.mkdtemp()
    shutil.copy(KOREN / "robots.txt", d)
    kart, o = K.sobrat(zapisi, d, **kw)
    return d, kart, o


def chitat(p):
    """Страница карточки как её видит браузер: сущности невидимых знаков (kartochki-ascii-v1) — обратно в знаки."""
    t = pathlib.Path(p).read_text(encoding="utf-8")
    for z, (sush, _) in K.NEVIDIMYE.items():
        t = t.replace(sush, z)
    return t


def stranicy(d):
    return sorted(pathlib.Path(d, "company").glob("*/index.html"))


class TestVorota(unittest.TestCase):
    def test_obychnaya_prohodit(self):
        k = K.iz_check(O.zapis(3))
        self.assertEqual(K.vorota(k), (True, "ок"))

    def test_ip_ne_sozdaetsya_vovse(self):
        ip = O.zapis(1, inn="500100732259", kind="INDIVIDUAL", name="ИП Примеров Иван Петрович")
        d, kart, o = sobrat([ip, O.zapis(2)])
        self.assertEqual(o["ip_otbrosheno"], 1)
        self.assertFalse(any("500100732259" in p.name for p in stranicy(d)))
        self.assertNotIn("500100732259", pathlib.Path(d, "sitemap-companies.xml").read_text(encoding="utf-8"))

    def test_otsev_po_pravilam(self):
        sluchai = {
            "статус не «действующая»": O.zapis(1, status="LIQUIDATING"),
            "моложе 12 месяцев или нет даты регистрации": O.zapis(2, reg_date="2026-03-01"),
            "не ООО/АО (НКО, учреждения — вне волны)": O.zapis(3, name='АНО "ОБРАЗЕЦ"'),
            "нет финансов (доход > 0 по ФНС / ГИР БО)": O.zapis(4, dohod=None),
            "отметка о недостоверности — ждёт формулировки Юриста (V17)": O.zapis(5, nedost="warn"),
        }
        for pr, r in sluchai.items():
            k = K.iz_check(r)
            self.assertEqual(K.vorota(k)[1], pr)

    def test_bez_daty_svedenij_ne_proverka(self):
        r = O.zapis(6)
        for s in r["signals"]:
            s["as_of"] = ""
        r["checked_at"] = "2026-09-29T10:00:00+03:00"
        k = K.iz_check(r)
        ok, pr = K.vorota(k)
        self.assertFalse(ok, "без дат сведений ФНС карточка не должна проходить: " + pr)

    def test_menshe_treh_vyvodov_net_stranicy(self):
        r = O.zapis(7, shtat=1, dohod=0)
        r["signals"] = [s for s in r["signals"] if "Долги" not in s["title"] and "Уплач" not in s["title"]]
        d, kart, o = sobrat([r])
        self.assertEqual(kart, [])
        self.assertFalse(pathlib.Path(d, "sitemap-companies.xml").exists())
        self.assertNotIn("sitemap-companies", pathlib.Path(d, "robots.txt").read_text(encoding="utf-8"))

    def test_gruppy_i_kvoty(self):
        z = [O.zapis(i, dohod=(20e6 if i < 6 else 2e6), shtat=(8 if i < 6 else 2), reg_date="2024-01-10") for i in range(10)]
        _, kart, o = sobrat(z, spros=4, kontrol=2)
        self.assertEqual((o["spros"], o["kontrol"]), (4, 2))
        self.assertEqual([k["_gr"] for k in kart], ["spros"] * 4 + ["kontrol"] * 2)

    def test_stupen_ogranichivaet(self):
        _, kart, o = sobrat(O.nabor(30), limit=10)
        self.assertEqual(len(kart), 10)
        self.assertEqual(o["proshli"], 30)


class TestStranica(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.pop("PERSONS_PUBLIC", None)
        cls.d, cls.kart, cls.o = sobrat(O.nabor(30))
        cls.html = {p: chitat(p) for p in stranicy(cls.d)}
        cls.syrye = {p: p.read_text(encoding="utf-8") for p in stranicy(cls.d)}

    def test_seo_meta(self):
        for p, t in self.html.items():
            ti = re.search(r"<title>(.*?)</title>", t).group(1)
            ti = ti.replace("&quot;", '"').replace("&amp;", "&")
            self.assertLessEqual(len(ti), 70, ti)
            self.assertEqual(ti.count("«"), ti.count("»"), "кавычки непарные: " + ti)
            de = re.search(r'<meta name="description" content="([^"]*)"', t).group(1)
            self.assertLessEqual(len(de.replace("&quot;", '"').replace("&amp;", "&")), 160)
            self.assertNotIn("noindex", t)
            kan = re.search(r'<link rel="canonical" href="([^"]+)"', t).group(1)
            self.assertTrue(kan.endswith("/company/" + p.parent.name + "/"), kan)

    def test_json_ld_bez_rejtinga_i_lyudej(self):
        for t in self.html.values():
            ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', t, re.S).group(1))
            s = json.dumps(ld, ensure_ascii=False)
            self.assertNotIn("aggregateRating", s)
            self.assertNotIn("founder", s)
            self.assertIn('"taxID"', s)

    def test_lyudi_vyklyucheny_po_umolchaniyu(self):
        for t in self.html.values():
            self.assertNotIn("Примеров", t)
            self.assertNotIn("Руководство и владельцы", t)

    def test_lyudi_s_flagom(self):
        os.environ["PERSONS_PUBLIC"] = "1"
        try:
            d, _, _ = sobrat(O.nabor(3))
            t = chitat(stranicy(d)[0])
            self.assertIn("Руководство и владельцы", t)
        finally:
            os.environ.pop("PERSONS_PUBLIC", None)

    def test_ascii_nevidimye(self):
        """kartochki-ascii-v1: в файлах карточек и хаба нет «сырых» невидимых знаков — патч переносится перепечаткой."""
        hub = pathlib.Path(self.d, "company", "index.html")
        for p in list(self.syrye) + [hub]:
            t = p.read_text(encoding="utf-8")
            self.assertIsNone(K._NEV.search(t), p)
        t = next(iter(self.syrye.values()))
        self.assertIn("&nbsp;", t)  # неразрывные пробелы на месте — только записаны сущностью
        ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', t, re.S).group(1))
        self.assertNotIn("&nbsp;", json.dumps(ld, ensure_ascii=False))  # в JSON-LD сущность не раскрылась бы

    def test_bez_nevidimyh_obratimo(self):
        import html as H
        iskh = '<p>48,3\u00a0млн\u00a0₽ и\u202f5</p><script type="application/ld+json">{"name":"А\u00a0Б"}</script><b>в\u00a0г</b>'
        t = K.bez_nevidimyh(iskh)
        self.assertIsNone(K._NEV.search(t))
        self.assertEqual(H.unescape(t.split("<script")[0]), iskh.split("<script")[0])
        self.assertEqual(json.loads(re.search(r"<script[^>]*>(.*?)</script>", t).group(1))["name"], "А\u00a0Б")
        self.assertEqual(K.bez_nevidimyh(t), t)  # повторная запись ничего не меняет
        self.assertEqual(K.bez_nevidimyh("abc"), "abc")

    def test_net_telefonov_i_pochty_kompanii(self):
        for t in self.html.values():
            self.assertNotRegex(t, r"\+7[\s(]?\d{3}")
            self.assertEqual(set(re.findall(r"mailto:([^\"?]+)", t)), {"help@deloskop.ru"})

    def test_indeks_tolko_za_vorotami(self):
        for t in self.html.values():
            self.assertIn("Индекс" + NB + "— считаем", t)
        k = K.iz_check(O.zapis(1, indeks={"ball": 74, "polnota": 65}))
        self.assertEqual(K.indeks_vid(k)["rezhim"], "chislo")
        self.assertIn("Индекс 74", K.title(k))
        for plohoe in ({"ball": 74, "polnota": 59}, {"ball": 74.5, "polnota": 80}, {"ball": 74, "polnota": 80, "status": "schitaem"}, 74):
            k = K.iz_check(O.zapis(1, indeks=plohoe))
            self.assertEqual(K.indeks_vid(k)["rezhim"], "schitaem", plohoe)

    def test_zony_indeksa_222(self):
        # [Право] 02.10 12:30 разд. 4: зоны карточки = уровни методики; без «надёжн/опасн/высокий риск» (222-ФЗ)
        m = json.loads((KOREN / "indeks" / "metodika-v1.json").read_text(encoding="utf-8"))
        zony = [K.indeks_vid(K.iz_check(O.zapis(1, indeks={"ball": b, "polnota": 90})))["zona"] for b in (80, 60, 40, 10)]
        self.assertEqual(zony, [u["nazvanie"] for u in m["urovni"]])
        for z in zony:
            self.assertNotRegex(z, r"(?i)над[её]жн|опасн|высокий риск")

    def test_istochnik_i_data_u_kazhdogo_vyvoda(self):
        for k in self.kart:
            self.assertGreaterEqual(len(k["_V"]), 3)
            for v in k["_V"]:
                self.assertTrue(v["istochnik"] and v["data"], v)
                self.assertNotRegex(v["tekst"], K.STOP_SLOVA)
            self.assertLessEqual(max(sum(1 for v in k["_V"] if v["istochnik"] == i) for i in {v["istochnik"] for v in k["_V"]}), 2)

    def test_ne_proveryali_ne_znachit_net(self):
        for t in self.html.values():
            m = re.search(r'<div class="co-np">.*?</ul>', t, re.S)
            self.assertTrue(m)
            for li in re.findall(r"<li>(.*?)</li>", m.group(0)):
                self.assertNotRegex(li, K.NE_PROVERYALI_ZAPRET, li)

    def test_pohozhie_tolko_iz_volny_bez_sebya(self):
        adresa = {K.adres_str(k) for k in self.kart}
        for p, t in self.html.items():
            sos = re.search(r'<ul class="co-sos">(.*?)</ul>', t, re.S)
            self.assertTrue(sos)
            ss = re.findall(r'href="([^"]+)"', sos.group(1))
            self.assertLessEqual(len(ss), 6)
            self.assertNotIn("/company/" + p.parent.name + "/", ss)
            for a in ss:
                self.assertIn(a, adresa)

    def test_sitemap_i_lastmod(self):
        sm = pathlib.Path(self.d, "sitemap-companies.xml").read_text(encoding="utf-8")
        self.assertEqual(sm.count("<url>"), len(self.kart) + 1)  # + хаб (≥ 20 карточек)
        self.assertIn("<loc>https://deloskop.ru/company/</loc>", sm)
        self.assertNotIn("2026-09-30", sm)
        self.assertIn("Sitemap: https://deloskop.ru/sitemap-companies.xml", pathlib.Path(self.d, "robots.txt").read_text(encoding="utf-8"))

    def test_hab_noindex_malo_kartochek(self):
        d, kart, _ = sobrat(O.nabor(5))
        hub = chitat(pathlib.Path(d, "company", "index.html"))
        self.assertIn('content="noindex, follow"', hub)
        self.assertNotIn("<loc>https://deloskop.ru/company/</loc>", pathlib.Path(d, "sitemap-companies.xml").read_text(encoding="utf-8"))

    def test_determinirovano_i_chistka(self):
        d, _, o1 = sobrat(O.nabor(12))
        _, o2 = K.sobrat(O.nabor(12), d)
        self.assertEqual(o2["izmeneno_stranic"], 0, "повторная сборка тех же данных меняет страницы")
        _, o3 = K.sobrat(O.nabor(12)[:5], d)
        self.assertEqual(len(stranicy(d)), 5, "карточки, выпавшие из волны, должны удаляться")


class TestPasportNaKartochke(unittest.TestCase):
    """karta-v1.1: ссылка «Собрать Паспорт» по ИНН и знаки ● ◆ ○ как в Паспорте контрагента."""

    def test_ssylka_na_pasport_po_inn(self):
        k = K.iz_check(O.zapis(3))
        t = K.html_kartochki(k, K.vyvody(k), [])
        self.assertIn('href="/pasport/kontragent/?inn=%s" rel="nofollow"' % k["inn"], t)
        self.assertEqual(t.count("/pasport/kontragent/?inn="), 1)
        self.assertNotIn("?id=", t, "номер досье на карточку не попадает")

    def test_znaki_kak_v_pasporte(self):
        self.assertEqual(K.STATUS_METKA["rasschitano"], "◆ рассчитано Делоскопом")
        self.assertNotIn("◐", "".join(K.STATUS_METKA.values()))


class TestChestnostKarta2(unittest.TestCase):
    """karta-v2: карточка не обещает непроверяемое (Ф6) и не выдаёт пустое поле за проверку (Ф7)."""

    @staticmethod
    def html_s(**sig):
        r = O.zapis(4)
        if sig:
            r["signals"].append(dict({"title": "Дисквалификация руководителя", "detail": "не обнаружена", "as_of": "2026-09-29"}, **sig))
        k = K.iz_check(r)
        return K.html_kartochki(k, K.vyvody(k), [])

    @staticmethod
    def stroka_diskval(t):
        m = re.search(r'<div class="fact"><span>Дисквалификация[^<]*</span>.*?</div>', t, re.S)
        return m.group(0) if m else ""

    def test_polnyj_otchet_ne_obeshchaet_nepodklyuchennoe(self):
        t = self.html_s()
        for blok in re.findall(r'<aside class="co-side card"[^>]*>(?:(?!</aside>).)*?</aside>', t, re.S):
            if "Похожие компании" in blok:
                continue
            tekst = re.sub(r"<[^>]+>", " ", blok)
            self.assertNotRegex(tekst, K.NE_OBESHCHAEM, tekst)
        self.assertIn("что проверить самим", t)

    def test_diskval_iz_dadata_ne_proverka(self):
        s = self.stroka_diskval(self.html_s(status="ok", source="DaData, ЕГРЮЛ"))
        self.assertTrue(s, "строка дисквалификации пропала")
        self.assertIn("не проверяли", s)
        self.assertNotIn("подтверждено", s)
        self.assertNotIn("не обнаружена", s)
        self.assertIn("Реестр дисквалифицированных лиц ФНС — подключаем", s)
        self.assertNotIn("дата сведений", s)

    def test_diskval_bez_daty_ne_proverka(self):
        s = self.stroka_diskval(self.html_s(status="bad", source="ЕГРЮЛ", as_of=""))
        self.assertIn("не проверяли", s)

    def test_diskval_najdennaya_otmetka_ostaetsya(self):
        s = self.stroka_diskval(self.html_s(status="bad", detail="до 12.03.2027", source="ЕГРЮЛ"))
        self.assertIn("● подтверждено источником", s)
        self.assertIn("до 12.03.2027", s)

    def test_diskval_iz_reestra_fns_proverka(self):
        s = self.stroka_diskval(self.html_s(status="ok", source="ФНС, реестр дисквалифицированных лиц", as_of="2026-09-27"))
        self.assertIn("● подтверждено источником", s)
        self.assertIn("не обнаружена", s)


class TestMelochi(unittest.TestCase):
    def test_imya(self):
        self.assertEqual(K.imya('ООО "ТД "ЧЕРНОЗЕМЬЕ"'), "ООО «ТД Черноземье»")
        self.assertEqual(K.imya('ООО "АЛЬФА-ТРЕЙД"'), "ООО «Альфа-Трейд»")
        self.assertEqual(K.imya("ООО «Ромашка»"), "ООО «Ромашка»")

    def test_dlinnyj_title(self):
        k = K.iz_check(O.zapis(1, name='ООО "НАУЧНО-ПРОИЗВОДСТВЕННОЕ ОБЪЕДИНЕНИЕ СТРОИТЕЛЬНЫХ И ДОРОЖНЫХ ТЕХНОЛОГИЙ ЧЕРНОЗЕМЬЯ"'))
        t = K.title(k)
        self.assertLessEqual(len(t), 70, t)
        self.assertEqual(t.count("«"), t.count("»"), t)

    def test_slug(self):
        self.assertEqual(K.slug("ООО «Счёт-Щит Южный»"), "schet-schit-yuzhnyj")

    def test_inn(self):
        self.assertTrue(K.inn_ok("7707083893"))
        self.assertFalse(K.inn_ok("7707083894"))
        self.assertFalse(K.inn_ok("500100732259"))

    def test_dengi(self):
        self.assertEqual(K.dengi(48_300_000), "48,3" + NB + "млн" + NB + "₽")
        self.assertEqual(K.dengi(412_000), "412" + NB + "тыс." + NB + "₽")
        self.assertEqual(K.dengi(5_846_000_000_000), "5,8" + NB + "трлн" + NB + "₽")

    def test_region(self):
        self.assertEqual(K.region_gorod("398000, Липецкая обл, г Липецк, ул Ленина, д 1"), ("Липецкая область", "Липецк"))
        self.assertEqual(K.region_gorod("г Москва, ул Тверская, д 1"), ("Москва", "Москва"))


def _zhivoj_otvet(data_dates, kpi, signals=None):
    """Ответ /api/check в том виде, какой отдаёт живой API 01.10: даты наборов — строкой в dossier.data_dates."""
    return {
        "company": {"inn": "7707083893", "ogrn": "1027700132195", "kind": "LEGAL", "status": "ACTIVE",
                    "name_short": "ПАО \"ОБРАЗЕЦ\"", "reg_date": "2003-05-10", "address": "г Москва, ул Тверская, д 1",
                    "okved": "47.11"},
        "checked_at": "2026-10-01",
        "signals": signals or [
            {"title": "Возраст компании", "status": "ok", "source": "ЕГРЮЛ", "as_of": None, "detail": "С 10.05.2003"},
            {"title": "Задолженность по налогам", "status": "ok", "source": "ФНС, открытые данные", "as_of": "01.09.2026", "detail": "Нет"},
        ],
        "dossier": {"data_dates": data_dates, "kpi": kpi, "charts": {}},
    }


class TestDatyV2(unittest.TestCase):
    """daty-v2 (02.10): дата набора ФНС «уплаченные налоги» из досье (daty-api-v1, коммит 3) → вывод V23 с годом."""

    def test_nalogi_s_datoj(self):
        r = _zhivoj_otvet("ЕГРЮЛ/ЕГРИП — на 01.10.2026; последнее изменение записи ЕГРЮЛ/ЕГРИП — 30.06.2026; "
                          "задолженность — на 01.09.2026; уплаченные налоги — на 31.12.2025",
                          [{"label": "Налоги и взносы за год", "value": 2350000000},
                           {"label": "Долг перед бюджетом", "value": None, "text": "Нет"}])
        d = K.daty_naborov(r["dossier"]["data_dates"])
        self.assertEqual(d["nalogi"], K.dt.date(2025, 12, 31))
        self.assertEqual(d["egrul"], K.dt.date(2026, 10, 1))   # «последнее изменение записи» — без «на», не дата сведений
        k = K.iz_check(r)
        t = k["fakty"]["nalogi"]
        self.assertEqual(t["data"], K.dt.date(2025, 12, 31))
        self.assertEqual(t["god"], 2025)
        teksty = [x["tekst"] for x in K.vyvody(k)]
        self.assertTrue(any(x.startswith("Уплатила налогов и взносов — 2,4" + NB + "млрд" + NB + "₽ за" + NB + "2025") for x in teksty), teksty)

    def test_nalogi_bez_daty_molchit(self):
        k = K.iz_check(_zhivoj_otvet("задолженность — на 01.09.2026", [{"label": "Налоги и взносы за год", "value": 2350000000}]))
        self.assertFalse(any(x["tekst"].startswith("Уплатила") for x in K.vyvody(k)))


class TestDatyV1(unittest.TestCase):
    """daty-v1 (02.10): даты наборов из dossier.data_dates и выручка ГИР БО — иначе живые ответы не проходили ворота."""

    def test_razbor_strok(self):
        d = K.daty_naborov("ЕГРЮЛ/ЕГРИП — на 30.06.2026; задолженность — на 01.09.2026; "
                           "доходы и расходы — на 31.12.2025; численность — на 31.12.2025; мусор; штрафы — на 99.99.2026")
        self.assertEqual(d["nedoimka"], K.dt.date(2026, 9, 1))
        self.assertEqual(d["dohod"], K.dt.date(2025, 12, 31))
        self.assertEqual(d["shtat"], K.dt.date(2025, 12, 31))
        self.assertNotIn("shtrafy", d)          # битая дата — «не проверяли», не «сегодня»
        self.assertEqual(K.daty_naborov(None), {})

    def test_vyruchka_girbo_i_shtat(self):
        r = _zhivoj_otvet("ЕГРЮЛ/ЕГРИП — на 30.06.2026; задолженность — на 01.09.2026; численность — на 31.12.2025",
                          [{"label": "Выручка за 2025", "value": 412062000, "delta": 14.2},
                           {"label": "Сотрудники", "value": None, "text": "36 чел."},
                           {"label": "Долг перед бюджетом", "value": None, "text": "Нет"}])
        k = K.iz_check(r)
        V = K.vyvody(k)
        d = k["fakty"]["dohod"]
        self.assertEqual(d["istochnik"], "ГИР БО, бухгалтерская отчётность")
        self.assertEqual(d["data"], K.dt.date(2025, 12, 31))
        self.assertEqual(k["fakty"]["shtat"]["data"], K.dt.date(2025, 12, 31))
        teksty = [x["tekst"] for x in V]
        self.assertIn("Выручка за" + NB + "2025 — 412" + NB + "млн" + NB + "₽, на" + NB + "14" + NB + "% больше, чем годом раньше", teksty)
        self.assertEqual(K.vorota(k, V), (True, "ок"))
        # ЕГРЮЛ — дата проверки: «на 30.06.2026» в досье — дата последних изменений записи, не дата сведений
        self.assertEqual(k["egrul_data"], K.dt.date(2026, 10, 1))

    def test_bez_dat_naborov_ne_vydumyvaem(self):
        # нет строки дат — численность без даты не становится выводом, ворота честно не проходят
        r = _zhivoj_otvet("", [{"label": "Сотрудники", "value": None, "text": "36 чел."}])
        k = K.iz_check(r)
        self.assertIsNone(k["fakty"]["shtat"]["data"])
        self.assertFalse(K.vorota(k)[0])

    def test_skrytaya_otchetnost(self):
        # компании, раскрытие отчётности которых ограничено: в ГИР БО и наборах ФНС чисел нет → карточки нет
        r = _zhivoj_otvet("ЕГРЮЛ/ЕГРИП — на 21.09.2026; задолженность — на 01.09.2026",
                          [{"label": "Долг перед бюджетом", "value": None, "text": "Нет"}])
        self.assertEqual(K.vorota(K.iz_check(r)), (False, "нет финансов (доход > 0 по ФНС / ГИР БО)"))


class TestObshchijRender(unittest.TestCase):
    """render-v1: одна отрисовка для сайта (статичные файлы) и API (/company/ через nginx со ступени 2)."""

    def test_modul_chistyj(self):
        # только стандартная библиотека, без файлов, сети и модулей сайта — API подключает его как есть
        import ast
        src = (KOREN / "tests" / "kartochka_render.py").read_text(encoding="utf-8")
        t = ast.parse(src)
        imp = set()
        for n in ast.walk(t):
            if isinstance(n, ast.Import):
                imp |= {a.name for a in n.names}
            elif isinstance(n, ast.ImportFrom):
                imp.add(n.module)
        self.assertLessEqual(imp, {"datetime", "html", "json", "math", "os", "re", "urllib.parse"}, imp)
        vyzovy = {n.func.id if isinstance(n.func, ast.Name) else n.func.attr for n in ast.walk(t) if isinstance(n, ast.Call)}
        for zapret in ("open", "urlopen", "remove", "rmtree", "makedirs", "system", "run"):
            self.assertNotIn(zapret, vyzovy, zapret)
        self.assertNotRegex(src, r"fonts\.(googleapis|gstatic)")

    def test_odin_render(self):
        import kartochka_render as R
        for imya_ in ("html_kartochki", "html_haba", "vorota", "vyvody", "iz_check", "adres_str", "persons_public"):
            self.assertIs(getattr(K, imya_), getattr(R, imya_), imya_)

    def test_api_ravno_fajlu_sajta(self):
        # страница из API после той же оболочки (шапка, подвал, бета) = файл статичной волны, байт в байт
        import kartochka_render as R
        import sobrat_shapku as ss
        os.environ.pop("PERSONS_PUBLIC", None)
        zap = O.nabor(12)
        d, kart, _ = sobrat(zap)
        r = ss.rekv_sajta()
        podval, shapka = ss.podval_html(r), ss.shapka_html()
        pervye = {}
        kom = json.loads((KOREN / "data" / "kommentarii.json").read_text(encoding="utf-8"))  # API передаёт тот же файл сайта
        for z in zap:
            ok, pr, adres, telo = R.kartochka_iz_check(z, kart, kom)
            self.assertTrue(ok, pr)
            pervye[adres] = ss.sobrat_stranicu(telo, r, podval, shapka)
        self.assertEqual(len(pervye), len(kart))
        for adres, txt in pervye.items():
            fajl = pathlib.Path(d, adres.strip("/"), "index.html").read_text(encoding="utf-8")
            self.assertEqual(K.bez_nevidimyh(txt), fajl, adres)  # API отдаёт знаки, сайт хранит сущности — браузер видит одно и то же

    def test_api_ip_i_vorota(self):
        import kartochka_render as R
        ip = O.zapis(1, inn="500100732259", kind="INDIVIDUAL", name="ИП Примеров Иван Петрович")
        self.assertEqual(R.kartochka_iz_check(ip)[0::2], (False, None))
        self.assertIsNone(R.kartochka_iz_check(ip)[3])
        ok, pr, adres, telo = R.kartochka_iz_check(O.zapis(2, status="LIQUIDATED"))
        self.assertEqual((ok, adres, telo), (False, None, None))
        self.assertIn("действующая", pr)

    def test_api_bez_lyudej_po_umolchaniyu(self):
        import kartochka_render as R
        os.environ.pop("PERSONS_PUBLIC", None)
        telo = R.kartochka_iz_check(O.zapis(3))[3]
        self.assertIn("<!--shapka--><!--/shapka-->", telo)
        self.assertNotIn("Примеров", telo)


class TestKommentariiKartochki(unittest.TestCase):
    """kommentarii-kartochki-v1: «Комментарий команды Делоскопа» под строками «Проверки по реестрам» — то же правило, что в отчёте."""

    def setUp(self):
        self.kom = json.loads((KOREN / "data" / "kommentarii.json").read_text(encoding="utf-8"))

    def _html(self, z, kom=True):
        k = K.iz_check(z)
        return K.html_kartochki(k, K.vyvody(k), [], self.kom if kom else None)

    def test_pod_proverennym_faktom_i_ogovorka_odin_raz(self):
        t = self._html(O.zapis(3))
        i = t.index("<span>Долги по налогам</span>")
        j = t.index('data-kom="nedoimka"')
        self.assertLess(i, j)
        self.assertNotIn('class="fact"', t[i + 30:j])  # сразу под своей строкой
        self.assertIn('data-kom="nedostovernost"', t)
        self.assertEqual(t.count('class="kom-og"'), 1)
        self.assertIn(K.KOM_OGOVORKA, t)
        self.assertGreater(t.index('class="kom-og"'), t.rindex('class="kom '))
        self.assertIn("нормы сверены", t)

    def test_bez_biblioteki_net(self):
        t = self._html(O.zapis(3), kom=False)
        self.assertNotIn("kom", re.sub(r"kommentar", "", t.split("<main", 1)[1]))

    def test_chernovik_ne_vyhodit(self):
        # численность «ok» — зелёный тон у записи shtat ждёт [Право] → комментария нет
        t = self._html(O.zapis(3))
        self.assertNotIn('data-kom="shtat"', t)
        self.assertNotIn('data-kom="nalogi"', t)

    def test_ne_proveryali_bez_kommentariya(self):
        z = O.zapis(3)
        for s in z["signals"]:
            if s["title"] == "Долги по налогам":
                s["as_of"] = None  # нет даты сведений → строка «не проверяли»
        t = self._html(z)
        self.assertNotIn('data-kom="nedoimka"', t)
        z = O.zapis(3, dolg="не проверяли: набор недоступен")
        self.assertNotIn('data-kom="nedoimka"', self._html(z))  # «не проверяли ≠ не нашли»: зелёный текст не ставим

    def test_kras_pri_dolge(self):
        z = O.zapis(3, dolg_status="bad", dolg="есть, 1 200 000 ₽")
        k = K.iz_check(z)
        t = K.html_kartochki(k, K.vyvody(k), [], self.kom)
        self.assertIn('class="kom kom--kras" data-kom="nedoimka"', t)

    def test_vorota_ne_menyayutsya(self):
        for i in range(12):
            k = K.iz_check(O.zapis(i))
            V = K.vyvody(k)
            self.assertEqual(K.vorota(k, V), K.vorota(K.iz_check(O.zapis(i)), K.vyvody(K.iz_check(O.zapis(i)))))
            self.assertFalse(any("Комментарий" in x["tekst"] for x in V))

    def test_razmetka_kak_v_js(self):
        sig = [{"title": "Долги по налогам", "detail": "нет", "status": "ok"},
               {"title": "Задолженность по налогам", "detail": "есть", "status": "bad"},
               {"title": "Адрес", "detail": "Отметок о недостоверности нет", "status": "ok"},
               {"title": "Дисквалификация руководителя", "detail": "есть", "status": "bad"},
               {"title": "ФССП", "detail": "2 производства", "status": "warn"}]
        js = ("const K=require('./js/kommentarii.js');const S=require('./data/kommentarii.json');"
              "console.log(JSON.stringify(%s.map(s=>K.html(K.najti(S,s)))))" % json.dumps(sig, ensure_ascii=False))
        out = subprocess.run(["node", "-e", js], cwd=KOREN, capture_output=True, text=True, check=True).stdout
        py = [K.kom_html(K.kom_najti(self.kom, s)) for s in sig]
        self.assertEqual(py, json.loads(out))
        self.assertGreaterEqual(sum(1 for x in py if x), 3)
        og = subprocess.run(["node", "-e", "process.stdout.write(require('./js/kommentarii.js').ogovorkaHtml())"],
                            cwd=KOREN, capture_output=True, text=True, check=True).stdout
        self.assertEqual(K.kom_ogovorka_html(), og)

    def test_css_est(self):
        css = (KOREN / "css" / "co.css").read_text(encoding="utf-8")
        for c in (".co .kom{", ".co .kom--zel", ".co .kom--zhel", ".co .kom--kras", ".co .kom__h", ".co .kom-og"):
            self.assertIn(c, css)


class TestObolochka(unittest.TestCase):
    """obolochka-v1: API надевает на карточку шапку, подвал и бету из partials/obolochka.json — байт в байт как сайт."""

    def _ss(self):
        import sobrat_shapku as ss
        return ss

    def test_ravno_sobrat_stranicu_beta_i_bez(self):
        import kartochka_render as R
        ss = self._ss()
        os.environ.pop("PERSONS_PUBLIC", None)
        zap = O.nabor(8)
        kart = [K.iz_check(z) for z in zap]
        for beta in (True, False):
            r = ss.rekv_sajta()
            r["_beta"] = beta
            if not beta:
                r["_est"] = False  # реквизиты ИП в карточку не идут ни в каком режиме — проверяем только оболочку
            podval, shapka = ss.podval_html(r), ss.shapka_html()
            ob = json.loads(ss.obolochka(r, podval, shapka))
            self.assertEqual(ob["beta"], beta)
            for z in zap:
                ok, pr, adres, telo = R.kartochka_iz_check(z, kart)
                if not ok:
                    continue
                self.assertEqual(R.nadet_obolochku(telo, ob), ss.sobrat_stranicu(telo, r, podval, shapka), (beta, adres))

    def test_fajl_svezhij(self):
        # partials/obolochka.json собран из текущих шапки, подвала, беты и модуля отрисовки (иначе — sobrat_shapku.py)
        ss = self._ss()
        r = ss.rekv_sajta()
        fajl = (KOREN / "partials" / "obolochka.json").read_text(encoding="utf-8")
        self.assertEqual(fajl, ss.obolochka(r, ss.podval_html(r), ss.shapka_html()))
        ob = json.loads(fajl)
        self.assertEqual(set(ob), {"versiya", "beta", "render", "head", "shapka", "podval"})
        self.assertRegex(ob["render"], r"^[0-9a-f]{16}$")
        self.assertNotRegex(fajl, r"fonts\.(googleapis|gstatic)")
        self.assertIn('<a class="skip" href="#main">', ob["shapka"])
        self.assertTrue(ob["podval"].startswith("<!--podval-->"))

    def test_bez_metki_none(self):
        import kartochka_render as R
        ob = {"head": "", "shapka": "", "podval": ""}
        self.assertIsNone(R.nadet_obolochku(None, ob))
        self.assertIsNone(R.nadet_obolochku("<html><head></head><body></body></html>", ob))


def _gazprom_kak_v_api(**dop):
    """Живой ответ /api/check 02.10 (форма полей сохранена; ФИО убраны): сигнал «Адрес» с деталью о недостоверности,
    kpi без «Выручки» у части компаний, ряд выручки в charts.revenue, «Руководит с» в разделе досье."""
    r = _zhivoj_otvet("ЕГРЮЛ/ЕГРИП — на 29.09.2026; задолженность — на 01.09.2026", [{"label": "Долг перед бюджетом", "value": None, "text": "Нет"}],
                      signals=[{"id": "status", "title": "Статус", "status": "ok", "detail": "Действующая", "source": "ЕГРЮЛ/ЕГРИП", "as_of": None},
                               {"id": "address", "title": "Адрес", "status": "ok", "detail": "Отметок о недостоверности нет", "source": "ЕГРЮЛ", "as_of": None},
                               {"id": "age", "title": "Возраст компании", "status": "ok", "detail": "С 25.02.1993", "source": "ЕГРЮЛ", "as_of": None},
                               {"id": "tax_debt", "title": "Задолженность по налогам", "status": "ok", "detail": "Нет", "source": "ФНС, открытые данные", "as_of": "01.09.2026"}])
    r["dossier"]["charts"] = {"revenue": [{"year": 2024, "value": 6256625972000}, {"year": 2025, "value": 5846351786000}]}
    r["dossier"]["sections"] = [{"id": "management", "title": "Руководство и собственники",
                                 "rows": [["Председатель правления", "Иванов Иван Иванович"], ["Руководит с", "12.04.2007 (19 лет 5 месяцев)"]]}]
    r.update(dop)
    return r


class TestKartochkiV2(unittest.TestCase):
    """kartochki-v2 (Ночные-2, 02.10): факты живого ответа, которые не становились выводами; ворота не ослаблены."""

    def test_nedostovernost_iz_detali(self):
        k = K.iz_check(_gazprom_kak_v_api())
        nd = k["fakty"]["nedostovernost"]
        self.assertEqual((nd["ton"], nd["zagolovok"], nd["data"]), ("ok", "Отметки о недостоверности", K.dt.date(2026, 10, 1)))
        self.assertIn("V16", [x["kod"] for x in K.vyvody(k)])

    def test_otmetka_zakryvaet_vorota(self):
        # раньше сигнал «Адрес» с отметкой не распознавался — карточка прошла бы ворота; теперь — стоп до формулировки V17
        r = _gazprom_kak_v_api()
        r["signals"].append({"id": "director", "title": "Руководитель", "status": "warn", "detail": "Есть отметка о недостоверности сведений", "source": "ЕГРЮЛ", "as_of": None})
        k = K.iz_check(r)
        self.assertEqual(k["fakty"]["nedostovernost"]["ton"], "warn")
        self.assertEqual(K.vorota(k), (False, "отметка о недостоверности — ждёт формулировки Юриста (V17)"))

    def test_vyruchka_iz_ryada_girbo(self):
        k = K.iz_check(_gazprom_kak_v_api())
        d = k["fakty"]["dohod"]
        self.assertEqual((d["istochnik"], d["data"], d["god"]), ("ГИР БО, бухгалтерская отчётность", K.dt.date(2025, 12, 31), 2025))
        self.assertAlmostEqual(d["delta"], -6.56, places=1)
        V = K.vyvody(k)
        self.assertIn("Выручка за" + NB + "2025 — 5,8" + NB + "трлн" + NB + "₽", [x["tekst"] for x in V])
        self.assertEqual(K.vorota(k, V), (True, "ок"))

    def test_bez_ryada_net_vyruchki(self):
        r = _gazprom_kak_v_api()
        r["dossier"]["charts"] = {}
        k = K.iz_check(r)
        self.assertNotIn("dohod", k["fakty"])
        self.assertEqual(K.vorota(k)[1], "нет финансов (доход > 0 по ФНС / ГИР БО)")

    def test_rukovoditel_tot_zhe_bez_fio(self):
        r = _gazprom_kak_v_api()
        r["signals"] = [x for x in r["signals"] if x["id"] != "address"]   # освобождаем место ЕГРЮЛ (предел 2)
        k = K.iz_check(r)
        self.assertEqual(k["rukovodit_s"], K.dt.date(2007, 4, 12))
        V = K.vyvody(k)
        t = [x["tekst"] for x in V if x["kod"] == "V19"]
        self.assertEqual(t, ["Руководитель тот же 19" + NB + "лет — с" + NB + "2007 года"])
        self.assertNotIn("Иванов", json.dumps(V, ensure_ascii=False, default=str))

    def test_v16_glavnee_v19(self):
        V = K.vyvody(K.iz_check(_gazprom_kak_v_api()))
        kody = [x["kod"] for x in V]
        self.assertIn("V16", kody)
        self.assertNotIn("V19", kody)        # ЕГРЮЛ: V01 + V16, третий из того же источника не идёт

    def test_smena_rukovoditelya(self):
        r = _gazprom_kak_v_api()
        r["dossier"]["sections"][0]["rows"][1] = ["Руководит с", "01.07.2026 (3 месяца)"]
        V = K.vyvody(K.iz_check(r))
        self.assertIn(("V18", "warn", "Руководитель сменился 3" + NB + "месяца назад"), [(x["kod"], x["ton"], x["tekst"]) for x in V])

    def test_rukovodit_s_ranshe_registracii_ne_berem(self):
        r = _gazprom_kak_v_api()
        r["dossier"]["sections"][0]["rows"][1] = ["Руководит с", "01.01.1990"]
        self.assertIsNone(K.iz_check(r)["rukovodit_s"])

    def test_diagnoz(self):
        k = K.iz_check(_gazprom_kak_v_api())
        dg = K.diagnoz(k, K.vyvody(k))
        self.assertIn("dohod: есть", dg)
        self.assertIn("shtat: нет в ответе", dg)
        self.assertIn("финансы: 2024–2025", dg)


class TestIzApiLimit(unittest.TestCase):
    """kartochki-v2: на HTTP 429 — стоп (лимит не обходим), не больше maks запросов за запуск, пауза не меньше 6 с."""

    def _progon(self, otvety, maks=300):
        import io
        import urllib.error
        zvali = []

        def urlopen(req, timeout=0):
            zvali.append(req.full_url)
            kod = otvety[len(zvali) - 1]
            if kod != 200:
                raise urllib.error.HTTPError(req.full_url, kod, "x", {}, None)
            return io.BytesIO(json.dumps({"company": {"inn": req.full_url[-10:]}}).encode())

        d = tempfile.mkdtemp()
        try:
            sp = os.path.join(d, "s.txt")
            open(sp, "w").write("7736050003\n7707083893\n7708004767\n")
            st_u, st_s = K.urllib.request.urlopen, K.time.sleep
            K.urllib.request.urlopen, K.time.sleep = urlopen, lambda x: None
            try:
                K.iz_api(sp, os.path.join(d, "o.jsonl"), maks=maks)
            finally:
                K.urllib.request.urlopen, K.time.sleep = st_u, st_s
            return zvali, len(K.chitat_jsonl(os.path.join(d, "o.jsonl")))
        finally:
            shutil.rmtree(d)

    def test_429_stop(self):
        zvali, n = self._progon([200, 429, 200])
        self.assertEqual((len(zvali), n), (2, 1))

    def test_maks(self):
        zvali, n = self._progon([200, 200, 200], maks=2)
        self.assertEqual((len(zvali), n), (2, 2))

    def test_pauza_ne_menshe_6(self):
        import inspect
        self.assertEqual(inspect.signature(K.iz_api).parameters["pauza"].default, 6.0)
        self.assertIn('max(6.0, float(_arg(argv, "--pauza", "6")))', inspect.getsource(K.main))
        self.assertEqual(K.MAKS_ZAPROSOV, 300)


class TestSluzhebnyjDostup(unittest.TestCase):
    """kartochki-servis-v1: DELOSKOP_SERVICE_TOKEN → заголовок X-Deloskop-Service (решение владельца 02.10, п. 4);
    токен не печатается и не попадает в файл ответов; лимиты (429 — стоп, 300 за запуск) те же."""

    TOKEN = "s" * 40

    def test_zagolovki(self):
        self.assertEqual(K.zagolovki_dostupa({}), {})
        self.assertEqual(K.zagolovki_dostupa({"DELOSKOP_SERVICE_TOKEN": "  "}), {})
        self.assertEqual(K.zagolovki_dostupa({"DELOSKOP_SERVICE_TOKEN": " %s\n" % self.TOKEN}), {"X-Deloskop-Service": self.TOKEN})
        self.assertEqual(K.zagolovki_dostupa({"DELOSKOP_COOKIE": "deloskop_service=x"}), {"Cookie": "deloskop_service=x"})

    def test_zapros_s_tokenom_bez_utechki(self):
        import contextlib
        import io
        videl = []

        def urlopen(req, timeout=0):
            videl.append(req.get_header("X-deloskop-service"))
            return io.BytesIO(json.dumps({"company": {"inn": req.full_url[-10:]}}).encode())

        d = tempfile.mkdtemp()
        st_u, st_s = K.urllib.request.urlopen, K.time.sleep
        st_env = os.environ.get("DELOSKOP_SERVICE_TOKEN")
        try:
            sp, vy = os.path.join(d, "s.txt"), os.path.join(d, "o.jsonl")
            open(sp, "w").write("7736050003\n7707083893\n")
            os.environ["DELOSKOP_SERVICE_TOKEN"] = self.TOKEN
            K.urllib.request.urlopen, K.time.sleep = urlopen, lambda x: None
            vyvod = io.StringIO()
            with contextlib.redirect_stdout(vyvod):
                K.iz_api(sp, vy)
            self.assertEqual(videl, [self.TOKEN, self.TOKEN])
            self.assertIn("Служебный доступ: да", vyvod.getvalue())
            self.assertNotIn(self.TOKEN, vyvod.getvalue())
            self.assertNotIn(self.TOKEN, open(vy, encoding="utf-8").read())
        finally:
            K.urllib.request.urlopen, K.time.sleep = st_u, st_s
            if st_env is None:
                os.environ.pop("DELOSKOP_SERVICE_TOKEN", None)
            else:
                os.environ["DELOSKOP_SERVICE_TOKEN"] = st_env
            shutil.rmtree(d)


class TestKartochkiV4Kod(unittest.TestCase):
    """kartochki-v4-kod: имя после внутренней кавычки и V21 «В реестре МСП» из строки ответа API (ворота не тронуты)."""

    def test_imya_posle_vnutrennej_kavychki(self):
        self.assertEqual(K.imya('АО "АВИАКОМПАНИЯ "СИБИРЬ"'), "АО «Авиакомпания Сибирь»")
        self.assertEqual(K.imya('ООО "ТОРГОВЫЙ ДОМ "ЛЕНТА"'), "ООО «Торговый дом Лента»")
        self.assertEqual(K.imya('ПАО "НК "РОСНЕФТЬ"'), "ПАО «НК Роснефть»")
        self.assertEqual(K.imya('ООО "МИР ТЕХНИКИ"'), "ООО «Мир техники»")
        self.assertEqual(K.imya('ПАО "МТС"'), "ПАО «МТС»")
        # kartochki-v3.7: хвост после кавычек не уходит внутрь и не теряет прописную
        self.assertEqual(K.imya('ПАО "ТАТНЕФТЬ" ИМ. В.Д. ШАШИНА'), "ПАО «Татнефть» им. В.Д. Шашина")
        self.assertEqual(K.imya('ФГУП "ЗАВОД" ИМЕНИ М.В. ХРУНИЧЕВА'), "ФГУП «Завод» имени М.В. Хруничева")

    def _msp(self, detail, status="ok", as_of="2026-09-10"):
        r = O.zapis(3, shtat=1, dohod=None)  # меньше выводов — V21 (⚪, последний по порядку) не срезается пределом 6
        s = {"title": "Реестр МСП", "status": status, "detail": detail, "source": "ФНС, реестр МСП"}
        if as_of:
            s["as_of"] = as_of
        r["signals"].append(s)
        k = K.iz_check(r)
        return k, [x for x in K.vyvody(k) if x["kod"] == "V21"]

    def test_v21_kategoriya_s_datoj(self):
        k, v = self._msp("Малое предприятие")
        self.assertEqual(len(v), 1)
        self.assertEqual(v[0]["tekst"], "В реестре МСП: малое предприятие")
        self.assertEqual((v[0]["ton"], v[0]["s_chislom"], v[0]["istochnik"]), ("info", False, "ФНС, реестр МСП"))
        self.assertEqual(self._msp("Микропредприятие")[1][0]["tekst"], "В реестре МСП: микропредприятие")

    def test_v21_ne_dodumyvaem(self):
        self.assertEqual(self._msp("субъект малого и среднего предпринимательства")[1], [])  # категория не названа
        self.assertEqual(self._msp("Малое предприятие", as_of=None)[1], [])  # без даты сведений — не проверка
        self.assertEqual(self._msp("исключено из реестра: малое предприятие", status="warn")[1], [])

    def test_v21_ne_oslablyaet_vorota(self):
        # V21 — без числа: компания с одним выводом-числом ворота не проходит, сколько бы ⚪ ни было
        r = O.zapis(4, shtat=1, dohod=None)
        r["signals"].append({"title": "Реестр МСП", "status": "ok", "detail": "Микропредприятие", "source": "ФНС, реестр МСП", "as_of": "2026-09-10"})
        self.assertFalse(K.vorota(K.iz_check(r))[0])


class TestKartochkiShtrafyV1(unittest.TestCase):
    """shtrafy-v1: V15 — без утверждения «не уплачен» в настоящем времени; с датой сведений и оговоркой, как V10."""

    def _v15(self, as_of="2025-12-01", status="warn"):
        r = O.zapis(5)
        s = {"title": "Налоговые правонарушения", "status": status, "detail": "Штрафы: 25 000 ₽", "source": "ФНС"}
        if as_of:
            s["as_of"] = as_of
        r["signals"].append(s)
        return [x for x in K.vyvody(K.iz_check(r)) if x["kod"] == "V15"]

    def test_tekst_s_datoj_i_ogovorkoj(self):
        v = self._v15()
        self.assertEqual(len(v), 1)
        t = v[0]["tekst"]
        # kartochki-v3.7: текст [Право · Налоговый юрист] 03.10 07:07, разд. 3
        self.assertTrue(t.startswith("Налоговые штрафы по решениям 2024 года не были уплачены к" + NB + "01.10.2025 — "), t)
        self.assertIn("(данные ФНС на" + NB + "01.12.2025)", t)
        self.assertTrue(t.endswith("Могли быть уплачены после этой даты"), t)

    def test_god_ot_daty_nabora(self):
        t = self._v15(as_of="2026-12-01")[0]["tekst"]
        self.assertIn("по решениям 2025 года", t)
        self.assertIn("01.10.2026", t)
        t = self._v15(as_of="2026-03-01")[0]["tekst"]
        self.assertIn("по решениям 2024 года", t)
        self.assertNotIn("Не уплачен", t)

    def test_bez_daty_i_bez_signala_net_vyvoda(self):
        self.assertEqual(self._v15(as_of=None), [])
        self.assertEqual(self._v15(status="ok"), [])

    def test_staroj_frazy_net_v_generatore(self):
        src = (KOREN / "tests" / "kartochka_render.py").read_text(encoding="utf-8")
        self.assertNotIn('"Не уплачен налоговый штраф', src)


class TestPribylKapitalV1(unittest.TestCase):
    """pribyl-kapital-v1 (Ночные-2, 03.10): прибыль и капитал из ГИР БО (charts.profit, charts.balance) — выводы с числом;
    ворота не ослаблены: тот же предел «2 из одного источника», без выручки карточки нет."""

    def _r(self, profit=None, balance=None, revenue=True):
        r = _gazprom_kak_v_api()
        ch = {} if not revenue else {"revenue": [{"year": 2024, "value": 40e6}, {"year": 2025, "value": 48.2e6}]}
        if profit is not None:
            ch["profit"] = profit
        if balance is not None:
            ch["balance"] = balance
        r["dossier"]["charts"] = ch
        return r

    def test_pribyl_vyvod_s_chislom(self):
        V = K.vyvody(K.iz_check(self._r(profit=[{"year": 2024, "value": 1e6}, {"year": 2025, "value": 3.4e6}])))
        x = [v for v in V if v["kod"] == "V24"]
        self.assertEqual([(v["ton"], v["tekst"], v["istochnik"], v["data"], v["s_chislom"]) for v in x],
                         [("ok", "Чистая прибыль за" + NB + "2025 — 3,4" + NB + "млн" + NB + "₽", "ГИР БО, бухгалтерская отчётность",
                           K.dt.date(2025, 12, 31), True)])

    def test_ubytok_i_minus_kapital(self):
        V = K.vyvody(K.iz_check(self._r(profit=[{"year": 2025, "value": -1.5e6}], balance={"year": 2025, "equity": -12.4e6})))
        t = [(v["kod"], v["ton"], v["tekst"]) for v in V if v["istochnik"].startswith("ГИР БО")]
        # предел «2 из одного источника»: капитал и убыток (жёлтые) главнее справочной выручки
        self.assertEqual(t, [("V25", "warn", "Собственный капитал на" + NB + "31.12.2025 — минус 12,4" + NB + "млн" + NB + "₽: обязательства больше активов"),
                             ("V24a", "warn", "Убыток за" + NB + "2025 — 1,5" + NB + "млн" + NB + "₽")])

    def test_plyus_kapital_i_chuzhoj_god_molchat(self):
        k = K.iz_check(self._r(profit=[{"year": 2024, "value": 5e6}], balance={"year": 2025, "equity": 7e6}))
        kody = [v["kod"] for v in K.vyvody(k)]
        self.assertNotIn("V24", kody)      # прибыль только за 2024, выручка — 2025: другой год не ставим
        self.assertNotIn("V25", kody)      # капитал в плюсе — строки нет (как на экране проверки)
        k = K.iz_check(self._r(balance={"year": 2024, "equity": -1e6}))
        self.assertNotIn("kapital", k["fakty"])

    def test_bez_vyruchki_ni_pribyli_ni_vorot(self):
        k = K.iz_check(self._r(profit=[{"year": 2025, "value": 3e6}], balance={"year": 2025, "equity": -1e6}, revenue=False))
        self.assertNotIn("pribyl", k["fakty"])
        self.assertEqual(K.vorota(k)[1], "нет финансов (доход > 0 по ФНС / ГИР БО)")

    def test_musor_ne_fakt(self):
        k = K.iz_check(self._r(profit=[{"year": 2025, "value": "н/д"}], balance={"year": 2025, "equity": True}))
        self.assertNotIn("pribyl", k["fakty"])
        self.assertNotIn("kapital", k["fakty"])

    def test_pribyl_otkryvaet_vorota_kotorye_byli_zakryty(self):
        # пилот 02.10: 9 из 17 — «выводов 2 из 3». Компания: выручка + возраст, остальное без дат → раньше 2 вывода
        r = self._r()
        r["signals"] = [s for s in r["signals"] if s["id"] in ("status", "age")]
        r["dossier"]["sections"] = []
        k = K.iz_check(r)
        self.assertEqual(K.vorota(k)[1], "выводов 2 из 3")
        r = self._r(profit=[{"year": 2025, "value": 3.4e6}])
        r["signals"] = [s for s in r["signals"] if s["id"] in ("status", "age")]
        r["dossier"]["sections"] = []
        self.assertEqual(K.vorota(K.iz_check(r)), (True, "ок"))


class TestFinansyDataV34(unittest.TestCase):
    """kartochki-v3.4 (Ночные-2, 03.10): таблица дохода из ряда ГИР БО — с датой 31.12 последнего года и «● подтверждено»,
    как вывод «Выручка за Г» над ней (живые МТС, Магнит, ВК 03.10 писали «дата сведений не указана · ○ не проверяли»)."""

    def _fin(self, t):
        i = t.index('aria-labelledby="fin"')
        return t[i:t.index("</section>", i)]

    def test_ryad_girbo_s_datoj(self):
        k = K.iz_check(_gazprom_kak_v_api())
        self.assertEqual(k["finansy_data"], K.dt.date(2025, 12, 31))
        f = self._fin(K.html_kartochki(k, K.vyvody(k), []))
        self.assertIn("сведения на", f)
        self.assertNotIn("дата сведений не указана", f)
        self.assertNotIn("не проверяли", f)

    def test_yavnaya_data_vygruzki_glavnee(self):
        k = K.iz_check(_gazprom_kak_v_api(finansy_data="2026-04-01"))
        self.assertEqual(k["finansy_data"], K.dt.date(2026, 4, 1))

    def test_bez_ryada_girbo_daty_net(self):
        r = _gazprom_kak_v_api(finansy=[{"god": 2024, "dohod": 1e6}, {"god": 2025, "dohod": 2e6}])
        r["dossier"]["charts"] = {}
        k = K.iz_check(r)
        self.assertIsNone(k["finansy_data"])   # источник ряда не назван — дату не придумываем


class TestDoborV35(unittest.TestCase):
    """kartochki-v3.5 (Ночные-2, 03.10): `sobrat --dobavit` — порция новых карточек не стирает опубликованные;
    хаб и sitemap после добора — те же байты, что при полной сборке всех данных сразу."""

    def _snimok(self, d):
        return {str(p.relative_to(d)): p.read_bytes() for p in pathlib.Path(d).rglob("*") if p.is_file()}

    def test_dobor_kak_polnaya_sborka(self):
        z = O.nabor(12)
        d1, _, _ = sobrat(z)
        d2, _, _ = sobrat(z[:7])
        do = self._snimok(d2)
        _, o = K.sobrat(z[7:], d2, dobavit=True)
        self.assertEqual(o["s_diska"], 7)
        posle = self._snimok(d2)
        self.assertEqual([str(p.relative_to(d1)) for p in stranicy(d1)], [str(p.relative_to(d2)) for p in stranicy(d2)])
        for put, bajty in do.items():
            if put.startswith("company/") and put != "company/index.html":
                self.assertEqual(posle[put], bajty, "добор изменил опубликованную карточку " + put)
        for put in ("company/index.html", "sitemap-companies.xml"):
            self.assertEqual(posle[put], pathlib.Path(d1, put).read_bytes(), put + " после добора ≠ полной сборке")

    def test_bez_dobavit_stiraet_kak_ranshe(self):
        z = O.nabor(6)
        d, _, _ = sobrat(z[:4])
        K.sobrat(z[4:], d)
        self.assertEqual(len(stranicy(d)), 2)

    def test_svezhij_ne_proshel_vorota_uhodit(self):
        z = O.nabor(5)
        d, kart, _ = sobrat(z)
        plohoj = json.loads(json.dumps(z[0]))
        plohoj["company"]["status"] = "LIQUIDATED"   # свежая порция: компания больше не действует
        k0 = K.iz_check(z[0])
        self.assertFalse(K.vorota(K.iz_check(plohoj))[0])
        K.sobrat([plohoj], d, dobavit=True)
        ostalis = [p.parent.name[:10] for p in stranicy(d)]
        self.assertNotIn(k0["inn"], ostalis)
        self.assertEqual(len(ostalis), 4)

    def test_chuzhuyu_papku_ne_trogaet(self):
        z = O.nabor(4)
        d, _, _ = sobrat(z[:2])
        chuzhaya = pathlib.Path(d, "company", "0000000000-ruchnaya")
        chuzhaya.mkdir()
        (chuzhaya / "index.html").write_text("<p>без JSON-LD</p>", encoding="utf-8")
        K.sobrat(z[2:], d, dobavit=True)
        self.assertTrue((chuzhaya / "index.html").exists())

    def test_zaglushka_so_stranicy(self):
        z = O.nabor(3)
        d, kart, _ = sobrat(z)
        st = K.kartochki_na_diske(d)
        for k in kart:
            s = st[k["inn"]]
            self.assertEqual((s["name"], s["region"], s["gorod"] or ""), (k["name"], k["region"], k.get("gorod") or ""))
            self.assertEqual(s["_lastmod"], K.lastmod(k, k["_V"]))
            dk = (k["fakty"].get("dohod") or {}).get("znachenie")
            if dk:
                self.assertEqual(K.dengi(s["fakty"]["dohod"]["znachenie"]), K.dengi(dk))


if __name__ == "__main__":
    unittest.main(verbosity=1)
