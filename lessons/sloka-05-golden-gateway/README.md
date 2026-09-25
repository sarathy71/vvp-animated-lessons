# Sloka 05 — The Five Jewels of the Golden Gateway

Lesson ID: `sloka-05-golden-gateway`  
Series: `appu`  
Week: `5`

## Install
Copy this entire folder into the engine's `lessons/` directory, then run the existing manifest/build flow. Do not hard-code Week 5 into the hub when automatic lesson discovery is enabled.

## Gameplay contract
- Five complete Guruji recitals per calendar day.
- Recitals 1–4 fill only the daily gold balls. No Yay and no weekly challenge movement.
- After recital 5 is server-confirmed complete: fill ball 5, play one short Yay, restore exactly one jewel, run `jewel-restore`, and leave the cumulative scene visible.
- Maximum one jewel restoration per calendar day.
- Day 5 restores the purple fifth jewel first. Only after that restoration completes should the existing Day 5 finale run.
- Reloading must render persisted state without replaying Yay or the restoration animation.

## Jewel order
1. Ruby red
2. Golden yellow
3. Emerald green
4. Sapphire blue
5. Rich purple

## Media
- `assets/video/preview.mp4` — picture-driven preview with the supplied master narration embedded.
- `assets/video/lesson.mp4` — exact supplied Guruji video (`Namastestu(1).mp4`), copied without replacement.
- `assets/audio/master_preview.wav` — supplied Cartesia narration master retained as source/reference audio.

## Sloka rendering
`assets/sloka/sloka.txt` contains exactly two non-empty logical lines. The engine must preserve those exact line breaks and must not split either line further.

## Character continuity
Appu is the blue baby elephant. Tilli is the small green baby turtle. All packaged challenge scenes use the approved Appu + turtle Golden Gateway sequence; no collage image is used.

## Shared SFX
Ball landing, Yay/day-complete, and final-victory SFX are intentionally referenced as shared engine behavior rather than duplicated into this pack.
