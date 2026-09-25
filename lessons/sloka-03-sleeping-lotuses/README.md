# Sloka 03 — The Five Sleeping Lotuses

Ready-to-copy source lesson pack for the Sloka Adventure Engine.

## Included

- `assets/video/preview.mp4` — 36.94-second Appu/Tilli mission preview
- `assets/video/lesson.mp4` — Guruji Sarasvati Namastubhyam recital video
- `assets/sloka/sloka.txt` — two-line IAST recital text
- five progressive daily lotus scenes
- three finale scenes
- lotus progress icon
- lesson.json configured as Week 3

## Install into the repo

From the repo root:

```bash
cp -R /path/to/sloka-03-sleeping-lotuses lessons/
python3 build_lesson.py lessons/sloka-03-sleeping-lotuses
```

For the complete site:

```bash
python3 build_all.py
```

Then test:

```bash
cd dist
python3 -m http.server 8000
```

Open:

`http://localhost:8000/course-hub/`

## Core rule

5 complete Guruji recitals in a day wake one lotus.
Five challenge days complete the pond.
