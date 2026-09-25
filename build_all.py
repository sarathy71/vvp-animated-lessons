#!/usr/bin/env python3
"""Build the complete static Slokashri Adventures production site."""

from pathlib import Path
import json
import shutil
import subprocess
import sys


ROOT_REDIRECT = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=./course-hub/">
  <title>Slokashri Adventures</title>
</head>
<body>
  <p><a href="./course-hub/">Continue to Slokashri Adventures</a></p>
</body>
</html>
"""


def lesson_display_label(lesson_dir: Path, week_number: int) -> str:
    sloka_path = lesson_dir / "assets" / "sloka" / "sloka.txt"
    if sloka_path.is_file():
        try:
            for line in sloka_path.read_text(encoding="utf-8").splitlines():
                words = line.split()
                if words:
                    return " ".join(words[:2])
        except (OSError, UnicodeError):
            pass
    return f"Sloka {week_number}"


def main() -> int:
    root = Path(__file__).resolve().parent
    lessons_root = root / "lessons"
    builder = root / "build_lesson.py"
    hub_source = root / "course-hub"
    dist = root / "dist"

    if not builder.is_file():
        print("Build failed: build_lesson.py was not found.", file=sys.stderr)
        return 1
    if not (hub_source / "index.html").is_file():
        print("Build failed: course-hub/index.html was not found.", file=sys.stderr)
        return 1

    if dist.exists():
        shutil.rmtree(dist)
    dist.mkdir(parents=True)

    lesson_dirs = sorted(
        path
        for path in lessons_root.iterdir()
        if path.is_dir()
        and path.name != "TEMPLATE"
        and (path / "lesson.json").is_file()
    )

    required_hub_fields = ("lessonId", "seriesKey", "weekNumber", "title")
    lessons = []
    for lesson_dir in lesson_dirs:
        config_path = lesson_dir / "lesson.json"
        try:
            config = json.loads(config_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            print(f"Build failed: could not read {config_path}: {error}", file=sys.stderr)
            return 1
        missing = [field for field in required_hub_fields if config.get(field) in (None, "")]
        if missing:
            print(
                f"Build failed: {config_path} is missing required hub metadata: {', '.join(missing)}",
                file=sys.stderr,
            )
            return 1
        if not isinstance(config["weekNumber"], int):
            print(f"Build failed: {config_path} weekNumber must be an integer.", file=sys.stderr)
            return 1
        lessons.append((lesson_dir, config))

    lessons.sort(key=lambda item: (item[1]["weekNumber"], item[1]["lessonId"]))

    for lesson_dir, config in lessons:
        print(f"Building lesson: {lesson_dir.name}", flush=True)
        result = subprocess.run(
            [sys.executable, str(builder), str(lesson_dir)],
            cwd=root,
            check=False,
        )
        if result.returncode != 0:
            print(
                f"Build failed for lesson '{lesson_dir.name}' (exit code {result.returncode}).",
                file=sys.stderr,
            )
            return result.returncode or 1

    shutil.copytree(hub_source, dist / "course-hub")
    shutil.copy2(root / "engine" / "runtime-config.js", dist / "course-hub" / "runtime-config.js")
    shutil.copytree(
        root / "engine" / "assets" / "greetings",
        dist / "course-hub" / "assets" / "greetings",
    )
    manifest = [
        {
            "lessonId": config["lessonId"],
            "seriesKey": config["seriesKey"],
            "weekNumber": config["weekNumber"],
            "title": config["title"],
            "displayLabel": lesson_display_label(lesson_dir, config["weekNumber"]),
            "href": f"../{config['lessonId']}/",
            "icon": config.get("hubIcon") or "✦",
        }
        for lesson_dir, config in lessons
    ]
    (dist / "course-hub" / "lessons-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (dist / "index.html").write_text(ROOT_REDIRECT, encoding="utf-8")
    (dist / ".nojekyll").touch()

    print(f"\nBuilt {len(lessons)} lesson(s):")
    for lesson_dir, _ in lessons:
        print(f"- {lesson_dir.name}")
    print("\nCourse hub:")
    print("- dist/course-hub/")
    print("\nSite root:")
    print("- dist/index.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
