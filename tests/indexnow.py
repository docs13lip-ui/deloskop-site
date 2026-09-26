#!/usr/bin/env python3
"""IndexNow: сообщает Яндексу, какие страницы сайта изменились, — чтобы он переобошёл их за часы, а не за недели.

Запуск (из корня репозитория, ПОСЛЕ деплоя в Timeweb — иначе Яндекс придёт за старой версией):
    python3 tests/indexnow.py                     # страницы, изменённые последним слиянием в main
    python3 tests/indexnow.py --ot 0a372d5        # всё, что изменилось с коммита 0a372d5
    python3 tests/indexnow.py --vse               # все страницы из sitemap.xml (после крупной выкладки)
    python3 tests/indexnow.py --proverka          # только показать список, ничего не отправлять

То же одной кнопкой: GitHub → Actions → «IndexNow — сообщить Яндексу» → Run workflow.

Отправляем только страницы из sitemap.xml: закрытые от индекса (кабинет, счета, 404) и служебные файлы — никогда.
Ключ — публичный по устройству протокола (лежит файлом в корне сайта), это не пароль.
Только стандартная библиотека Python — ничего ставить не нужно.
"""
import json
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
HOST = "deloskop.ru"
SAJT = "https://" + HOST
KONECHNAYA_TOCHKA = "https://yandex.com/indexnow"
KLYUCH_FAJL = re.compile(r"^[0-9a-f]{32}\.txt$")


def klyuch(koren=ROOT):
    fajly = sorted(p.name for p in koren.iterdir() if KLYUCH_FAJL.match(p.name))
    if len(fajly) != 1:
        raise SystemExit(f"В корне сайта должен быть ровно один ключ IndexNow (32 hex + .txt), найдено: {fajly}")
    imya = fajly[0]
    znachenie = (koren / imya).read_text(encoding="utf-8").strip()
    if znachenie != imya[:-4]:
        raise SystemExit(f"Содержимое {imya} должно совпадать с именем файла без .txt")
    return znachenie


def adresa_sitemap(koren=ROOT):
    return re.findall(r"<loc>([^<]+)</loc>", (koren / "sitemap.xml").read_text(encoding="utf-8"))


def fajl_v_adres(put):
    """Путь файла в репозитории → адрес страницы на сайте (или None, если это не страница)."""
    put = put.replace("\\", "/").strip().strip('"')
    if not put.endswith(".html"):
        return None
    if put == "index.html":
        return SAJT + "/"
    if put.endswith("/index.html"):
        return SAJT + "/" + put[: -len("index.html")]
    return SAJT + "/" + put


def vybrat(izmenennye, v_sitemap):
    """Оставляет только изменённые страницы, которые есть в sitemap (т. е. открыты для индекса), без повторов."""
    dopustimye = set(v_sitemap)
    out = []
    for f in izmenennye:
        a = fajl_v_adres(f)
        if a and a in dopustimye and a not in out:
            out.append(a)
    return out


def izmenennye_fajly(ot=None):
    if ot:
        diapazon = [ot, "HEAD"]
    else:
        # слияние PR — сравниваем с первым родителем (всё, что пришло с PR); обычный коммит — с предыдущим
        diapazon = ["HEAD^1", "HEAD"]
    r = subprocess.run(["git", "-c", "core.quotepath=false", "diff", "--name-only", "--diff-filter=AM", *diapazon],
                       cwd=ROOT, capture_output=True, text=True, check=True)
    return [s for s in r.stdout.splitlines() if s.strip()]


def klyuch_na_zhivom(k):
    try:
        with urllib.request.urlopen(f"{SAJT}/{k}.txt", timeout=20) as r:
            return r.read().decode("utf-8", "replace").strip() == k
    except (urllib.error.URLError, TimeoutError):
        return False


def otpravit(adresa, k):
    telo = json.dumps({"host": HOST, "key": k, "keyLocation": f"{SAJT}/{k}.txt", "urlList": adresa}).encode()
    zapros = urllib.request.Request(KONECHNAYA_TOCHKA, data=telo, method="POST",
                                    headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(zapros, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


OTVETY = {
    200: "принято",
    202: "принято, ключ проверяется",
    400: "ошибка в запросе",
    403: "ключ не найден на сайте или не совпадает — сначала выложите файл ключа",
    422: "адреса не с этого сайта или ключ не совпадает",
    429: "слишком часто — повторите через час",
}


def main(argv):
    k = klyuch()
    v_sitemap = adresa_sitemap()
    if "--vse" in argv:
        adresa = list(dict.fromkeys(v_sitemap))
    else:
        ot = argv[argv.index("--ot") + 1] if "--ot" in argv else None
        adresa = vybrat(izmenennye_fajly(ot), v_sitemap)
    print(f"Страниц к переобходу: {len(adresa)}")
    for a in adresa:
        print("  " + a)
    if not adresa:
        print("Нечего отправлять: изменённых страниц из sitemap.xml нет.")
        return 0
    if "--proverka" in argv:
        print("Режим проверки — ничего не отправлено.")
        return 0
    if not klyuch_na_zhivom(k):
        print(f"Файл ключа {SAJT}/{k}.txt на живом сайте не найден — сначала деплой в Timeweb, потом IndexNow.")
        return 1
    kod, tekst = otpravit(adresa[:10000], k)
    print(f"Яндекс ответил {kod}: {OTVETY.get(kod, tekst[:200])}")
    return 0 if kod in (200, 202) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
