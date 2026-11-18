#!/usr/bin/env python3
"""kroshki-v1 (18.11.2026, решение владельца 18.11 разд. 6 Н2): «хлебные крошки» — одни и те же для человека и поиска.

Аудит main 55f05ebbc (18.11, 14:10): BreadcrumbList есть на всех индексируемых страницах, но видимый путь
расходился с разметкой — на /obnovleniya/ и /vse-vozmozhnosti/ видимых крошек не было; на /nalichnye/ и
/kontragenty-iz-vypiski/ видимый путь вёл на якорь главной «Щит» (/#shield), которого нет в разметке;
у /skoraya-115-fz/ и /osnovatel/ видимый родитель (115-ФЗ, Тарифы) был, а в разметке — нет; на /kak-vidit-bank/
разделитель «/» вместо «›». Поисковик показывает путь из разметки, человек — с экрана: они должны совпадать.

Сторож на всех страницах из git (карточки /company/ — тоже):
  1. есть BreadcrumbList и нет noindex → есть видимые крошки (<nav aria-label="Навигация"> с классом *crumbs / co-krosh);
  2. ссылки видимых крошек — ровно родители из разметки (адреса по порядку; текущая страница — текстом, не ссылкой);
  3. последний шаг разметки — адрес canonical страницы;
  4. разделитель — «›»;
  5. каждый раздел из меню шапки (partials/shapka.html), кроме главной, — с крошками.
"""
import json
import os
import re
import subprocess
import sys
import unittest

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAJT = "https://deloskop.ru"
LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
CANON = re.compile(r'<link rel="canonical" href="https://deloskop\.ru(/[^"]*)"')
KARTOCHKA = re.compile(r"company/\d{10}-[^/]+/index\.html$")
NOINDEX = re.compile(r'<meta[^>]+name="robots"[^>]+noindex')
NAV = re.compile(r'<nav class="(?:[a-z0-9-]*crumbs|co-krosh)\b[^"]*"[^>]*aria-label="Навигация"[^>]*>(.*?)</nav>', re.S)


def stranicy():
    vse = subprocess.check_output(["git", "ls-files", "-z", "*.html"], cwd=KOREN).decode("utf-8").split("\0")
    return [f for f in vse if f and not f.startswith(("partials/", "tests/", "deploy/"))]


def kroshki_ld(txt):
    for b in LD.findall(txt):
        try:
            d = json.loads(b)
        except ValueError:
            continue
        for it in (d if isinstance(d, list) else d.get("@graph", [d])):
            if isinstance(it, dict) and it.get("@type") == "BreadcrumbList":
                return [e["item"] for e in sorted(it["itemListElement"], key=lambda e: e["position"])]
    return None


def chitat(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def put(url):
    return url[len(SAJT):] if url.startswith(SAJT) else url


class TestKroshki(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.str = {}
        for f in stranicy():
            p = os.path.join(KOREN, f)
            if os.path.exists(p):
                cls.str[f] = chitat(p)

    def indeksiruemye(self):
        for f, s in self.str.items():
            if NOINDEX.search(s):
                continue
            ld = kroshki_ld(s)
            if ld:
                yield f, s, ld

    def test_vidimye_est_i_sovpadayut(self):
        oshibki, n = [], 0
        for f, s, ld in self.indeksiruemye():
            n += 1
            m = NAV.search(s)
            if not m:
                oshibki.append("%s: в разметке путь есть, на экране — нет" % f)
                continue
            ssylki = re.findall(r'<a href="([^"]+)"', m.group(1))
            roditeli = [put(u) for u in ld[:-1]]
            if KARTOCHKA.match(f):
                # карточка (генератор — Ночные-2): на экране после «Компании» ещё регион и отрасль — хабы, пока они есть;
                # в разметке пока только «Делоскоп › Компании». Отрасль в разметку — их шаг (✎ в Состоянии, 18.11).
                if ssylki[:len(roditeli)] != roditeli:
                    oshibki.append("%s: на экране %s, в разметке %s" % (f, ssylki, roditeli))
                continue
            if ssylki != roditeli:
                oshibki.append("%s: на экране %s, в разметке %s" % (f, ssylki, roditeli))
        self.assertGreater(n, 300, "страниц с крошками подозрительно мало")
        self.assertEqual(oshibki, [], "\n".join(oshibki))

    def test_poslednij_shag_canonical(self):
        oshibki = []
        for f, s, ld in self.indeksiruemye():
            c = CANON.search(s)
            if c and put(ld[-1]) != c.group(1):
                oshibki.append("%s: последний шаг %s, canonical %s" % (f, ld[-1], c.group(1)))
        self.assertEqual(oshibki, [], "\n".join(oshibki))

    def test_razdelitel(self):
        oshibki = []
        for f, s in self.str.items():
            for m in NAV.finditer(s):
                tekst = re.sub(r"<a\b[^>]*>.*?</a>|<span[^>]*aria-current[^>]*>.*?</span>", "", m.group(1), flags=re.S)
                if re.search(r"(^|>|\s)/(\s|<|$)", tekst):
                    oshibki.append(f)
        self.assertEqual(oshibki, [], "разделитель «/» вместо «›»: %s" % oshibki)

    def test_razdely_menyu_s_kroshkami(self):
        shapka = chitat(os.path.join(KOREN, "partials", "shapka.html"))
        bez = []
        for h in sorted(set(re.findall(r'href="(/[a-z0-9-/]*/)"', shapka))):
            p = os.path.join(KOREN, h.strip("/"), "index.html")
            if not os.path.exists(p):
                continue
            s = chitat(p)
            if NOINDEX.search(s):
                continue
            if not kroshki_ld(s) or not NAV.search(s):
                bez.append(h)
        self.assertEqual(bez, [], "разделы меню без крошек: %s" % bez)

    def test_shchit_ne_v_puti(self):
        # якорь главной — не шаг пути: поисковик не покажет его, а человек уйдёт с товара на главную
        for f, s in self.str.items():
            for m in NAV.finditer(s):
                self.assertNotIn('href="/#', m.group(1), f)


if __name__ == "__main__":
    unittest.main(verbosity=1 if "-q" in sys.argv else 2)
