#!/usr/bin/env python3
"""platyat-pozzhe-v1: блок «Контрагенты стали платить позже» на главной — из data/rynok.json.

Цифры — только из data/rynok.json (ТЗ [Продукт] 10.10, разд. 3). Блок стоит между метками
<!--rynok-glavnaya-->…<!--/rynok-glavnaya--> в index.html (между «Как решают суды» и калькулятором).
Внутри блока — инлайн-скрипт: кладёт строку «Для сравнения…» в window.DLK_RYNOK для «Условий сделки»
и прячет блок сам, когда сверке больше 120 дней (устаревшая цифра хуже никакой — даже если сайт не пересобрали).

Запуск:  python3 tests/sobrat_rynok.py            — пересобрать index.html
         python3 tests/sobrat_rynok.py --check    — только проверить (код 1, если index.html отстал)
         --segodnya ГГГГ-ММ-ДД                     — «сегодня» для тестов (иначе — московская дата)
Фразы «≈ 1 из 4», «каждый пятый», «во втором квартале» привязаны к значениям в JSON: поменялись цифры —
сборщик остановится и попросит переписать текст (не выведет старые слова с новыми цифрами).
"""
import datetime
import json
import os
import re
import sys

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NACH, KON = "<!--rynok-glavnaya-->", "<!--/rynok-glavnaya-->"
SROK_DNEJ = 120
NB = "&nbsp;"
MES = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]


class StaryjTekst(Exception):
    pass


def segodnya_msk():
    return (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=3)).date()


def dannye(put=None):
    with open(put or os.path.join(KOREN, "data", "rynok.json"), encoding="utf-8") as f:
        return json.load(f)["platezhi"]


def srok_do(p):
    """Первый день, когда блок уже не показываем: сверка + 121 день (сверке «больше 120 дней»)."""
    return datetime.date.fromisoformat(p["sverka"]) + datetime.timedelta(days=SROK_DNEJ + 1)


def e(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def chislo(s, obrazec, pole):
    m = re.fullmatch(obrazec, s)
    if not m:
        raise StaryjTekst("data/rynok.json: %s = %r — текст блока написан под другое значение, перепишите фразу" % (pole, s))
    return m.group(1)


def proverit(p):
    """Слова блока, которые не берутся из JSON напрямую, сверяем с JSON: иначе сборка останавливается."""
    if p["dolya_s_opozdaniem"] != "около четверти":
        raise StaryjTekst("dolya_s_opozdaniem: «≈ 1 из 4» написано под «около четверти»")
    if chislo(p["do60"], r"примерно (\d+) %", "do60") != "20":
        raise StaryjTekst("do60: «примерно каждый пятый» написано под «примерно 20 %»")
    if not re.fullmatch(r"II квартал (\d{4}) года", p["period"]):
        raise StaryjTekst("period: «во втором квартале … чем в первом» написано под «II квартал ГГГГ года»")
    chislo(p["vovremya"], r"выше (\d+) %", "vovremya")
    chislo(p["svyshe60"], r"(\d+–\d+) %", "svyshe60")
    chislo(p["msb_do60_pp"], r"(\d+,\d)", "msb_do60_pp")
    chislo(p["msb_svyshe60_pp"], r"(\d+,\d)", "msb_svyshe60_pp")
    if not p["url"].startswith("https://"):
        raise StaryjTekst("url: нужна ссылка https:// на публикацию")


def god(p):
    return re.fullmatch(r"II квартал (\d{4}) года", p["period"]).group(1)


def istochnik_kratko(p):
    return p["istochnik"].split(",")[0].strip()


def stroka_usloviya(p):
    """Подстрочник «Условий сделки» — простой текст (Usloviya экранирует), неразрывные пробелы — \\u00a0."""
    t = "Для сравнения: %s счетов в %s году оплачивают с опозданием (%s, II кв. %s)." % (
        p["dolya_s_opozdaniem"], god(p), istochnik_kratko(p), god(p))
    return t.replace("в 20", "в\u00a020").replace("с опозданием", "с\u00a0опозданием").replace("II кв. ", "II\u00a0кв.\u00a0")


def data_ru(iso):
    d = datetime.date.fromisoformat(iso)
    return "%d%s%s %d%sг." % (d.day, NB, MES[d.month - 1], d.year, NB)


def blok(p):
    proverit(p)
    proc = lambda s: s.replace(" %", NB + "%")
    vovremya = chislo(p["vovremya"], r"выше (\d+) %", "vovremya")
    do60 = chislo(p["do60"], r"примерно (\d+) %", "do60")
    sv = chislo(p["svyshe60"], r"(\d+–\d+) %", "svyshe60")
    G = god(p)
    ist = e(p["istochnik"]).replace(", ", " и" + NB)
    okno = {"tekst": stroka_usloviya(p), "do": srok_do(p).isoformat()}
    skript = ("<script>(function(){try{var s=document.getElementById('rynok'),R=%s;"
              "if(Date.now()>=Date.parse(R['do']+'T00:00:00+03:00')){if(s)s.hidden=true;window.DLK_RYNOK=null}"
              "else window.DLK_RYNOK=R}catch(e){}})()</script>") % json.dumps(okno, ensure_ascii=False).replace("\u00a0", "\\u00a0")
    return (
        NACH +
        '<section class="sect rynok" id="rynok" aria-labelledby="rynok-h" data-rynok-do="%s">' % okno["do"] +
        '<div class="wrap"><div class="rynok__in">'
        '<div class="rynok__nad">Рынок сейчас</div>'
        '<h2 class="h2" id="rynok-h">Контрагенты стали платить позже</h2>'
        '<div class="rynok__g">'
        '<p class="rynok__ch"><b>≈' + NB + '1 из' + NB + '4</b>'
        '<span>счетов в' + NB + G + ' году оплачивают с' + NB + 'опозданием</span></p>'
        '<div class="rynok__t">'
        '<p>Вовремя оплачивают чуть больше ' + vovremya + NB + '% счетов. Примерно каждый пятый приходит с' + NB +
        'опозданием до' + NB + '60' + NB + 'дней, ещё ' + sv + NB + '%' + NB + '— позже. У' + NB +
        'малого бизнеса во' + NB + 'втором квартале просрочек стало больше, чем в' + NB + 'первом: +' +
        e(p["msb_do60_pp"]) + NB + 'п.' + NB + 'п. до' + NB + '60' + NB + 'дней и' + NB + '+' +
        e(p["msb_svyshe60_pp"]) + NB + 'п.' + NB + 'п.' + NB + '— дольше.</p>'
        '<p>Поэтому проверка заканчивается не' + NB + 'только словами «можно работать». Мы считаем, какую сумму '
        'разумно заплатить вперёд,' + NB + '— по' + NB + 'выручке компании, Индексу и' + NB + 'сигналам из' + NB +
        'реестров. Методика открыта.</p>'
        '<p class="rynok__go"><a href="#check" data-focus-inn data-goal="platyat_pozzhe_klik">Проверить, сколько платить вперёд' +
        NB + '→</a></p>'
        '<p class="rynok__ist">Источник: ' + ist + ', ' + e(p["period"]).replace("II квартал", "II" + NB + "квартал") +
        '; публикация «<a href="' + e(p["url"]) + '" target="_blank" rel="nofollow noopener">Интерфакса</a>» от' + NB +
        data_ru(p["data_publikacii"]) + ' «Около четверти»' + NB + '— наш пересчёт: ' + do60 + NB + '% + ' + sv +
        NB + '%.</p>'
        '</div></div></div></div></section>' + skript + KON
    )


def sobrat(txt, p, segodnya):
    a, b = txt.find(NACH), txt.find(KON)
    if a < 0 or b < a:
        raise SystemExit("index.html: нет меток %s…%s" % (NACH, KON))
    novoe = (NACH + KON) if segodnya >= srok_do(p) else blok(p)
    return txt[:a] + novoe + txt[b + len(KON):]


def main(argv):
    check = "--check" in argv
    segodnya = segodnya_msk()
    if "--segodnya" in argv:
        segodnya = datetime.date.fromisoformat(argv[argv.index("--segodnya") + 1])
    put = os.path.join(KOREN, "index.html")
    with open(put, encoding="utf-8") as f:
        staroe = f.read()
    try:
        novoe = sobrat(staroe, dannye(), segodnya)
    except StaryjTekst as x:
        print("sobrat_rynok: " + str(x), file=sys.stderr)
        return 2
    if check:
        if novoe != staroe:
            print("index.html: блок «Платят позже» отстал от data/rynok.json — python3 tests/sobrat_rynok.py", file=sys.stderr)
            return 1
        return 0
    if novoe != staroe:
        with open(put, "w", encoding="utf-8") as f:
            f.write(novoe)
        print("index.html: блок «Платят позже» пересобран")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
