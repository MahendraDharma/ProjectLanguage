#!/usr/bin/env python3
"""Fetch JLPT N3 study material from dethitiengnhat.com/en into static JSON.

Output (relative to repo root):
  data/exams/index.json            list of mock exams
  data/exams/<id>.json             one exam: vocab / grammar-reading / listening
  data/grammar.json                N3 grammar patterns with examples
  assets/img/<file>                images used by questions

Usage:  python3 scripts/scrape_dethitiengnhat.py [--level N3] [--no-cache]
Needs:  beautifulsoup4, lxml.  Raw pages are cached in .cache/ (gitignored).
"""
import argparse, hashlib, json, re, sys, time, urllib.request
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString, Tag

BASE = "https://dethitiengnhat.com"
ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache"
UA = "Mozilla/5.0 (personal JLPT study tool)"
SECTIONS = {1: "vocab", 3: "grammar_reading", 4: "listening"}
ALLOWED = {"u", "b", "br", "ruby", "rt", "rp", "img", "center", "table", "tr", "td", "th",
           "tbody", "thead", "p", "span", "strong", "em", "i", "ol", "ul", "li", "div", "sup", "sub"}

USE_CACHE = True


def fetch(url, binary=False):
    CACHE.mkdir(exist_ok=True)
    key = CACHE / hashlib.sha1(url.encode()).hexdigest()
    if USE_CACHE and key.exists():
        data = key.read_bytes()
    else:
        for attempt in range(4):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=30) as r:
                    data = r.read()
                break
            except Exception as e:  # network hiccup → back off
                if attempt == 3:
                    raise
                time.sleep(2 ** (attempt + 1))
        key.write_bytes(data)
        time.sleep(0.4)  # be polite
    return data if binary else data.decode("utf-8", "replace")


def clean_html(node, images):
    """Return sanitized inner HTML of node (whitelisted tags, no attrs except img src)."""
    out = []
    for child in node.children:
        if isinstance(child, NavigableString):
            if child.__class__.__name__ in ("Comment", "Script", "Stylesheet"):
                continue
            out.append(escape(str(child)))
        elif isinstance(child, Tag):
            name = child.name.lower()
            if name in ("script", "style", "link", "button", "input", "label"):
                continue
            if "japanese-reader-status" in (child.get("class") or []):
                continue
            if name == "img":
                src = child.get("src", "")
                if "hinh/icon" in src:
                    continue
                local = download_image(src, images)
                if local:
                    out.append(f'<img src="{local}" alt="" loading="lazy">')
                continue
            inner = clean_html(child, images)
            if name == "br":
                out.append("<br>")
            elif name in ALLOWED and name not in ("div", "span", "p"):
                out.append(f"<{name}>{inner}</{name}>")
            elif name == "p":
                out.append(f"{inner}<br>")
            elif name == "div" and "center" in (child.get("style") or ""):
                out.append(f"<center>{inner}</center>")
            else:
                out.append(inner)
    return "".join(out)


def escape(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def tidy(html):
    html = html.replace("\r", "")
    html = re.sub(r"[ \t　]*\n[ \t\n　]*", "\n", html)
    html = re.sub(r"(<br>\s*){3,}", "<br><br>", html)
    html = re.sub(r"^(\s|<br>)+|(\s|<br>)+$", "", html)
    return html.strip()


def download_image(src, images):
    if not src:
        return None
    url = src if src.startswith("http") else f"{BASE}/{src.lstrip('/')}"
    stem = re.sub(r"[^A-Za-z0-9._-]", "_", url.rsplit("/", 1)[-1]).rsplit(".", 1)[0]
    name = stem + ".webp"
    dest = ROOT / "assets" / "img" / name
    if not dest.exists():
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            save_webp(fetch(url, binary=True), dest)
        except Exception as e:
            print("  ! image failed", url, e, file=sys.stderr)
            return None
    images.add(name)
    return f"assets/img/{name}"


def save_webp(raw, dest, max_w=900):
    """Downscale + convert to WebP so the repo stays small."""
    import io
    from PIL import Image
    im = Image.open(io.BytesIO(raw))
    im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(dest, "WEBP", quality=80, method=6)


def reader_content(el):
    rc = el.find(class_="japanese-reader-content")
    return rc if rc is not None else el


def strip_option_prefix(html):
    return re.sub(r"^\s*[1-4１-４]\s*[)）.．]\s*", "", html).strip()


def by_site_n(questions_by_n, n):
    for q in questions_by_n.values():
        if q.get("_n") == n:
            return q
    return None


def parse_exam_page(html, images):
    soup = BeautifulSoup(html, "lxml")
    form = soup.find("form", attrs={"name": "dttn"})
    if form is None:
        return None
    groups, cur_group, cur_passage, questions_by_n = [], None, None, {}
    passages = []
    renumber_offset = 0
    for el in form.find_all(True):
        cls = el.get("class") or []
        eid = el.get("id") or ""
        if "big_item" in cls:
            cur_group = {"instruction": tidy(clean_html(el, images)), "questions": []}
            groups.append(cur_group)
            cur_passage = None
        elif "question_content" in cls:
            cur_passage = len(passages)
            passages.append(tidy(clean_html(reader_content(el), images)))
        elif "question_list" in cls:
            # previous "question" had no options → it was really a passage
            last = questions_by_n.get(len(questions_by_n))
            if last is not None and not last["options"] and last["answer"] is None:
                passages.append(last["stem"])
                cur_passage = len(passages) - 1
                for g in groups:
                    if last in g["questions"]:
                        g["questions"].remove(last)
                del questions_by_n[len(questions_by_n)]
                renumber_offset += 1
            if cur_group is None:
                cur_group = {"instruction": "", "questions": []}
                groups.append(cur_group)
            q = {"stem": tidy(clean_html(reader_content(el), images)), "options": [],
                 "answer": None, "points": 1, "passage": cur_passage, "explanation": None}
            cur_group["questions"].append(q)
            questions_by_n[len(questions_by_n) + 1] = q
            q["_n"] = len(questions_by_n) + renumber_offset
        elif re.fullmatch(r"QS\d+", eid) and "answers" in cls:
            n = len(questions_by_n)
            if n:
                questions_by_n[n]["options"].append(strip_option_prefix(tidy(clean_html(el, images))))
        elif re.fullmatch(r"AS\d+", eid):
            q = by_site_n(questions_by_n, int(eid[2:]))
            if q:
                txt = el.get_text(strip=True)
                q["answer"] = int(txt) if txt.isdigit() else None
        elif re.fullmatch(r"GT\d+", eid):
            q = by_site_n(questions_by_n, int(eid[2:]))
            if q:
                exp = tidy(clean_html(el, images))
                q["explanation"] = re.sub(r"^\s*Reference:\s*(<br>)*", "", exp).strip()
        elif re.fullmatch(r"diemso\d+", eid):
            q = by_site_n(questions_by_n, int(eid[6:]))
            if q:
                try:
                    q["points"] = float(el.get_text(strip=True))
                except ValueError:
                    pass
    for g in groups:
        g["questions"] = [q for q in g["questions"] if len(q["options"]) >= 2 and q["answer"]]
    for g in groups:
        for q in g["questions"]:
            q.pop("_n", None)
    groups = [g for g in groups if g["questions"] or g["instruction"]]
    # merge header-only groups (e.g. "文法" / "読解") into the next one
    merged, carry = [], ""
    for g in groups:
        if not g["questions"]:
            carry += g["instruction"] + "<br>"
            continue
        if carry:
            g["instruction"] = carry + g["instruction"]
            carry = ""
        merged.append(g)
    title = soup.title.get_text(strip=True) if soup.title else ""
    return {"title": title, "passages": passages, "groups": merged}


def scrape_exams(level):
    idx_html = fetch(f"{BASE}/en/jlpt/{level}")
    ids = sorted({int(m) for m in re.findall(rf"jlpt/{level}/(\d+)/1", idx_html)})
    out_dir = ROOT / "data" / "exams"
    out_dir.mkdir(parents=True, exist_ok=True)
    index = []
    for exam_id in ids:
        exam = {"id": exam_id, "level": level, "sections": {}}
        images = set()
        for part, key in SECTIONS.items():
            url = f"{BASE}/en/jlpt/{level}/{exam_id}/{part}"
            parsed = parse_exam_page(fetch(url), images)
            if not parsed:
                print("  ! no form", url, file=sys.stderr)
                continue
            parsed["source"] = url
            exam["sections"][key] = parsed
        counts = {k: sum(len(g["questions"]) for g in v["groups"]) for k, v in exam["sections"].items()}
        bad = [(k, i) for k, v in exam["sections"].items() for gi, g in enumerate(v["groups"])
               for i, q in enumerate(g["questions"]) if not q["answer"] or len(q["options"]) < 2]
        if bad:
            print(f"  ! exam {exam_id}: {len(bad)} questions missing answer/options", file=sys.stderr)
        (out_dir / f"{exam_id}.json").write_text(json.dumps(exam, ensure_ascii=False, indent=1))
        index.append({"id": exam_id, "counts": counts})
        print(f"exam {exam_id}: {counts}")
    (out_dir / "index.json").write_text(json.dumps({"level": level, "exams": index}, ensure_ascii=False, indent=1))


def scrape_grammar(level):
    slugs = []
    page = 1
    while True:
        url = f"{BASE}/en/grammar_jp/{level}" + (f"?page={page}" if page > 1 else "")
        html = fetch(url)
        found = re.findall(r'href="https://dethitiengnhat\.com/en/detailgrammar/([^"]+)"', html)
        # list pages link lessons in <ol>; keep order, skip sidebar dupes
        new = [s for s in dict.fromkeys(found) if s not in slugs]
        if not new:
            break
        slugs += new
        if f"page={page + 1}" not in html:
            break
        page += 1
    items = []
    for slug in slugs:
        soup = BeautifulSoup(fetch(f"{BASE}/en/detailgrammar/{slug}"), "lxml")
        art = soup.find("article", class_="gd-lesson")
        if not art:
            continue
        stamp = art.find(class_="gd-stamp")
        if stamp and level not in stamp.get_text():
            continue
        def txt(sel):
            el = art.select_one(sel)
            return el.get_text(" ", strip=True) if el else ""
        def prose(sel):
            el = art.select_one(sel)
            return tidy(clean_html(el, set())) if el else ""
        examples = []
        for li in art.select("li.gd-example"):
            ja = li.find(class_="gd-ja")
            tr = li.find(class_="gd-translation-text")
            examples.append({"ja": tidy(clean_html(ja, set())) if ja else "",
                             "en": tr.get_text(" ", strip=True) if tr else ""})
        related = [a["href"].rsplit("/", 1)[-1] for a in art.select(".gd-related a")]
        items.append({
            "id": slug,
            "pattern": re.sub(r"([〜～])\s+", r"\1", txt(".gd-pattern")),
            "romaji": txt(".gd-romaji"),
            "meaning": {"en": txt(".gd-meaning")},
            "formation": prose(".gd-formula-source"),
            "explanation": prose(".gd-explain .gd-prose"),
            "examples": examples,
            "related": related,
            "source": f"{BASE}/en/detailgrammar/{slug}",
        })
        print("grammar", slug)
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data" / "grammar.json").write_text(json.dumps(items, ensure_ascii=False, indent=1))
    print(f"{len(items)} grammar patterns")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--level", default="N3")
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--only", choices=["exams", "grammar"])
    a = ap.parse_args()
    USE_CACHE = not a.no_cache
    if a.only != "grammar":
        scrape_exams(a.level)
    if a.only != "exams":
        scrape_grammar(a.level)
