
# Sloka Adventure Engine v1.0

This is the frozen reusable engine for the Appu + Tilli sloka course.

## What stays fixed

- 5 full video recitals per calendar day
- 5 daily balls, filled by a large hopping-ball animation
- weekly/challenge progress only after ball #5
- maximum one challenge step per calendar day
- 5 challenge days
- same 16:9 player layout and UI placement
- same Supabase state model
- same audio event triggers
- same lesson-specific preview-video behavior

## What changes per sloka

Only `lesson.json` and lesson assets: a lesson-specific preview video, Guruji recital video, challenge caption, 16:9 scenes, progress icon, one plain UTF-8 `assets/sloka/sloka.txt`, and optional reusable voice audio paths. The engine controls sloka rendering and shows it only while the recital video is active (including pauses).

## Folders

- `engine/` — frozen frontend engine
- `backend/` — Engine v1 Supabase migration and Edge Function
- `lessons/sloka-02-mangoes/` — reference lesson
- `build_lesson.py` — packages any lesson without editing engine code
- `ENGINE_CONTRACT.md` — rules that keep all 15+ lessons consistent
- `AUDIO_PACK.md` — fixed reusable voice event contract

## Build the reference lesson

```bash
python3 build_lesson.py lessons/sloka-02-mangoes
```

The result is written to `dist/sloka-02-mangoes_engine_v1.zip`.

## Backend upgrade

1. Run `backend/001_engine_v1_recitals.sql` once in Supabase SQL Editor.
2. Replace the existing `player-progress` Edge Function with `backend/player-progress.ts`.
3. Keep JWT verification OFF for this custom game-token endpoint, as in the current POC.
4. Deploy `player-start.ts` only if you want the multi-user mock lookup included here.

The Engine v1 backend stores each completed recital in `recital_events`, so the five daily balls restore across refreshes/devices. The existing `practice_events` table continues to represent one completed challenge step per day.

## Audio

The engine runs without voice files. When the Cartesia clips are ready, add the eight reusable voice files and fill their paths in each lesson's `lesson.json`. See `AUDIO_PACK.md`.

## Sloka text

Every lesson must supply `assets/sloka/sloka.txt` as plain UTF-8 text. Keep intended line breaks in that file; the engine preserves them in its top-of-scene recital overlay. Do not add the text to `lesson.json` or bake it into scene images. The overlay is visible only after the recital video starts and is hidden on `ended`, throughout reward animation, intro, waiting, and Preview.

## Lesson videos

Every lesson supplies two different videos:

- `assets/video/preview.mp4` through `previewVideo`: a 30–45 second lesson hook, problem, and instruction video.
- `assets/video/lesson.mp4` through `video`: the Guruji recital/practice video.

The preview plays on every lesson entry, independent of saved challenge or daily progress, and the **Watch Preview** button replays it. The engine attempts audible autoplay and displays a one-tap **Start Adventure** fallback when the browser blocks it. Preview playback is informational and never writes progress.


### v1 layout correction
Daily practice balls are rendered outside the scene image. The 16:9 artwork area contains only the lesson scene plus the circular video inset; no daily-progress tray or placeholders are drawn over the scene.

### Preview entry behavior
The lesson-specific preview video replaces the automatic greeting/story slideshow and plays on every lesson entry. Appu/Tilli greeting scenes and reusable WAVs remain available to the engine for other story and reward uses.

## Production Deployment

Build the complete static site locally:

```bash
python3 build_all.py
```

Test the generated site locally:

```bash
cd dist
python3 -m http.server 8000
```

Then visit http://localhost:8000/.

Production deployment is triggered by pushing `main`:

```bash
git push origin main
```

GitHub Actions builds `dist/` from source and deploys it automatically with GitHub Pages. The intended production domain is https://play.vedantapeetam.org/, but application navigation remains relative so the same build also works at the GitHub project Pages URL.
