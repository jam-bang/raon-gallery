"""Build web previews and ZIPs without modifying the selected originals.

Usage: python scripts/prepare_media.py --source ../셀렉 [--ffmpeg PATH]
Requires Pillow; ffmpeg is required when videos are present.
Generated original ZIPs and local source paths are intentionally ignored by Git.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import uuid
import zipfile
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'

def ffmpeg_path(explicit):
    if explicit:
        return explicit
    found = shutil.which('ffmpeg')
    if found:
        return found
    sys.path.insert(0, str(ROOT / '.tools'))
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        raise SystemExit('Videos require ffmpeg. Install ffmpeg and add it to PATH, or pass --ffmpeg PATH.')

def run(command):
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if result.returncode:
        raise RuntimeError(result.stderr[-3000:])
    return result

def atomic_json(path, data):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--ffmpeg')
    parser.add_argument('--snapshot', action='store_true', help='Copy a stable working selection into .local before processing')
    args = parser.parse_args()
    source = Path(args.source).resolve(strict=True)
    if not source.is_dir():
        raise SystemExit('Source must be a directory.')
    files = sorted((p for p in source.iterdir() if p.is_file() and p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.mp4', '.mov', '.m4v'}), key=lambda p: p.name.lower())
    if not files:
        raise SystemExit('No supported photos or videos found.')
    if args.snapshot:
        destination = ROOT / '.local' / 'snapshots' / uuid.uuid4().hex[:12]
        destination.mkdir(parents=True)
        print(f'Copying {len(files)} files to a local working snapshot...', flush=True)
        for original in files:
            for attempt in range(3):
                before = (original.stat().st_size, original.stat().st_mtime_ns)
                shutil.copy2(original, destination / original.name)
                after = (original.stat().st_size, original.stat().st_mtime_ns)
                if before == after:
                    break
                if attempt == 2:
                    raise SystemExit(f'File is still being saved: {original.name}. Retry after saving finishes.')
                time.sleep(0.5)
        source = destination
        files = [destination / original.name for original in files]
        print('Working snapshot ready.', flush=True)
    # Snapshot prevents a changing selection from silently producing partial archives.
    snapshot = {p.name: (p.stat().st_size, p.stat().st_mtime_ns) for p in files}
    has_videos = any(p.suffix.lower() in {'.mp4', '.mov', '.m4v'} for p in files)
    encoder = ffmpeg_path(args.ffmpeg) if has_videos else None
    for directory in ['media/thumbs', 'media/photos', 'media/videos', 'media/archives']:
        (PUBLIC / directory).mkdir(parents=True, exist_ok=True)
    (ROOT / '.local').mkdir(exist_ok=True)
    items = []
    archive_groups = {'all': [], 'photos': [], 'videos': []}
    cache_path = ROOT / '.local' / 'prepare-cache.json'
    cache = json.loads(cache_path.read_text(encoding='utf-8')) if cache_path.exists() else {}
    new_cache = {}
    for number, path in enumerate(files, 1):
        kind = 'video' if path.suffix.lower() in {'.mp4', '.mov', '.m4v'} else 'photo'
        # Include extension in IDs to avoid collisions between JPG and MP4 stems.
        identifier = path.name.replace('.', '-').lower()
        thumb = PUBLIC / 'media' / 'thumbs' / f'{identifier}.jpg'
        preview = PUBLIC / 'media' / ('photos' if kind == 'photo' else 'videos') / f'{identifier}.{ "jpg" if kind == "photo" else "mp4" }'
        stamp = list(snapshot[path.name])
        cached = cache.get(path.name)
        if cached and cached['stamp'] == stamp and thumb.exists() and preview.exists():
            item = cached['item']
        else:
            item = {'id': identifier, 'name': path.name, 'type': kind, 'bytes': snapshot[path.name][0], 'thumbnail': thumb.relative_to(PUBLIC).as_posix()}
            if kind == 'photo':
                with Image.open(path) as original:
                    im = ImageOps.exif_transpose(original).convert('RGB')
                    item.update(width=im.width, height=im.height)
                    im.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
                    im.save(preview, 'JPEG', quality=85, optimize=True)
                    im.thumbnail((640, 640), Image.Resampling.LANCZOS)
                    im.save(thumb, 'JPEG', quality=80, optimize=True)
                item['preview'] = preview.relative_to(PUBLIC).as_posix()
            else:
                probe = subprocess.run([encoder, '-hide_banner', '-i', str(path)], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
                time = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', probe)
                dimensions = re.search(r'Video:.*?\b(\d{2,5})x(\d{2,5})\b', probe)
                if not time or not dimensions:
                    raise RuntimeError(f'Cannot inspect video: {path.name}')
                seconds = int(time[1]) * 3600 + int(time[2]) * 60 + float(time[3])
                item.update(width=int(dimensions[1]), height=int(dimensions[2]), duration=round(seconds, 2), previewName=preview.name)
                run([encoder, '-y', '-hide_banner', '-loglevel', 'error', '-ss', str(min(2, seconds / 3)), '-i', str(path), '-frames:v', '1', '-vf', 'scale=640:640:force_original_aspect_ratio=decrease', '-update', '1', str(thumb)])
                temp = preview.with_name(preview.stem + '.partial.mp4')
                run([encoder, '-y', '-hide_banner', '-loglevel', 'error', '-i', str(path), '-map', '0:v:0', '-map', '0:a:0?', '-vf', "scale=960:960:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-threads', '2', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-map_metadata', '-1', str(temp)])
                temp.replace(preview)
        items.append(item)
        new_cache[path.name] = {'stamp': stamp, 'item': item}
        # Keep expensive completed transcodes reusable after interruption.
        cache[path.name] = new_cache[path.name]
        atomic_json(cache_path, cache)
        archive_groups['all'].append(path)
        archive_groups['videos' if kind == 'video' else 'photos'].append(path)
        print(f'[{number}/{len(files)}] {path.name}', flush=True)
    current = {p.name: (p.stat().st_size, p.stat().st_mtime_ns) for p in source.iterdir() if p.is_file() and p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.mp4', '.mov', '.m4v'}}
    if current != snapshot:
        raise SystemExit('Selection changed while processing. Run again to include the current selection.')
    photos = [item for item in items if item['type'] == 'photo']
    cover = next((item for item in photos if item['id'] == 'dsc06115-jpg'), photos[0] if photos else None)
    manifest = {'title': '라온의 순간 — 응암2동 함께마당', 'event': '제8회 응암2동 주민총회 & 응암2동 함께마당', 'coverId': cover['id'] if cover else None, 'items': sorted(items, key=lambda i: (i['type'] != 'photo', i['name'])), 'archives': []}
    atomic_json(PUBLIC / 'gallery.json', manifest)
    atomic_json(ROOT / '.local' / 'source.json', {'source': str(source), 'files': [p.name for p in files]})
    print('Gallery preview ready. Preparing downloads...', flush=True)
    archives = []
    for group, members in archive_groups.items():
        if not members:
            continue
        name = f'raon-eungam-{group}.zip'
        dest = PUBLIC / 'media' / 'archives' / name
        temporary = dest.with_suffix('.partial.zip')
        print(f'Packing {name} ({len(members)} files)', flush=True)
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
            for path in members:
                archive.write(path, path.name)
        temporary.replace(dest)
        archives.append({'name': name, 'label': {'all': '사진·영상 전체 다운로드', 'photos': '사진만 다운로드', 'videos': '영상만 다운로드'}[group], 'count': len(members), 'bytes': dest.stat().st_size})
    current = {p.name: (p.stat().st_size, p.stat().st_mtime_ns) for p in source.iterdir() if p.is_file() and p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.mp4', '.mov', '.m4v'}}
    if current != snapshot:
        raise SystemExit('Selection changed while packing. Run again to include the current selection.')
    manifest['archives'] = archives
    atomic_json(PUBLIC / 'gallery.json', manifest)
    atomic_json(ROOT / '.local' / 'source.json', {'source': str(source), 'files': [p.name for p in files]})
    atomic_json(cache_path, new_cache)
    print(f'Ready: {len(items)} media items. Original files unchanged.', flush=True)

if __name__ == '__main__':
    main()
