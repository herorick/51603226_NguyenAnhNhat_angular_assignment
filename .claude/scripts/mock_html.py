"""Token-cheap view of the SingleFile HTML mockups in docs/requirements/**.html.

The raw files are ~350 KB each (~90% base64 fonts). Never Read them directly.

Usage:
  python .claude/scripts/mock_html.py <file.html|alias> [text|markup|css] [--grep WORD]

  aliases: f1, f2, f2-missing, f3, f5, tokens

  text    (default) outline of visible text: headings, labels, buttons, values
  markup  cleaned body markup: no styles, data URIs, _ngcontent attrs, svg paths
  css     style rules without data URIs; --grep keeps only rules containing WORD
"""

import re
import sys
from html.parser import HTMLParser

MOCKUPS = "docs/requirements/"
ALIASES = {
    "f1": MOCKUPS + "f1-monthly-planning/f1-monthly-planning.html",
    "f2": MOCKUPS + "f2-income-allocation/f2-income-allocation.html",
    "f2-missing": MOCKUPS + "f1-monthly-planning/f1-monthly-planning-unavailble.html",
    "f3": MOCKUPS + "f3-add-expenses/f3-add-expenses.html",
    "f5": MOCKUPS + "f5-dashboard/f5-dashboard.html",
    "tokens": MOCKUPS + "style guideline/design-tokens-preview.html",
}
DATA_URI = re.compile(r"data:[^\"')]{100,}")
NG_ATTR = re.compile(r"\s(?:_ngcontent|_nghost|ng-reflect)[\w-]*(?:=(?:\"[^\"]*\"|[^\s>]*))?")
SVG = re.compile(r"<svg\b([^>]*)>[\s\S]*?</svg>")
STYLE = re.compile(r"<style\b[^>]*>([\s\S]*?)</style>")
COMMENT = re.compile(r"<!--[\s\S]*?-->")
SKIP_TEXT_TAGS = {"style", "script", "svg", "title"}
MARK_TAGS = {
    "h1": "# ", "h2": "## ", "h3": "### ", "h4": "#### ",
    "label": "[label] ", "button": "[button] ", "a": "[link] ",
    "option": "  - ", "th": "[th] ", "legend": "[legend] ",
}


class TextOutline(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.lines = []
        self.prefix = ""

    def handle_starttag(self, tag, attrs):
        self.stack.append(tag)
        attributes = dict(attrs)
        if tag in MARK_TAGS:
            self.prefix = MARK_TAGS[tag]
        if tag == "input":
            kind = attributes.get("type", "text")
            label = attributes.get("placeholder") or attributes.get("aria-label") or attributes.get("id") or ""
            self.lines.append(f"[input:{kind}] {label}".rstrip())
        if tag == "a" and attributes.get("href"):
            self.prefix = f"[link {attributes['href'].replace('http://localhost:4200', '')}] "

    def handle_endtag(self, tag):
        if tag in self.stack:
            while self.stack and self.stack.pop() != tag:
                pass
        if tag in MARK_TAGS:
            self.prefix = ""

    def handle_data(self, data):
        if any(tag in SKIP_TEXT_TAGS for tag in self.stack):
            return
        text = " ".join(data.split())
        if text:
            self.lines.append(self.prefix + text)
            self.prefix = ""


def clean_markup(source):
    body = STYLE.sub("", COMMENT.sub("", source))
    body = DATA_URI.sub("data:...", body)
    body = NG_ATTR.sub("", body)
    body = SVG.sub(lambda match: f"<svg{match.group(1)}/>", body)
    body = re.sub(r"[ \t]+", " ", body)
    return re.sub(r"\n\s*\n+", "\n", body).strip()


def css(source, word):
    rules = DATA_URI.sub("data:...", "\n".join(STYLE.findall(source)))
    rules = re.sub(r"\[_nghost-[\w-]+\]", ":host", rules)
    rules = re.sub(r"\[_ngcontent-[\w-]+\]", "", rules)
    rules = re.sub(r"\s+", " ", rules)
    blocks = re.findall(r"[^{}]+\{[^{}]*\}", rules)
    if word:
        blocks = [block for block in blocks if word.lower() in block.lower()]
    return "\n".join(block.strip() for block in blocks)


def main(argv):
    sys.stdout.reconfigure(encoding="utf-8")
    if len(argv) < 2:
        print(__doc__)
        return 0
    path = ALIASES.get(argv[1].lower(), argv[1])
    mode = argv[2] if len(argv) > 2 and not argv[2].startswith("--") else "text"
    word = argv[argv.index("--grep") + 1] if "--grep" in argv else ""
    with open(path, encoding="utf-8") as handle:
        source = handle.read()
    url = re.search(r"url: (\S+)", source[:600])
    print(f"<!-- source url: {url.group(1) if url else 'n/a'} | mode: {mode} -->")
    if mode == "markup":
        print(clean_markup(source))
    elif mode == "css":
        print(css(source, word))
    else:
        outline = TextOutline()
        outline.feed(clean_markup(source))
        print("\n".join(outline.lines))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
