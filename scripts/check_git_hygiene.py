#!/usr/bin/env python3
"""Reject private files and common credentials in tracked text; never echo values."""
import re
import subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
files=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
errors=[]
secret_patterns=[re.compile(r'sbp_[A-Za-z0-9]{30,}'),re.compile(r'AIza[A-Za-z0-9_-]{30,}'),re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),re.compile(r'gh[pousr]_[A-Za-z0-9]{30,}')]
for name in filter(None,files):
 p=root/name
 if not p.is_file(): continue
 parts=Path(name).parts
 if any(x in parts for x in ['node_modules','dist','.local','.temp','.wrangler']) or (p.name.startswith('.env') and not p.name.endswith('.example')) or p.name.endswith(('.local','.pem','.key')):
  errors.append(f'Private/generated file tracked: {name}');continue
 if p.stat().st_size>8_000_000:
  errors.append(f'Unexpected large file: {name}');continue
 try:s=p.read_text()
 except (UnicodeDecodeError,ValueError):continue
 if any(pattern.search(s) for pattern in secret_patterns):errors.append(f'Possible credential in {name}')
 # Service role JWTs are secrets; publishable/anon keys are not.
 import base64,json
 for candidate in re.findall(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',s):
  try:
   payload=candidate.split('.')[1];role=json.loads(base64.urlsafe_b64decode(payload+'='*((-len(payload))%4))).get('role')
   if role=='service_role':errors.append(f'Service-role credential in {name}')
  except Exception:pass
if errors:
 print('\n'.join(sorted(set(errors))));raise SystemExit(1)
print('OK: tracked files contain no detected private files or common credentials. This is a guard, not a complete secret scan.')
