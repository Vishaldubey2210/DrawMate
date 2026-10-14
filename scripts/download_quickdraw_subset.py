#!/usr/bin/env python3
"""
Automated downloader for Google Quick, Draw! Dataset subset.
Enforces strict 10 GB hard storage limit (prefers < 5 GB).
Streams .npy category files sequentially from official Google Cloud Storage,
validates NumPy structure, calculates SHA-256 checksums, and writes manifest.
"""

import os
import sys
import json
import ssl
import hashlib
import urllib.request
import urllib.error
import numpy as np

try:
    import certifi
    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CONTEXT = ssl.create_default_context()

HARD_LIMIT_BYTES = 10_000_000_000  # 10 GB decimal
PREFERRED_BUDGET_BYTES = 5_000_000_000  # 5 GB target

CATEGORIES_URL = "https://raw.githubusercontent.com/googlecreativelab/quickdraw-dataset/master/categories.txt"
BASE_DATA_URL = "https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap/{category}.npy"

CANDIDATE_CLASSES = [
    "airplane", "apple", "banana", "bicycle", "bird",
    "car", "cat", "chair", "clock", "cloud",
    "dog", "fish", "flower", "house", "key",
    "moon", "mountain", "pizza", "tree", "umbrella"
]

LICENSE_TEXT = """# Google Quick, Draw! Dataset License & Attribution

The drawings in the Quick, Draw! Dataset were created by Google Creative Lab and are made available under the Creative Commons Attribution 4.0 International (CC BY 4.0) License.

Source Documentation: https://github.com/googlecreativelab/quickdraw-dataset
Data hosted by Google Cloud Storage: https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap/

Attribution:
Google Creative Lab, Quick, Draw! Dataset (2017).
Licensed under Creative Commons Attribution 4.0 International.
https://creativecommons.org/licenses/by/4.0/
"""

def get_dir_size(path: str) -> int:
    total = 0
    if not os.path.exists(path):
        return 0
    for root, _, files in os.walk(path):
        for f in files:
            total += os.path.getsize(os.path.join(root, f))
    return total

def fetch_categories_list() -> list[str]:
    req = urllib.request.Request(CATEGORIES_URL, headers={"User-Agent": "DrawMate-Downloader/1.0"})
    with urllib.request.urlopen(req, context=SSL_CONTEXT, timeout=15) as res:
        return [c.strip() for c in res.read().decode("utf-8").splitlines() if c.strip()]

def get_remote_file_size(category: str) -> int:
    url = BASE_DATA_URL.format(category=urllib.parse.quote(category))
    req = urllib.request.Request(url, headers={"User-Agent": "DrawMate-Downloader/1.0"})
    req.get_method = lambda: "HEAD"
    try:
        with urllib.request.urlopen(req, context=SSL_CONTEXT, timeout=15) as res:
            cl = res.headers.get("Content-Length")
            return int(cl) if cl else 0
    except Exception as e:
        print(f"  Warning: could not get HEAD size for {category}: {e}")
        return 0

def validate_npy_file(filepath: str) -> tuple[bool, int, str]:
    """Validates that file is a readable 28x28 grayscale QuickDraw bitmap array."""
    try:
        arr = np.load(filepath, mmap_mode="r")
        if arr.ndim != 2 or arr.shape[1] != 784:
            return False, 0, f"Unexpected shape {arr.shape}, expected (N, 784)"
        sample_count = int(arr.shape[0])
        if sample_count <= 0:
            return False, 0, "Empty array"
        return True, sample_count, ""
    except Exception as e:
        return False, 0, str(e)

def compute_sha256(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def download_file_streaming(category: str, dest_path: str, max_allowed_bytes: int, retries: int = 3) -> tuple[bool, int, str]:
    url = BASE_DATA_URL.format(category=urllib.parse.quote(category))
    tmp_path = dest_path + ".part"
    req = urllib.request.Request(url, headers={"User-Agent": "DrawMate-Downloader/1.0"})

    last_error = ""
    for attempt in range(1, retries + 1):
        bytes_written = 0
        try:
            with urllib.request.urlopen(req, context=SSL_CONTEXT, timeout=45) as response, open(tmp_path, "wb") as out_file:
                while chunk := response.read(65536):
                    bytes_written += len(chunk)
                    if bytes_written > max_allowed_bytes:
                        out_file.close()
                        if os.path.exists(tmp_path):
                            os.remove(tmp_path)
                        return False, 0, "Exceeded remaining storage budget"
                    out_file.write(chunk)

            os.replace(tmp_path, dest_path)
            return True, bytes_written, ""
        except Exception as e:
            last_error = str(e)
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            if attempt < retries:
                time.sleep(2 * attempt)
    return False, 0, last_error

def download_quickdraw_subset(
    output_dir: str = "data/quickdraw",
    categories_to_download: list[str] = CANDIDATE_CLASSES,
    max_classes: int = 20,
) -> dict:
    os.makedirs(output_dir, exist_ok=True)
    bitmap_dir = os.path.join(output_dir, "numpy_bitmap")
    os.makedirs(bitmap_dir, exist_ok=True)

    # 1. Write License text
    license_path = os.path.join(output_dir, "DATASET_LICENSE.md")
    with open(license_path, "w", encoding="utf-8") as f:
        f.write(LICENSE_TEXT)

    print("=" * 65)
    print(" QUICK, DRAW! DATASET DOWNLOADER")
    print(f" Storage Budget: Max {HARD_LIMIT_BYTES / 1e9:.1f} GB (Target < {PREFERRED_BUDGET_BYTES / 1e9:.1f} GB)")
    print(f" Output Directory: {output_dir}")
    print("=" * 65)

    # 2. Fetch and write official categories list
    print("[1/5] Fetching official Quick, Draw! categories index...")
    try:
        all_official_categories = fetch_categories_list()
        categories_file = os.path.join(output_dir, "categories.txt")
        with open(categories_file, "w", encoding="utf-8") as f:
            f.write("\n".join(all_official_categories) + "\n")
        print(f"  Discovered {len(all_official_categories)} total categories in official repository.")
    except Exception as e:
        print(f"  Warning: Failed to fetch categories list from GitHub: {e}")
        all_official_categories = []

    # 3. Validate requested classes against official list
    valid_classes = []
    for c in categories_to_download[:max_classes]:
        if all_official_categories and c not in all_official_categories:
            print(f"  Skipping '{c}': not found in official Quick, Draw! category list.")
        else:
            valid_classes.append(c)

    print(f"[2/5] Verified {len(valid_classes)} target classes.")

    # 4. Check existing files & remote sizes
    manifest_path = os.path.join(output_dir, "download_manifest.json")
    manifest = {
        "dataset": "Google Quick, Draw! numpy_bitmap",
        "classes": {},
        "total_files": 0,
        "total_bytes": 0,
        "total_samples": 0,
    }

    current_dataset_bytes = get_dir_size(output_dir)
    print(f"[3/5] Current dataset disk footprint: {current_dataset_bytes / 1e6:.1f} MB")

    classes_to_fetch = []
    estimated_new_bytes = 0

    for cat in valid_classes:
        npy_path = os.path.join(bitmap_dir, f"{cat}.npy")
        if os.path.exists(npy_path):
            is_valid, samples, err = validate_npy_file(npy_path)
            if is_valid:
                size = os.path.getsize(npy_path)
                sha = compute_sha256(npy_path)
                manifest["classes"][cat] = {
                    "filename": f"{cat}.npy",
                    "bytes": size,
                    "samples": samples,
                    "sha256": sha,
                    "status": "verified_existing",
                }
                print(f"  [OK] Existing valid file: {cat}.npy ({size / 1e6:.1f} MB, {samples:,} samples)")
                continue
            else:
                print(f"  Corrupted existing file {cat}.npy ({err}). Will re-download.")
                try:
                    os.remove(npy_path)
                except OSError:
                    pass

        remote_size = get_remote_file_size(cat)
        classes_to_fetch.append((cat, remote_size))
        estimated_new_bytes += remote_size

    projected_total = current_dataset_bytes + estimated_new_bytes
    print(f"[4/5] Projected download size: {estimated_new_bytes / 1e6:.1f} MB ({len(classes_to_fetch)} files to download)")
    print(f"  Total projected storage: {projected_total / 1e6:.1f} MB (Budget remaining: {(HARD_LIMIT_BYTES - projected_total) / 1e9:.2f} GB)")

    if projected_total > HARD_LIMIT_BYTES:
        raise RuntimeError(f"Storage limit exceeded! Projected {projected_total} > {HARD_LIMIT_BYTES}")

    # 5. Sequentially stream downloads
    print("[5/5] Downloading category files...")
    for idx, (cat, expected_size) in enumerate(classes_to_fetch, start=1):
        npy_path = os.path.join(bitmap_dir, f"{cat}.npy")
        current_used = get_dir_size(output_dir)
        remaining_budget = HARD_LIMIT_BYTES - current_used

        if remaining_budget <= 200_000_000:
            print(f"  Storage budget warning: Stopping download early to reserve safety margin.")
            break

        print(f"  [{idx}/{len(classes_to_fetch)}] Downloading {cat}.npy (approx {expected_size / 1e6:.1f} MB)...")
        success, downloaded_bytes, err = download_file_streaming(cat, npy_path, remaining_budget)

        if not success:
            print(f"    Failed to download {cat}: {err}")
            continue

        is_valid, samples, v_err = validate_npy_file(npy_path)
        if not is_valid:
            print(f"    Validation failed for {cat}: {v_err}. Removing.")
            if os.path.exists(npy_path):
                os.remove(npy_path)
            continue

        sha = compute_sha256(npy_path)
        manifest["classes"][cat] = {
            "filename": f"{cat}.npy",
            "bytes": downloaded_bytes,
            "samples": samples,
            "sha256": sha,
            "status": "downloaded_verified",
        }
        print(f"    [OK] Saved & validated: {cat}.npy ({downloaded_bytes / 1e6:.1f} MB, {samples:,} samples, SHA-256: {sha[:10]}...)")

    # Update summary totals
    total_samples = sum(item["samples"] for item in manifest["classes"].values())
    total_file_bytes = sum(item["bytes"] for item in manifest["classes"].values())
    manifest["total_files"] = len(manifest["classes"])
    manifest["total_bytes"] = total_file_bytes
    manifest["total_samples"] = total_samples
    manifest["total_disk_footprint_bytes"] = get_dir_size(output_dir)

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("=" * 65)
    print(" DOWNLOAD SUMMARY:")
    print(f" Classes ready: {manifest['total_files']}/{len(valid_classes)}")
    print(f" Total samples: {total_samples:,}")
    print(f" Total size: {manifest['total_bytes'] / 1e6:.1f} MB ({manifest['total_bytes'] / 1e9:.2f} GB)")
    print(f" Storage budget respected: {manifest['total_disk_footprint_bytes'] < HARD_LIMIT_BYTES}")
    print(f" Manifest saved: {manifest_path}")
    print("=" * 65)

    return manifest

if __name__ == "__main__":
    download_quickdraw_subset()
