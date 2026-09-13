#!/usr/bin/env python3
"""Build the complete static Slokashri Adventures production site."""

from pathlib import Path
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

    lessons = sorted(
        path
        for path in lessons_root.iterdir()
        if path.is_dir()
        and path.name != "TEMPLATE"
        and (path / "lesson.json").is_file()
    )

    for lesson in lessons:
        print(f"Building lesson: {lesson.name}", flush=True)
        result = subprocess.run(
            [sys.executable, str(builder), str(lesson)],
            cwd=root,
            check=False,
        )
        if result.returncode != 0:
            print(
                f"Build failed for lesson '{lesson.name}' (exit code {result.returncode}).",
                file=sys.stderr,
            )
            return result.returncode or 1

    shutil.copytree(hub_source, dist / "course-hub")
    (dist / "index.html").write_text(ROOT_REDIRECT, encoding="utf-8")
    (dist / ".nojekyll").touch()

    print(f"\nBuilt {len(lessons)} lesson(s):")
    for lesson in lessons:
        print(f"- {lesson.name}")
    print("\nCourse hub:")
    print("- dist/course-hub/")
    print("\nSite root:")
    print("- dist/index.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
