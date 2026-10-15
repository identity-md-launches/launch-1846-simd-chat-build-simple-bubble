"""Optional contributor helper: stage a build outside the repository (no in-tree dependencies)."""
import argparse
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('destination', help='An existing temporary build directory outside the repository')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
destination = Path(args.destination).resolve()
if destination == root or root in destination.parents:
    raise SystemExit('Choose a build directory outside the repository.')
destination.mkdir(parents=True, exist_ok=True)
for name in ('src', 'public', 'test'):
    source = root / name
    target = destination / name
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target, ignore=shutil.ignore_patterns('scratch', 'node_modules', '*.tsbuildinfo'))
for name in ('package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html'):
    shutil.copy2(root / name, destination / name)
print(f'Copied frontend source to {destination}')
