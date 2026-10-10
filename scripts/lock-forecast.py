"""Fetch release metadata only; pin dependencies and hashes without downloading wheels."""
import json,urllib.request,concurrent.futures,pathlib
versions={'chronos-forecasting':'2.3.2','torch':'2.8.0','transformers':'4.57.1','accelerate':'1.11.0','numpy':'2.2.6','pandas':'2.3.3','einops':'0.8.1','safetensors':'0.6.2','huggingface-hub':'0.36.0','tokenizers':'0.22.1','filelock':'3.20.0','fsspec':'2025.9.0','packaging':'25.0','pyyaml':'6.0.3','regex':'2025.9.18','requests':'2.32.5','tqdm':'4.67.1','psutil':'7.1.0','sympy':'1.14.0','networkx':'3.5','jinja2':'3.1.6','typing-extensions':'4.15.0','setuptools':'80.9.0','python-dateutil':'2.9.0.post0','pytz':'2025.2','tzdata':'2025.2','six':'1.17.0','mpmath':'1.3.0','markupsafe':'3.0.3','charset-normalizer':'3.4.4','idna':'3.11','urllib3':'2.5.0','certifi':'2025.8.3','hf-xet':'1.1.10'}
def fetch(item):
 name,version=item
 with urllib.request.urlopen(f'https://pypi.org/pypi/{name}/{version}/json',timeout=40) as response:data=json.load(response)
 return name,version,data
results=list(concurrent.futures.ThreadPoolExecutor(max_workers=8).map(fetch,versions.items()))
lines=['# Metadata-verified package hashes. Runtime target: CPython 3.12 Apple Silicon macOS.']
for name,version,data in sorted(results):
 hashes=sorted(set(f['digests']['sha256'] for f in data['urls'] if f['filename'].endswith('.whl')))
 if not hashes:raise RuntimeError(f'No wheels: {name}')
 lines.append(f'{name}=={version} \\\n'+' \\\n'.join('    --hash=sha256:'+h for h in hashes))
 print(name,':',data['info'].get('requires_dist'))
pathlib.Path('electron/forecast/requirements.lock').write_text('\n'.join(lines)+'\n')
