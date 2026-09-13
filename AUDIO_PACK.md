
# Sloka Adventure Engine v1 — fixed reusable voice pack

The engine never requires challenge-specific voice generation. Challenge-specific information stays in the scene/caption.

Use these fixed voice events for every lesson:

| Config key | Speaker | Suggested line |
|---|---|---|
| `appuIntro` | Appu | “Hi! I am Appu!” |
| `tilliIntro` | Tilli | “Hi! I am Tilli!” |
| `appuHelp` | Appu | “Tilli needs your help. Can you help Tilli?” |
| `tilliInstruction` | Tilli | “Yes, you can help me by reciting the sloka.” |
| `recitalCheer` | Appu + Tilli | “Yayy!” |
| `dailyComplete` | Appu + Tilli | “Wow, you got us one today!” |
| `appuChallengeComplete` | Appu | “Hooray! You did it!” |
| `tilliThanks` | Tilli | “Thank you for helping me.” |

There are intentionally **no** “4 more / 3 more / 2 more / 1 more” voice clips in v1. Weekly remaining progress stays visual and deterministic.

When Cartesia files are ready, place them under a lesson's `assets/audio/voice/` directory and set the corresponding paths in `lesson.json`. The same eight files can be reused by all lessons.

## Bundled Engine v1 voice assets

The reusable Appu/Tilli WAVs live under `engine/assets/audio/voice/` and are copied into every built lesson as part of the frozen engine. Greeting artwork lives under `engine/assets/greetings/`.

