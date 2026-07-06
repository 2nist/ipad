#!/usr/bin/env bash
# ================================================================
#  bundle-drums.sh — copy a curated set of default drum kits into
#  public/drums/ and regenerate public/drums/manifest.json.
#
#  These bundled kits let the app play sounds with NO backend running
#  (served as static assets). The backend/Settings directory is for the
#  full library; this is the built-in starter set.
#
#  Usage:  ./scripts/bundle-drums.sh            (SRC defaults below)
#          DRUMS_SRC=/path/to/Drums ./scripts/bundle-drums.sh
# ================================================================
set -euo pipefail

SRC="${DRUMS_SRC:-/Users/Matthew/Drums}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$SCRIPT_DIR/../public/drums"

if [[ ! -d "$SRC" ]]; then
  echo "Source library not found: $SRC" >&2
  echo "Set DRUMS_SRC=/path/to/your/Drums and re-run." >&2
  exit 1
fi

# 14 kits copied whole; the TR-808 is trimmed (192 samples is too many for a
# default) to a ~30-sample representative set below.
FULL_KITS=(
  "Roland Tr-909" "Roland Tr-707" "Roland Tr-606" "Roland Tr-727"
  "Roland cr-78" "Roland CR-8000" "Linn Linndrum" "Linn Drum LM1"
  "Oberheim Dmx" "Emu Sp12" "Emu Drumulator" "Akai Mpc60"
  "Simmons SDS5" "Jomox Xbase-09"
)

# TR-808 curated subset (clean TR-808* names map cleanly onto pads).
EIGHT08_SRC="$SRC/Roland Tr-808"
EIGHT08_FILES=(
  TR-808Kick01.wav TR-808Kick02.wav TR-808Kick03.wav TR-808Kick04.wav
  TR-808Snare01.wav TR-808Snare02.wav TR-808Snare03.wav TR-808Snare04.wav
  TR-808Clap01.wav TR-808Clap02.wav
  TR-808Hat_C01.wav TR-808Hat_C02.wav
  TR-808Hat_O01.wav TR-808Hat_O02.wav
  TR-808Cow.wav TR-808Clave.wav
  TR-808Conga01.wav TR-808Conga02.wav TR-808Conga03.wav
  TR-808Ride01.wav TR-808Ride02.wav
  TR-808Rim01.wav TR-808Rim02.wav
  TR-808Shaker01.wav TR-808Shaker02.wav
  TR-808Tom01.wav TR-808Tom02.wav TR-808Tom03.wav
  "MaxV - Roland808 - 808Ma 10.wav"
)

echo "Rebuilding $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"

copy_audio() {  # $1 = src kit dir, $2 = dest kit dir
  find "$1" -maxdepth 1 -type f \( -iname '*.wav' -o -iname '*.aiff' -o -iname '*.mp3' \) \
    -exec cp {} "$2"/ \;
}

for kit in "${FULL_KITS[@]}"; do
  if [[ -d "$SRC/$kit" ]]; then
    mkdir -p "$DEST/$kit"
    copy_audio "$SRC/$kit" "$DEST/$kit"
    echo "  $kit ($(find "$DEST/$kit" -type f | wc -l | tr -d ' ') files)"
  else
    echo "  SKIP (missing): $kit" >&2
  fi
done

# TR-808 trimmed
mkdir -p "$DEST/Roland Tr-808"
for f in "${EIGHT08_FILES[@]}"; do
  [[ -f "$EIGHT08_SRC/$f" ]] && cp "$EIGHT08_SRC/$f" "$DEST/Roland Tr-808"/ || echo "  808 missing: $f" >&2
done
echo "  Roland Tr-808 trimmed ($(find "$DEST/Roland Tr-808" -type f | wc -l | tr -d ' ') files)"

# Generate manifest.json (kit list + per-sample static URLs, URL-encoded).
python3 - "$DEST" <<'PY'
import json, sys, os
from urllib.parse import quote
dest = sys.argv[1]
exts = ('.wav', '.aiff', '.mp3')
kits = []
for kit in sorted(os.listdir(dest)):
    kdir = os.path.join(dest, kit)
    if not os.path.isdir(kdir):
        continue
    samples = []
    for fn in sorted(os.listdir(kdir)):
        if fn.lower().endswith(exts):
            url = "/drums/" + quote(kit) + "/" + quote(fn)
            samples.append({"filename": fn, "url": url})
    if samples:
        kits.append({"name": kit, "sampleCount": len(samples), "samples": samples})
with open(os.path.join(dest, "manifest.json"), "w") as f:
    json.dump({"kits": kits}, f, indent=1)
print(f"manifest.json: {len(kits)} kits, {sum(k['sampleCount'] for k in kits)} samples")
PY

echo "Done. Bundle size: $(du -sh "$DEST" | cut -f1)"
