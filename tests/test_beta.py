"""Открытая бета — переключатель в обе стороны (beta-v1, решение владельца 29.09.2026).
Запуск из корня: python3 tests/test_beta.py

Проверяем на копии сайта во временной папке (настоящие файлы не трогаем):
  • "beta": true  → нигде на сайте нет пути к оплате: ссылок на /schet/, кнопок «Оплатить», «Получить счёт»,
                    «Забронировать», data-schet; в подвале нет ИНН/ОГРНИП, даже если rekvizity.json заполнен;
                    на каждой странице с шапкой — полоса «Открытая бета» и метка режима для скриптов;
  • "beta": false → кнопки оплаты и счёт вернулись, полосы и метки нет;
  • true → false → true → false: каждая сборка байт в байт равна первой в своём режиме (ничего не теряется).
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(R, "tests"))
import beta as B  # noqa: E402

n = 0


def ok(name, cond, extra=""):
    global n
    if not cond:
        print("✗", name, extra)
        sys.exit(1)
    n += 1
    print("✓", name)


# ---------- 1. разметка: половины меняются местами без потерь ----------
obr = ('<p>До <!--oplata--><a class="cta" href="/schet/?tarif=pro">Оплатить</a><!--/oplata-->'
       '<!--v-bete--><a class="cta" href="/#inn">В бете — бесплатно</a><!--/v-bete--> после</p>')
b1 = B.primenit(obr, True, polosa="")
f1 = B.primenit(b1, False, polosa="")
ok("разметка: в бете оплата в <template>, href спрятан", '<template data-oplata><a class="cta" data-oplata-href="/schet/' in b1)
ok("разметка: в бете видна бета-половина", 'href="/#inn">В бете — бесплатно</a>' in B.vidimoe(b1) and "/schet/" not in B.vidimoe(b1))
ok("разметка: без беты видна оплата, бета-половина в <template>", 'href="/schet/?tarif=pro">Оплатить</a>' in B.vidimoe(f1)
   and "В бете" not in B.vidimoe(f1))
ok("разметка: туда и обратно — без потерь", B.primenit(f1, True, polosa="") == b1 and B.primenit(b1, False, polosa="") == f1)
ok("разметка: повторная сборка ничего не меняет", B.primenit(b1, True, polosa="") == b1 and B.primenit(f1, False, polosa="") == f1)
ok("разметка: пустая бета-половина — просто пусто",
   B.vidimoe(B.primenit("<!--oplata-->X<!--/oplata--><!--v-bete--><!--/v-bete-->", True, polosa="")).count("X") == 0)
st = "<head>\n</head><body><!--shapka--><header></header><!--/shapka-->\n<main></main></body>"
sb = B.primenit(st, True, polosa="<div data-beta-bar></div>")
ok("разметка: метка режима и полоса — только в бете, одна", sb.count(B.META) == 1 and sb.count("data-beta-bar") == 1
   and B.primenit(sb, True, polosa="<div data-beta-bar></div>") == sb)
ok("разметка: без беты метка и полоса уходят без следа", B.primenit(sb, False) == st)

# ---------- 2. весь сайт на копии ----------
tmp = tempfile.mkdtemp(prefix="beta-")
kop = os.path.join(tmp, "site")
shutil.copytree(R, kop, ignore=shutil.ignore_patterns(".git", "node_modules", "company", "__pycache__"))
rj = os.path.join(kop, "rekvizity.json")
rk = json.load(open(rj, encoding="utf-8"))
rk.update({"fio": "Тестов Тест Тестович", "inn": "500100732259", "ogrnip": "304500116000157"})  # заполнены — а в бете не видны
json.dump(rk, open(rj, "w", encoding="utf-8"), ensure_ascii=False)


def sobrat(beta):
    p = os.path.join(kop, "tarify", "tarify.json")
    s = open(p, encoding="utf-8").read()
    s = re.sub(r'"beta": (true|false)', '"beta": ' + ("true" if beta else "false"), s, count=1)
    open(p, "w", encoding="utf-8").write(s)
    for cmd in (["python3", "tests/sobrat_tarify.py", "."], ["python3", "tests/sobrat_shapku.py"]):
        subprocess.check_output(cmd, cwd=kop, stderr=subprocess.STDOUT)
    snimok = {}
    for d, _, fs in os.walk(kop):
        for f in fs:
            if f.endswith(".html") and "/tests" not in d and "/partials" not in d and "/сайт" not in d:
                pp = os.path.join(d, f)
                snimok[os.path.relpath(pp, kop)] = open(pp, encoding="utf-8").read()
    return snimok


PODTV = re.compile(r"^(yandex_[0-9a-f]+|google[0-9a-f]+)\.html$")
KNOPKA = re.compile(r"<(a|button)\b[^>]*>(.*?)</\1>", re.S)
SLOVA = re.compile(r"Оплати|Оплачив|Получить счёт|Заброни|Получить пакет")  # «6. Оплата…» в оглавлении оферты — не кнопка


def utechki(snimok):
    """Пути к оплате, которые видит посетитель или робот (admin.html — служебная, не в счёт)."""
    res = []
    for f, t in snimok.items():
        if f == "admin.html" or PODTV.match(f):
            continue
        v = B.vidimoe(t)
        kod = re.sub(r"<script(?![^>]*ld\+json)[^>]*>.*?</script>", "", v, flags=re.S)
        for pat in (r'href="/schet/', r"\bdata-schet\b", r"data-tarif=\"[a-z]+\" data-srok="):
            for m in re.finditer(pat, kod):
                res.append((f, kod[max(0, m.start() - 60):m.end() + 30]))
        for m in KNOPKA.finditer(kod):
            if SLOVA.search(re.sub(r"<[^>]+>", "", m.group(2))):
                res.append((f, m.group(0)[:120]))
    return res


beta1 = sobrat(True)
u = utechki(beta1)
ok("бета: на сайте нет ни одной ссылки или кнопки к оплате", not u, "\n  " + "\n  ".join("%s: %s" % x for x in u[:10]))
s_shapkoj = [f for f, t in beta1.items() if "<!--/shapka-->" in t]
ok("бета: страниц с шапкой — больше 30", len(s_shapkoj) > 30, str(len(s_shapkoj)))
ok("бета: на каждой странице с шапкой — полоса ровно одна", all(beta1[f].count("data-beta-bar>") == 1 for f in s_shapkoj))
ok("бета: метка режима для скриптов — на каждой странице с шапкой", all(beta1[f].count(B.META) == 1 for f in s_shapkoj))
ok("бета: в подвале нет ИНН и ОГРНИП, хотя rekvizity.json заполнен",
   all("ОГРНИП 304500116000157" not in t and "Тестов" not in t for t in beta1.values()))
ok("бета: /rekvizity/ — честная строка про бету", 'data-rekv="beta"' in beta1["rekvizity/index.html"])
ok("бета: /tarify/ — цены остаются, пометка «после беты»", "Цена — после беты" in B.vidimoe(beta1["tarify/index.html"])
   and "1 490" in B.vidimoe(beta1["tarify/index.html"]).replace(" ", " "))
ok("бета: /tarify/ — FAQPage без «Как оплатить», с «Сколько стоит сейчас»",
   '"Сколько стоит Делоскоп сейчас?"' in beta1["tarify/index.html"] and '"Как оплатить компании или ИП?"' not in beta1["tarify/index.html"])
for f in ("osnovatel/index.html", "tarify/index.html"):
    v = B.vidimoe(beta1[f])
    m = re.search(r'<script type="application/ld\+json">(\{"@context": "https://schema.org", "@type": "FAQPage".*?)</script>', v, re.S) \
        or re.search(r'\{"@context": "https://schema.org", "@type": "FAQPage".*?\]\}', v, re.S)
    ok(f"бета: {f} — вопросов в FAQPage столько же, сколько видно на странице", m is not None and
       v.count("<details><summary>") == json.loads(m.group(1) if m.lastindex else m.group(0))["mainEntity"].__len__())

platn = sobrat(False)
ok("без беты: кнопки оплаты вернулись (6 на /tarify/, 6 на главной)",
   len(re.findall(r'<a class="cta[^"]*" data-tarif="[a-z]+" data-srok="[a-z]+" href="/schet/', B.vidimoe(platn["tarify/index.html"]))) == 6 and
   len(re.findall(r'<a class="cta[^"]*" data-tarif="[a-z]+" data-srok="[a-z]+" href="/schet/', B.vidimoe(platn["index.html"]))) == 6)
ok("без беты: «Забронировать место» и «Получить пакет» вернулись",
   ">Забронировать место</a>" in B.vidimoe(platn["osnovatel/index.html"]) and
   B.vidimoe(platn["skoraya-115-fz/index.html"]).count(">Получить пакет</a>") == 2)
ok("без беты: ни полосы, ни метки режима", all("data-beta-bar" not in t and B.META not in t for t in platn.values()))
ok("без беты: реквизиты из rekvizity.json — снова в подвале", "ОГРНИП 304500116000157" in platn["index.html"])
ok("без беты: бета-тексты спрятаны", all("В бете — бесплатно" not in B.vidimoe(t) for t in platn.values()))

beta2 = sobrat(True)
platn2 = sobrat(False)
ok("туда-обратно: вторая сборка в бете байт в байт как первая", beta2 == beta1,
   str([f for f in beta1 if beta1[f] != beta2.get(f)][:5]))
ok("туда-обратно: вторая сборка без беты байт в байт как первая", platn2 == platn,
   str([f for f in platn if platn[f] != platn2.get(f)][:5]))
shutil.rmtree(tmp, ignore_errors=True)

# ---------- 3. настоящие файлы собраны в текущем режиме ----------
chk = subprocess.run(["python3", "tests/sobrat_shapku.py", "--check"], cwd=R, capture_output=True, text=True)
ok("репозиторий: страницы собраны в режиме из tarify.json", chk.returncode == 0, chk.stdout[-300:])
D = json.load(open(os.path.join(R, "tarify", "tarify.json"), encoding="utf-8"))
ok("tarify.json: флаг beta — true или false", D.get("beta") in (True, False))
if D.get("beta") is True:
    ok("репозиторий: главная в бете", B.META in open(os.path.join(R, "index.html"), encoding="utf-8").read())
print(f"\nВсего проверок: {n}")
