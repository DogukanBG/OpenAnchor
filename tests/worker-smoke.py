import subprocess,json,datetime,pathlib,hashlib,sys
root=pathlib.Path(__file__).resolve().parents[1];manifest=json.loads((root/'electron/forecast/manifest.json').read_text())
for file in manifest['model']['files']:
 assert hashlib.sha256((root/'.forecast-test/model'/file['name']).read_bytes()).hexdigest()==file['sha256']
dates=[str(datetime.date(2026,1,1)+datetime.timedelta(days=i)) for i in range(180)]
horizon=int(sys.argv[1]) if len(sys.argv)>1 else 30
request={'requestId':'synthetic-smoke','action':'forecast','horizon':horizon,'accounts':[{'accountId':1,'dates':dates,'inflow':[100 if i%7==0 else 0 for i in range(180)],'outflow':[40+i%11 for i in range(180)]}]}
result=subprocess.run([str(root/'.venv-forecast/bin/python'),str(root/'electron/forecast/worker.py'),str(root/'.forecast-test/model')],input=json.dumps(request)+'\n',text=True,capture_output=True,timeout=120)
print(result.stderr[-1000:]);assert result.returncode==0
response=json.loads(result.stdout);assert 'error' not in response,response
assert len(response['result'][0]['outflow'])==horizon
print(f'Pinned Chronos-2 CPU/offline worker smoke passed: {horizon} days')
