#!/usr/bin/env python3
"""Build JLPT-style practice tests for N5 and N4 from the OpenJLPT dataset.

OpenJLPT (https://github.com/evanclan/OpenJLPT) is CC BY-SA 4.0 and contains data from
JMdict/KANJIDIC2 (EDRDG), Jonathan Waller's JLPT lists and Tatoeba. The generated files are
therefore also CC BY-SA 4.0 (see data/ja/LICENSE-openjlpt.md).

Each test has two sections in the same JSON shape as the scraped tests:
  vocab            問題1 読み方 · 問題2 表記 · 問題3 文脈規定 · 問題4 意味
  grammar_reading  問題5 文法形式 (a grammar form blanked out of an example sentence)
There is no reading-passage or listening section: the dataset has none.

Usage:  python3 scripts/build_openjlpt_tests.py [--tests 10] [--ref main]
Output: data/ja/<L>/exams/o<n>.json and the level's exams/index.json is updated.
"""
import argparse, json, random, re, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "openjlpt"
RAW = "https://raw.githubusercontent.com/evanclan/OpenJLPT/{ref}/data/json/{kind}/{level}.json"
SOURCE = "https://github.com/evanclan/OpenJLPT"
ATTRIBUTION = ("Soal dibuat otomatis dari OpenJLPT (CC BY-SA 4.0), yang memakai JMdict & KANJIDIC2 (EDRDG), "
               "daftar JLPT Jonathan Waller, dan kalimat Tatoeba")
KANJI = re.compile(r"[一-鿿々]")

# per test: (group key, size)
PLAN = [("reading", 9), ("writing", 6), ("context", 11), ("meaning", 6), ("grammar", 15)]
INSTR = {
    "reading": "問題1 ＿＿＿の ことばは ひらがなで どう かきますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。",
    "writing": "問題2 ＿＿＿の ことばは どう かきますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。",
    "context": "問題3 （　　）に なにを いれますか。1・2・3・4から いちばん いい ものを ひとつ えらんで ください。",
    "meaning": "問題4 ＿＿＿の ことばの いみ（English）として いちばん いい ものを ひとつ えらんで ください。",
    "grammar": "問題5 つぎの 文の （　　）に 何を 入れますか。1・2・3・4から いちばん いい ものを 一つ えらんで ください。",
}


def load(kind, level, ref):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"{kind}_{level}.json"
    if not f.exists():
        with urllib.request.urlopen(RAW.format(ref=ref, kind=kind, level=level), timeout=60) as r:
            f.write_bytes(r.read())
    return json.loads(f.read_text())


# ───────── kana mutations for plausible wrong readings ─────────
DAKU = dict(zip("かきくけこさしすせそたちつてとはひふへほ", "がぎぐげござじずぜぞだぢづでどばびぶべぼ"))
UNDAKU = {v: k for k, v in DAKU.items()}
HANDAKU = dict(zip("はひふへほ", "ぱぴぷぺぽ"))
SMALL = {"や": "ゃ", "ゆ": "ゅ", "よ": "ょ", "つ": "っ"}
BIG = {v: k for k, v in SMALL.items()}
O_ROW = set("おこそとのほもよろごぞどぼぽょ")
U_ROW = set("うくすつぬふむゆるぐずづぶぷゅ")


def mutations(r):
    out = set()
    for i, ch in enumerate(r):
        for table in (DAKU, UNDAKU, HANDAKU):
            if ch in table:
                out.add(r[:i] + table[ch] + r[i + 1:])
        if ch in SMALL and i > 0:
            out.add(r[:i] + SMALL[ch] + r[i + 1:])
        if ch in BIG:
            out.add(r[:i] + BIG[ch] + r[i + 1:])
        if ch == "う" and i > 0 and (r[i - 1] in O_ROW or r[i - 1] in U_ROW):
            out.add(r[:i] + r[i + 1:])  # drop long vowel
        if (ch in O_ROW or ch in U_ROW) and (i + 1 == len(r) or r[i + 1] != "う"):
            out.add(r[:i + 1] + "う" + r[i + 1:])  # add long vowel
        if ch == "っ":
            out.add(r[:i] + r[i + 1:])
        elif i + 1 < len(r) and r[i + 1] in "かきくけこさしすせそたちつてとぱぴぷぺぽ" and ch not in "んっー":
            out.add(r[:i + 1] + "っ" + r[i + 1:])
    out.discard(r)
    return [m for m in out if m and not m.startswith(("っ", "ゃ", "ゅ", "ょ"))]


def pick(rng, pool, n, avoid):
    pool = [p for p in dict.fromkeys(pool) if p not in avoid]
    rng.shuffle(pool)
    return pool[:n]


def make_options(rng, correct, distractors):
    opts = [correct] + distractors[:3]
    if len(opts) < 4:
        return None, None
    rng.shuffle(opts)
    return opts, opts.index(correct) + 1


def sentence_for(word, rng):
    exs = [e for e in word.get("examples", []) if word["word"] in e["ja"]]
    if not exs:
        return None
    return rng.choice(exs)


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def explain_word(w, ex):
    parts = [f"{esc(w['word'])}（{esc(w['reading'])}）: {esc('; '.join(w['meanings'][:3]))}"]
    if ex:
        parts.append(f"{esc(ex['ja'])}<br>{esc(ex['en'])}")
    return "<br>".join(parts)


# ───────── question builders ─────────
def q_reading(w, vocab, kanji_by_char, rng):
    ex = sentence_for(w, rng)
    if not ex or not KANJI.search(w["word"]) or w["word"] == w["reading"]:
        return None
    wrong = mutations(w["reading"])
    if len(wrong) < 3:  # top up with readings of words of the same length
        wrong += [v["reading"] for v in vocab if len(v["reading"]) == len(w["reading"]) and v["reading"] != w["reading"]]
    opts, ans = make_options(rng, w["reading"], pick(rng, wrong, 3, {w["reading"]}))
    if not opts:
        return None
    stem = esc(ex["ja"]).replace(esc(w["word"]), f"<u>{esc(w['word'])}</u>", 1)
    return {"stem": stem, "options": opts, "answer": ans, "explanation": explain_word(w, ex)}


def q_writing(w, vocab, kanji_by_char, rng, homophones):
    ex = sentence_for(w, rng)
    chars = [c for c in w["word"] if KANJI.match(c)]
    if not ex or not chars or w["word"] == w["reading"]:
        return None
    wrong = set()
    for c in chars:  # swap one kanji for another level kanji sharing a reading, or any level kanji
        alts = homophones.get(c, []) or list(kanji_by_char)
        for a in rng.sample(alts, min(6, len(alts))):
            if a != c:
                wrong.add(w["word"].replace(c, a, 1))
    if len(chars) >= 2:
        wrong.add(w["word"].replace(chars[0], chars[1], 1) if chars[0] != chars[1] else w["word"])
    opts, ans = make_options(rng, w["word"], pick(rng, list(wrong), 3, {w["word"]}))
    if not opts:
        return None
    stem = esc(ex["ja"]).replace(esc(w["word"]), f"<u>{esc(w['reading'])}</u>", 1)
    return {"stem": stem, "options": opts, "answer": ans, "explanation": explain_word(w, ex)}


def q_context(w, vocab, kanji_by_char, rng):
    ex = sentence_for(w, rng)
    if not ex or not w.get("pos") or len(w["word"]) < 2 and not KANJI.search(w["word"]):
        return None
    pos = w["pos"][0]
    same = [v["word"] for v in vocab if v.get("pos") and v["pos"][0] == pos and v["word"] not in ex["ja"]
            and abs(len(v["word"]) - len(w["word"])) <= 2 and v["word"] != w["word"]]
    opts, ans = make_options(rng, w["word"], pick(rng, same, 3, {w["word"]}))
    if not opts:
        return None
    stem = esc(ex["ja"]).replace(esc(w["word"]), "（　　）", 1)
    return {"stem": stem, "options": opts, "answer": ans, "explanation": explain_word(w, ex)}


def q_meaning(w, vocab, kanji_by_char, rng):
    if not w.get("meanings"):
        return None
    right = w["meanings"][0]
    pos = (w.get("pos") or ["-"])[0]
    others = [v["meanings"][0] for v in vocab if v.get("meanings") and v["word"] != w["word"]
              and (v.get("pos") or ["-"])[0] == pos and v["meanings"][0] != right]
    opts, ans = make_options(rng, right, pick(rng, others, 3, {right}))
    if not opts:
        return None
    ex = sentence_for(w, rng)
    return {"stem": f"<u>{esc(w['word'])}</u>（{esc(w['reading'])}）", "options": [esc(o) for o in opts],
            "answer": ans, "explanation": explain_word(w, ex)}


def grammar_keys(pattern):
    """Candidate surface strings for a pattern, longest first, including dictionary-form stems."""
    keys = []
    for part in re.split(r"\s*[/／・]\s*", pattern):
        p = re.sub(r"[（(][^）)]*[）)]", "", part).replace("〜", "").replace("～", "").strip()
        if not p or re.search(r"[A-Za-z]", p):
            continue
        keys.append(p)
        if len(p) >= 3 and p[-1] in "るうくすつぬむぶぐだい":
            keys.append(p[:-1])
    return sorted(dict.fromkeys(keys), key=len, reverse=True)


def grammar_questions(grammar, rng):
    pool = []
    for g in grammar:
        keys = grammar_keys(g["pattern"])
        for ex in g.get("examples", []):
            ja = ex["ja"]
            key = next((k for k in keys if ja.count(k) == 1), None)
            if not key:
                continue
            pool.append((g, ex, key))
    out = []
    GENERIC = {"particle", "conjugation", "politeness", "casual"}
    # particles that fit almost any slot grammatically, so they make unfair distractors
    ALWAYS_FITS = {"も", "は", "ね", "よ", "か", "が"}
    for g, ex, key in pool:
        tags = set(g.get("tags", []))
        meaning_tags = tags - GENERIC  # options sharing these could also be correct
        def ok(g2, k):
            return (g2 is not g and k != key and k not in ex["ja"] and key not in k and k not in key and k not in ALWAYS_FITS
                    and not (meaning_tags & set(g2.get("tags", []))))
        same_kind = [k for (g2, _, k) in pool if ok(g2, k) and tags & GENERIC & set(g2.get("tags", []))]
        cands = pick(rng, same_kind, 3, {key})
        if len(cands) < 3:
            cands += pick(rng, [k for (g2, _, k) in pool if ok(g2, k)], 3, {key, *cands})
        opts, ans = make_options(rng, key, cands)
        if not opts:
            continue
        stem = esc(ex["ja"]).replace(esc(key), "（　　）", 1)
        expl = f"{esc(g['pattern'])}: {esc(g.get('meaning', ''))}<br>{esc(ex['ja'])}<br>{esc(ex.get('en', ''))}"
        out.append({"stem": stem, "options": [esc(o) for o in opts], "answer": ans, "explanation": expl})
    rng.shuffle(out)
    return out


def build_level(level, n_tests, ref):
    rng = random.Random(f"openjlpt-{level}")
    vocab = load("vocab", level.lower(), ref)
    kanji = load("kanji", level.lower(), ref)
    grammar = load("grammar", level.lower(), ref)
    kanji_by_char = {k["character"]: k for k in kanji}
    by_reading = {}
    for k in kanji:
        for r in k.get("onyomi", []) + [x.split(".")[0].strip("-") for x in k.get("kunyomi", [])]:
            by_reading.setdefault(r, []).append(k["character"])
    homophones = {k["character"]: sorted({c for r in k.get("onyomi", []) for c in by_reading.get(r, []) if c != k["character"]})
                  for k in kanji}

    words = list(vocab)
    rng.shuffle(words)
    builders = {
        "reading": lambda w: q_reading(w, vocab, kanji_by_char, rng),
        "writing": lambda w: q_writing(w, vocab, kanji_by_char, rng, homophones),
        "context": lambda w: q_context(w, vocab, kanji_by_char, rng),
        "meaning": lambda w: q_meaning(w, vocab, kanji_by_char, rng),
    }
    banks = {k: [] for k in builders}
    used = {k: set() for k in builders}
    for k, fn in builders.items():  # each word appears at most once per question type
        for w in words:
            if w["word"] in used[k]:
                continue
            q = fn(w)
            if q:
                banks[k].append(q); used[k].add(w["word"])
        rng.shuffle(banks[k])
    banks["grammar"] = grammar_questions(grammar, rng)

    out_dir = ROOT / "data" / "ja" / level / "exams"
    idx_path = out_dir / "index.json"
    index = json.loads(idx_path.read_text())
    index["exams"] = [e for e in index["exams"] if e.get("kind") != "open"]
    for n in range(1, n_tests + 1):
        sections = {"vocab": {"groups": [], "passages": []}, "grammar_reading": {"groups": [], "passages": []}}
        num = {"vocab": 0, "grammar_reading": 0}
        for key, size in PLAN:
            take = banks[key][(n - 1) * size: n * size]
            if not take:
                continue
            sec = "grammar_reading" if key == "grammar" else "vocab"
            group = {"instruction": INSTR[key], "part": "lang", "questions": []}
            if key in ("reading", "writing", "context"):
                group["card"] = key
            for q in take:
                q = dict(q)
                num[sec] += 1
                q["stem"] = f"{num[sec]}. {q['stem']}"
                q.update({"points": 1, "passage": None})
                group["questions"].append(q)
            sections[sec]["groups"].append(group)
        sections = {k: v for k, v in sections.items() if v["groups"]}
        if not sections:
            break
        for v in sections.values():
            v["source"] = SOURCE
            v["sourceName"] = "OpenJLPT (CC BY-SA 4.0)"
            v["title"] = ATTRIBUTION
        tid = f"o{n}"
        test = {"id": tid, "level": level, "kind": "open", "n": n, "license": "CC BY-SA 4.0",
                "attribution": ATTRIBUTION, "sections": sections}
        (out_dir / f"{tid}.json").write_text(json.dumps(test, ensure_ascii=False, indent=1))
        counts = {k: sum(len(g["questions"]) for g in v["groups"]) for k, v in sections.items()}
        index["exams"].append({"id": tid, "kind": "open", "n": n, "counts": counts})
        print(level, tid, counts)
    idx_path.write_text(json.dumps(index, ensure_ascii=False, indent=1))
    print(level, {k: len(v) for k, v in banks.items()})


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--tests", type=int, default=10)
    ap.add_argument("--ref", default="main")
    a = ap.parse_args()
    for L in ("N5", "N4"):
        build_level(L, a.tests, a.ref)
