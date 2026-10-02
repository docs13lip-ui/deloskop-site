#!/usr/bin/env python3
"""Собирает блок «Частые вопросы» и разметку FAQPage в статьях из partials/faq.json.

    python3 tests/sobrat_faq.py          # собрать (страницы перезаписываются)
    python3 tests/sobrat_faq.py --check  # проверить: собрано и ответы дословно из статьи

Правило качества: каждый ответ — только дословные предложения из этой же статьи (текст до </article>,
без самого блока). Так в вопросах не появляется ни одного нового утверждения: юридические и налоговые
тексты сначала проходят [Право] в статье, а уже потом попадают в вопросы. Разметка FAQPage строится из
тех же строк, что видит читатель, — расхождений между видимым текстом и JSON-LD не бывает.
"""
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "partials" / "faq.json"

CSS = ('<!--faq-css--><style>.faq{margin-top:40px}.faq h2{font-size:clamp(24px,3vw,30px);letter-spacing:-.02em;'
       'line-height:1.2;margin:0 0 12px;font-weight:600}.faq details{background:var(--card);border-radius:16px;'
       'padding:14px 18px;margin:0 0 10px}.faq summary{cursor:pointer;font-weight:600;color:var(--ink)}'
       '.faq summary{list-style:none;display:flex;justify-content:space-between;align-items:baseline;gap:16px}'
       '.faq summary::-webkit-details-marker{display:none}.faq summary::after{content:"+";flex:none;color:var(--muted);'
       'font-weight:400;font-size:22px;line-height:1;transition:transform .2s}.faq details[open] summary::after{transform:rotate(45deg)}'
       '.faq summary:focus-visible{outline:2px solid var(--accent);outline-offset:4px;border-radius:6px}'
       '.faq details p{margin:10px 0 0;color:var(--ink2)}</style><!--/faq-css-->')

KOROTKIE = r"(?:в|и|а|к|с|у|о|я|по|на|не|до|от|за|из|ни|но|же|ли|без|для|под|над|при|про)"


def norm(s):
    """Текст для сверки: без тегов, сущностей, неразрывных пробелов и дефисов, с одинарными пробелами."""
    s = re.sub(r"</?(?:a|b|strong|em|i|span|small|abbr|nobr)\b[^>]*>", "", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = s.replace("\u00a0", " ").replace("\u2011", "-")
    return re.sub(r"\s+", " ", s).strip()


def tipo(s):
    """Типографика для видимого текста: неразрывные пробелы после коротких слов, у чисел и тире."""
    nb = "\u00a0"
    t = html.escape(s, quote=False)
    t = re.sub(r"(?<=\d) (?=\d{3}\b)", nb, t)
    t = re.sub(r"(?<=\d) (?=(?:₽|%|млн|млрд|тыс|рабоч|дн|месяц|год|лет))", nb, t)
    t = re.sub(r" (?=—)", nb, t)
    t = re.sub(r"(?<![\w-])(пп?\.|ст\.|ч\.|№) ", lambda m: m.group(1) + nb, t)
    t = re.sub(r"(?i)(?<![\w-])(" + KOROTKIE + r") ", lambda m: m.group(1) + nb, t)
    t = t.replace("115-ФЗ", "115&#8209;ФЗ")
    return t.replace(nb, "&nbsp;")


def blok(voprosy):
    d = "".join(f"<details><summary>{tipo(x['v'])}</summary><p>{tipo(' '.join(x['o']))}</p></details>" for x in voprosy)
    return f'<!--faq--><section class="faq" aria-label="Частые вопросы"><h2>Частые вопросы</h2>{d}</section><!--/faq-->'


def faqpage(voprosy):
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": x["v"], "acceptedAnswer": {"@type": "Answer", "text": " ".join(x["o"])}}
        for x in voprosy]}


def tekst_stati(s):
    s = re.sub(r"<!--faq-->.*?<!--/faq-->", "", s, flags=re.S)
    a = s[s.index("<h1"):s.index("</article>")]
    return norm(a)


def sobrat(s, voprosy, rel):
    oshibki = []
    t = tekst_stati(s)
    for x in voprosy:
        if not x["v"].rstrip().endswith("?"):
            oshibki.append(f"{rel}: вопрос без «?»: {x['v']}")
        if not 1 <= len(x["o"]) <= 3:
            oshibki.append(f"{rel}: в ответе должно быть 1–3 предложения: {x['v']}")
        for p in x["o"]:
            if norm(p) not in t:
                oshibki.append(f"{rel}: предложения нет в статье дословно: {p}")
    if s.count("</article>") != 1 or s.count("</head>") != 1:
        oshibki.append(f"{rel}: нужен ровно один </article> и </head>")
        return s, oshibki
    # блок — сразу после </article>
    b = blok(voprosy)
    if "<!--faq-->" in s:
        s = re.sub(r"<!--faq-->.*?<!--/faq-->", lambda m: b, s, flags=re.S)
    else:
        s = s.replace("</article>", "</article>\n" + b, 1)
    # стили — в <head>
    if "<!--faq-css-->" in s:
        s = re.sub(r"<!--faq-css-->.*?<!--/faq-css-->", lambda m: CSS, s, flags=re.S)
    else:
        # сразу после основных стилей страницы: служебные вставки шапки (sobrat_shapku.py) живут у </head>
        h = s.index("</head>")
        k = s.find("</style>", 0, h)
        s = s[:k + 8] + "\n" + CSS + s[k + 8:] if k != -1 else s.replace("</head>", CSS + "\n</head>", 1)
    # FAQPage — в общий массив JSON-LD страницы
    m = re.search(r'(<script type="application/ld\+json">)(.*?)(</script>)', s, flags=re.S)
    if not m:
        oshibki.append(f"{rel}: нет JSON-LD")
        return s, oshibki
    ld = json.loads(m.group(2))
    if isinstance(ld, dict):
        ld = [ld]
    ld = [o for o in ld if o.get("@type") != "FAQPage"] + [faqpage(voprosy)]
    s = s[:m.start(2)] + json.dumps(ld, ensure_ascii=False) + s[m.end(2):]
    return s, oshibki


def main(argv):
    check = "--check" in argv
    data = json.loads(DATA.read_text(encoding="utf-8"))["stranicy"]
    oshibki, izm = [], []
    for rel, voprosy in data.items():
        p = ROOT / rel
        if not p.exists():
            oshibki.append(f"{rel}: страницы нет")
            continue
        s = p.read_text(encoding="utf-8")
        if '"FAQPage"' in s and "<!--faq-->" not in s:
            oshibki.append(f"{rel}: у страницы уже есть свой FAQPage — сборщик её не трогает")
            continue
        nov, osh = sobrat(s, voprosy, rel)
        oshibki += osh
        if nov != s:
            izm.append(rel)
            if not check:
                p.write_text(nov, encoding="utf-8")
    for o in oshibki:
        print("✗", o)
    if check and izm:
        print("✗ не собрано (запустите python3 tests/sobrat_faq.py):", ", ".join(izm))
        return 1
    if oshibki:
        return 1
    print(("✓ собрано: " if izm and not check else "✓ без изменений: ") + str(len(izm) if izm and not check else len(data)) + " стр.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
