# AI usage

We used AI tools during the hackathon. This is the full list.

## What the AI did

- **Python scripts** (`horizon.py`, `test_horizon.py`, `fetch_horizons.py`, `combine.py`, `scan.py`, `decision_map.py`, `export_terrain.py`, `export_polar.py`, `build_site_data.py`, `apply_update.py`): drafted with Claude (Anthropic).
- **`compare_nasa.py`** and the NASA comparison section of the README: drafted with Claude (Anthropic).
- **Website** (`web/index.html`, `web/style.css`, `web/app.js`, `web/i18n.js`, including the Korean text): drafted with Claude (Anthropic). Some changes were committed to this repository directly by the AI assistant; those commits are marked `Co-Authored-By: Claude`.
- **README and slides** (`demo.pdf`): wording and layout drafted with Claude from our outline and our results.
- **Planning**: Claude helped us read the judging criteria, organise tasks and review the project critically.
- **Team notes in Notion**: generated with an AI assistant from our own outline.

## What we did

- Chose the challenge, the idea (judge a landing date against a mission's own requirement, and test launch slips and landing misses) and the scope.
- Chose the three sites and the mission presets.
- Downloaded the NASA data and ran every script on our own computers. All numbers on the site come from those runs.
- Ran the known-answer tests and the comparison with NASA's average sunlight maps, and read the results.
- Reviewed the website and asked for changes until it said what we meant.

## What is not AI

- The data: NASA LOLA elevation and average visibility maps, and JPL Horizons positions.
- three.js, an open-source 3D library (MIT licence).

No AI-generated images, video or audio are used. No NASA logos or branding are used.
