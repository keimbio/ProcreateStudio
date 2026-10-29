#!/usr/bin/env python3
"""Assemble Procreate Studio into one self-contained index.html.

    python3 build.py            → dist/index.html

Steps: concatenate core engine modules → `node --check` every JS bundle →
embed fonts as base64 @font-face → substitute into template → assert no
placeholders remain. No network access, no third-party code.
"""
import base64, pathlib, subprocess, sys, tempfile

VERSION = "4.0.0"
ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
CORE = ["zip", "bplist", "codecs", "procreate", "composite", "palette", "encoders", "engine"]
FONTS = [  # (file, family, weight, style)
    ("hanken-grotesk-latin-300-normal.woff2", "Hanken Grotesk", 300, "normal"),
    ("hanken-grotesk-latin-400-normal.woff2", "Hanken Grotesk", 400, "normal"),
    ("hanken-grotesk-latin-400-italic.woff2", "Hanken Grotesk", 400, "italic"),
    ("hanken-grotesk-latin-500-normal.woff2", "Hanken Grotesk", 500, "normal"),
    ("hanken-grotesk-latin-600-normal.woff2", "Hanken Grotesk", 600, "normal"),
    ("hanken-grotesk-latin-700-normal.woff2", "Hanken Grotesk", 700, "normal"),
    ("jetbrains-mono-latin-400-normal.woff2", "JetBrains Mono", 400, "normal"),
    ("jetbrains-mono-latin-500-normal.woff2", "JetBrains Mono", 500, "normal"),
]


def node_check(name, code):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(code)
    r = subprocess.run(["node", "--check", f.name], capture_output=True, text=True)
    pathlib.Path(f.name).unlink()
    if r.returncode:
        sys.exit(f"✗ JS syntax error in {name}:\n{r.stderr}")
    print(f"✓ node --check {name} ({len(code)//1024} KB)")


def main():
    engine = "\n".join((SRC / "js/core" / f"{n}.js").read_text() for n in CORE)
    app = (SRC / "js/app.js").read_text()
    node_check("engine", engine)
    node_check("app", engine + "\n" + app)
    for bad in ("</script", "<!--"):
        if bad in engine or bad in app:
            sys.exit(f"✗ '{bad}' inside JS would break the inline <script>")

    fonts = "\n".join(
        f"@font-face{{font-family:'{fam}';font-style:{st};font-weight:{w};font-display:swap;"
        f"src:url(data:font/woff2;base64,{base64.b64encode((SRC/'fonts'/fn).read_bytes()).decode()}) format('woff2')}}"
        for fn, fam, w, st in FONTS)

    html = (SRC / "template.html").read_text()
    for key, val in {"/*{{FONTS}}*/": fonts, "/*{{STYLES}}*/": (SRC / "styles.css").read_text(),
                     "/*{{APP}}*/": app, "{{VERSION}}": VERSION}.items():
        if key not in html:
            sys.exit(f"✗ placeholder {key} missing from template")
        html = html.replace(key, val)
    html = html.replace("/*{{ENGINE}}*/", engine)  # appears twice: worker source + main-thread copy
    leftover = [p for p in ("{{FONTS}}", "{{STYLES}}", "{{ENGINE}}", "{{APP}}", "{{VERSION}}") if p in html]
    if leftover:
        sys.exit(f"✗ unreplaced placeholders: {leftover}")

    out = ROOT / "dist" / "index.html"
    out.parent.mkdir(exist_ok=True)
    out.write_text(html)
    print(f"✓ built {out.relative_to(ROOT)} — {len(html)//1024} KB, v{VERSION}")


if __name__ == "__main__":
    main()
