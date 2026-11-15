"""
apply_update.py - small update to the website: language buttons on the opening screen.

AI disclosure: written with an AI coding assistant (Claude); run by the team.

Run it once from the project folder (the one that contains the "web" folder):
    python apply_update.py
It edits web/index.html and web/style.css in place. Running it twice is harmless.
"""
import os
import sys

HTML, CSS = os.path.join("web", "index.html"), os.path.join("web", "style.css")
if not os.path.exists(HTML):
    sys.exit("I can't find web/index.html here. Run this from the folder that contains 'web'.")

html = open(HTML, encoding="utf-8").read()
css = open(CSS, encoding="utf-8").read()

anchor = '<div class="eyebrow" id="intro-eyebrow">'
buttons = ('<div class="seg intro-lang" role="group" aria-label="Language">'
           '<button data-lang="en" aria-pressed="true">English</button>'
           '<button data-lang="ko" aria-pressed="false" lang="ko">한국어</button></div>\n      ')
if "intro-lang" in html:
    print("Language buttons are already on the opening screen. Nothing to do.")
elif anchor not in html:
    sys.exit("This web/index.html is an older version without the opening screen. Tell Claude.")
else:
    html = html.replace(anchor, buttons + anchor, 1)
    css += "\n.intro-lang{margin-bottom:20px}\n.intro-lang button{padding:9px 16px;font-size:14.5px}\n"
    open(HTML, "w", encoding="utf-8").write(html)
    open(CSS, "w", encoding="utf-8").write(css)
    print("Done: English / 한국어 buttons added to the opening screen.")
