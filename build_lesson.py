#!/usr/bin/env python3
from pathlib import Path
import argparse, json, shutil, zipfile, sys

def main():
    ap=argparse.ArgumentParser(description='Build a Sloka Adventure Engine v1 lesson package')
    ap.add_argument('lesson_dir',help='Lesson directory containing lesson.json and assets/')
    ap.add_argument('--out',default=None,help='Output zip path')
    args=ap.parse_args()
    root=Path(__file__).resolve().parent; engine=root/'engine'; lesson=Path(args.lesson_dir).resolve(); cfg_path=lesson/'lesson.json'
    if not cfg_path.exists():sys.exit('lesson.json not found')
    cfg=json.loads(cfg_path.read_text())
    if cfg.get('schemaVersion')!='1.0':sys.exit('Engine v1 requires schemaVersion 1.0')
    if cfg.get('practice')!={'recitalsPerDay':5,'challengeDays':5}:sys.exit('Engine v1 fixes practice at 5 recitals/day × 5 days')
    if len(cfg.get('scenes',{}).get('days',[]))!=5:sys.exit('Exactly 5 day scenes are required')
    preview_video=cfg.get('previewVideo')
    if not isinstance(preview_video,str) or not preview_video:sys.exit('Missing required lesson config: previewVideo')
    build=root/'dist'/cfg['lessonId']
    if build.exists():shutil.rmtree(build)
    shutil.copytree(engine,build)
    # runtime-config.example is documentation only
    (build/'runtime-config.example.js').unlink(missing_ok=True)
    assets=lesson/'assets'
    if assets.exists():shutil.copytree(assets,build/'assets',dirs_exist_ok=True)
    sloka=assets/'sloka'/'sloka.txt'
    if not sloka.is_file():sys.exit('Missing required UTF-8 sloka text: assets/sloka/sloka.txt')
    try:sloka.read_text(encoding='utf-8')
    except UnicodeDecodeError:sys.exit('Sloka text must be valid UTF-8: assets/sloka/sloka.txt')
    (build/'lesson-config.js').write_text('window.SLOKA_LESSON = Object.freeze('+json.dumps(cfg,separators=(',',':'),ensure_ascii=False)+');\n')
    # validate referenced assets
    refs=[cfg['video'],preview_video,cfg['progressIcon'],'assets/sloka/sloka.txt']
    for group in ('intro','days','finale'): refs += [x['src'] for x in cfg['scenes'][group]]
    for section in ('sfx','voice'):
        for v in cfg.get('audio',{}).get(section,{}).values():
            if v: refs.append(v)
    missing=[r for r in refs if not (build/r).exists()]
    if missing:
        if preview_video in missing:sys.exit('Missing configured preview video: '+preview_video)
        sys.exit('Missing lesson assets: '+', '.join(missing))
    out=Path(args.out) if args.out else root/'dist'/f"{cfg['lessonId']}_engine_v1.zip"
    out.parent.mkdir(parents=True,exist_ok=True)
    if out.exists():out.unlink()
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
        for p in build.rglob('*'):
            if p.is_file():z.write(p,p.relative_to(build))
    print(out)
if __name__=='__main__':main()
