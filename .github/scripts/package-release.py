"""Package the verified standalone build and the files linked by its offline guides."""

import hashlib
import json
from pathlib import Path
import shutil
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
DISTRIBUTION = (
    "APP_SPEC.md", "CHANGELOG.md", "LICENSE", "README-FIRST.txt", "README.ja.md",
    "README.md", "THIRD_PARTY_NOTICES.md", "app.config.json", "dependencies.json",
    "CONTRIBUTING.md", "SECURITY.md", "VERIFY_OFFLINE.md",
    "schemas/app-config.schema.json", "schemas/dependencies.schema.json",
    "assets/screenshot.png", "assets/screenshot-en.png", "assets/screenshot-mobile.png",
    "dist/build-size-report.json", "dist/index.html",
)


def package(output):
    config = json.loads((ROOT / "app.config.json").read_text(encoding="utf-8-sig"))
    report = json.loads((ROOT / "dist/build-size-report.json").read_text(encoding="utf-8-sig"))
    html = ROOT / "dist/index.html"
    if report["version"] != config["version"] or report["outputBytes"] != html.stat().st_size:
        raise ValueError("Build size report does not match the release HTML or app version")
    output.mkdir(parents=True, exist_ok=True)
    base = f"{config['repository']['name']}-v{config['version']}"
    standalone = output / (base + ".html")
    archive = output / (base + ".zip")
    shutil.copyfile(html, standalone)
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        for name in DISTRIBUTION:
            bundle.write(ROOT / name, name)
    with (output / "SHA256SUMS.txt").open("w", encoding="ascii", newline="\n") as sums:
        for asset in (standalone, archive):
            digest = hashlib.sha256(asset.read_bytes()).hexdigest()
            sums.write(f"{digest}  {asset.name}\n")


if __name__ == "__main__":
    package(Path(sys.argv[1]))
