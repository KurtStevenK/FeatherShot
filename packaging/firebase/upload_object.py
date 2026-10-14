#!/usr/bin/env python3
"""Upload one object to Firebase/GCS using the Firebase CLI OAuth token."""
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

local = Path(sys.argv[1])
object_path = sys.argv[2]
bucket = sys.argv[3]
cfg_path = os.path.expanduser("~/.config/configstore/firebase-tools.json")
cfg = json.loads(Path(cfg_path).read_text())
token = cfg["tokens"]["access_token"]
name = urllib.parse.quote(object_path, safe="")
url = f"https://storage.googleapis.com/upload/storage/v1/b/{bucket}/o?uploadType=media&name={name}"
data = local.read_bytes()
req = urllib.request.Request(
    url,
    data=data,
    method="POST",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/octet-stream",
    },
)
with urllib.request.urlopen(req, timeout=3600) as resp:
    resp.read()
