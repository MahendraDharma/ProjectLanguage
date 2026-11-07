#!/usr/bin/env python3
"""Fetch JLPT N5–N1 study material from dethitiengnhat.com/en into static JSON.

Output (relative to repo root), per level L in N1..N5:
  data/ja/<L>/exams/index.json     list of tests (JLPT mock tests + practice tests)
  data/ja/<L>/exams/<id>.json      one test: three sections, groups tagged with
                                   their scoring part (lang / read / listen)
  data/ja/<L>/grammar.json         grammar patterns with examples
  assets/img/ja/<L>/<file>.webp    images used by questions
  data/courses.json                summary of every course and level

Usage:  python3 scripts/scrape_dethitiengnhat.py [--levels N5,N4,N3,N2,N1] [--no-cache]
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
IMG_DIR = "ja/N3"  # set per level while scraping
LEVELS = ["N5", "N4", "N3", "N2", "N1"]


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
    dest = ROOT / "assets" / "img" / IMG_DIR / name
    if not dest.exists():
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            save_webp(fetch(url, binary=True), dest)
        except Exception as e:
            print("  ! image failed", url, e, file=sys.stderr)
            return None
    images.add(name)
    return f"assets/img/{IMG_DIR}/{name}"


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


READ_HINT = re.compile(r"読解|どっかい|文章|ぶんしょう|ページ|ぺーじ|情報|じょうほう")
FILL_HINT = re.compile(r"入|いれ|はいる|人る")
GRAMMAR_HINT = re.compile(r"次の文の|つぎの文の|つぎの ぶん|★|文法|ぶんぽう|文章|ぶんしょう")


def vocab_type(ins):
    """Card type for a vocabulary problem group, from its instruction."""
    if re.search(r"使い方|つかいかた", ins):
        return "usage"
    if re.search(r"読み方|よみかた|ひらがなで|よみますか|読みますか", ins):
        return "reading"
    if re.search(r"漢字で書|かんじで かく|かんじで書|どう書|どう かきますか|漢字で", ins):
        return "writing"
    if re.search(r"意味が最も近い|意味が近い|いみが いちばん ちかい|近い|ちかい|おなじ ?いみ|同じ意味", ins):
        return "synonym"
    if re.search(r"\(|（", ins):
        return "context"
    return None


def classify(section, groups, level):
    """Tag every group with its JLPT scoring part, and vocab groups with a card type."""
    if section == "listening":
        for g in groups:
            g["part"] = "listen"
        return
    if level in ("N1", "N2"):
        # part 1 = 言語知識 (vocab + grammar), part 3 = 読解
        in_grammar = False
        for g in groups:
            ins = re.sub(r"<[^>]+>", "", g["instruction"])
            g["part"] = "lang" if section == "vocab" else "read"
            if section == "vocab":
                if not in_grammar and GRAMMAR_HINT.search(ins):
                    in_grammar = True
                if not in_grammar:
                    t = vocab_type(ins)
                    if t:
                        g["card"] = t
        return
    reading = False
    for g in groups:
        ins = re.sub(r"<[^>]+>", "", g["instruction"])
        if section == "grammar_reading" and not reading:
            if "読解" in ins or "どっかい" in ins or (READ_HINT.search(ins) and not FILL_HINT.search(ins)):
                reading = True
        g["part"] = "read" if reading else "lang"
        if section == "vocab":
            t = vocab_type(ins)
            if t:
                g["card"] = t


SECTION_PARTS = {1: "vocab", 3: "grammar_reading", 4: "listening"}


def scrape_level(level):
    global IMG_DIR
    IMG_DIR = f"ja/{level}"
    out_dir = ROOT / "data" / "ja" / level / "exams"
    out_dir.mkdir(parents=True, exist_ok=True)
    tests = []
    jl = fetch(f"{BASE}/en/jlpt/{level}")
    for n in sorted({int(m) for m in re.findall(rf"/jlpt/{level}/(\d+)/1", jl)}):
        tests.append((str(n), "jlpt", n, f"{BASE}/en/jlpt/{level}/{n}"))
    pt = fetch(f"{BASE}/en/de_thi_thu/{level}")
    for n in sorted({int(m) for m in re.findall(rf"de_thi_thu/{level}/(\d+)/1", pt)}):
        tests.append((f"t{n}", "practice", n, f"{BASE}/en/de_thi_thu/{level}/{n}"))
    index = []
    for tid, kind, n, base in tests:
        test = {"id": tid, "level": level, "kind": kind, "n": n, "sections": {}}
        images = set()
        for part, key in SECTION_PARTS.items():
            url = f"{base}/{part}"
            parsed = parse_exam_page(fetch(url), images)
            if not parsed or not parsed["groups"]:
                continue
            classify(key, parsed["groups"], level)
            parsed["source"] = url
            test["sections"][key] = parsed
        counts = {k: sum(len(g["questions"]) for g in v["groups"]) for k, v in test["sections"].items()}
        if not counts:
            print(f"  ! {level} {tid}: empty", file=sys.stderr)
            continue
        (out_dir / f"{tid}.json").write_text(json.dumps(test, ensure_ascii=False, indent=1))
        index.append({"id": tid, "kind": kind, "n": n, "counts": counts})
        print(f"{level} {tid}: {counts}")
    (out_dir / "index.json").write_text(json.dumps({"level": level, "exams": index}, ensure_ascii=False, indent=1))
    return index


def write_courses():
    levels = []
    for L in LEVELS:
        d = ROOT / "data" / "ja" / L
        idx = json.loads((d / "exams" / "index.json").read_text()) if (d / "exams" / "index.json").exists() else {"exams": []}
        gram = json.loads((d / "grammar.json").read_text()) if (d / "grammar.json").exists() else []
        q = sum(sum(e["counts"].values()) for e in idx["exams"])
        levels.append({"id": L, "tests": len(idx["exams"]), "questions": q, "grammar": len(gram)})
    courses = {"courses": [{"id": "ja", "name": {"ja": "日本語", "id": "Bahasa Jepang", "en": "Japanese"},
                            "exam": "JLPT", "levels": levels}]}
    (ROOT / "data" / "courses.json").write_text(json.dumps(courses, ensure_ascii=False, indent=1))
    print(json.dumps(courses, ensure_ascii=False))


VI_CHARS = re.compile(r"[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹđĐơưăâêô]")


def clean_pattern(p):
    """Normalise a pattern title; drop Vietnamese labels the site sometimes leaves in."""
    p = re.sub(r"([〜～])\s+", r"\1", p).strip()
    if VI_CHARS.search(p):
        m = re.search(r"[(（]\s*([〜～][^)）]*)[)）]", p)
        if m:
            return m.group(1).strip()
        p = re.sub(r"^[^\u3040-\u30ff\u4e00-\u9fff〜～]+", "", p).strip()
    return p


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
            "pattern": clean_pattern(txt(".gd-pattern")),
            "romaji": txt(".gd-romaji"),
            "meaning": {"en": txt(".gd-meaning")},
            "formation": prose(".gd-formula-source"),
            "explanation": prose(".gd-explain .gd-prose"),
            "examples": examples,
            "related": related,
            "source": f"{BASE}/en/detailgrammar/{slug}",
        })
        print("grammar", slug)
    (ROOT / "data" / "ja" / level).mkdir(parents=True, exist_ok=True)
    (ROOT / "data" / "ja" / level / "grammar.json").write_text(json.dumps(items, ensure_ascii=False, indent=1))
    print(f"{len(items)} grammar patterns")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--levels", default=",".join(LEVELS))
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--only", choices=["exams", "grammar"])
    a = ap.parse_args()
    USE_CACHE = not a.no_cache
    for L in a.levels.split(","):
        if a.only != "grammar":
            scrape_level(L)
        if a.only != "exams":
            scrape_grammar(L)
    write_courses()
