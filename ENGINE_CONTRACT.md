
# Sloka Adventure Engine v1.0 — Frozen Experience Contract

## Engine-owned behavior — do not change per lesson

1. Appu + Tilli are recurring characters.
2. Main scene is always full-bleed 16:9. Recommended production size: 1600×900.
3. Student greeting is outside the scene image.
4. Story/challenge text is outside the scene image.
5. Circular lesson video inset is in a fixed corner position.
6. Every calendar day begins with five empty daily practice balls, rendered by the engine outside the 16:9 scene image.
7. A recital counts only when the embedded video reaches its `ended` event.
8. Each accepted recital animates one large gold ball hopping from the video into the next empty ball slot.
9. Five accepted recitals on the same calendar day are required before the lesson challenge advances.
10. Challenge advances at most once per calendar day.
11. Weekly/challenge progress has exactly five steps.
12. The numbered 1–5 challenge tracker is outside the scene image and is engine-rendered.
13. Day 5 triggers the lesson finale.
14. Refresh/device changes restore daily recital count and challenge progress from Supabase.
15. Preview mode never changes progress.
16. Audio event timing is fixed across lessons.
17. The engine renders the lesson's plain UTF-8 `assets/sloka/sloka.txt` at the top of the 16:9 scene only while the recital video is active, including while paused. It is hidden before play, after `ended`, during rewards, intros, and Preview.

## Lesson-owned content — may change

- title/subtitle
- challenge caption
- lesson video
- 16:9 intro scenes
- 5 day scenes
- finale scenes
- weekly progress icon
- challenge-specific visual props/backgrounds
- one plain UTF-8 `assets/sloka/sloka.txt`; line breaks are preserved by the engine UI and the text is never baked into scene artwork

## Hard content requirements

- exactly five `days` scenes
- all production scene images 16:9; preferred 1600×900
- no baked-in UI, numbered progress tracker, greeting, or daily balls inside scene artwork
- one valid UTF-8 `assets/sloka/sloka.txt` is required for every lesson
- `recitalsPerDay` must remain 5 in Engine v1
- `challengeDays` must remain 5 in Engine v1

If a product-level behavior needs to change, change the engine version and regenerate every lesson. Never patch only one lesson's engine logic.

## Intro replay rule

The intro is controlled only by saved lesson progress. Whenever `weekProgress === 0`, the intro must play automatically on entry. Browser-local 'seen intro' flags are not used. Once `weekProgress >= 1`, the engine resumes directly at the saved challenge state.

## Voice-synchronized intro

Appu and Tilli use engine-shared greeting scenes and the reusable voice pack. Whenever `weekProgress === 0`, the intro is deterministic: Appu greeting image + Appu intro audio; Tilli greeting image + Tilli intro audio; lesson setup scenes; Appu help audio while the Appu-help scene is visible; Tilli instruction audio while the join/practice scene is visible. Each voice clip is awaited to completion before the next meaningful scene transition. Preview remains silent and never writes progress.
