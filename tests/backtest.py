"""Chronological synthetic evaluation. Future observations never enter context."""
import json,datetime,pathlib,subprocess,math
root=pathlib.Path(__file__).resolve().parents[1]
proc=subprocess.Popen([str(root/'.venv-forecast/bin/python'),'-u',str(root/'electron/forecast/worker.py'),str(root/'.forecast-test/model')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
# Variable residual cashflows; deterministic schedules are tested in the ledger suite.
inflow=[1500 if i%7==0 else (i%5)*8 for i in range(450)]
outflow=[350+(i%11)*15+(80 if i%7==5 else 0) for i in range(450)]
reports=[]
try:
 for cutoff,horizon in [(180,30),(240,90),(270,180)]:
  start=cutoff-180;dates=[str(datetime.date(2025,1,1)+datetime.timedelta(days=i)) for i in range(start,cutoff)]
  payload={'action':'forecast','requestId':f'backtest-{cutoff}','horizon':horizon,'accounts':[{'accountId':1,'dates':dates,'inflow':inflow[start:cutoff],'outflow':outflow[start:cutoff]}]}
  assert max(dates)<str(datetime.date(2025,1,1)+datetime.timedelta(days=cutoff))
  proc.stdin.write(json.dumps(payload)+'\n');proc.stdin.flush();response=json.loads(proc.stdout.readline());assert 'error' not in response,response
  predicted=response['result'][0];report={'context_days':180,'cutoff_index':cutoff,'horizon':horizon,'fixture':'synthetic periodic residual flows','model':'amazon/chronos-2'}
  for name,truth in [('inflow',inflow),('outflow',outflow)]:
   actual=truth[cutoff:cutoff+horizon];values=predicted[name]
   report[name+'_mae_minor']=sum(abs(v['0.5']-y) for v,y in zip(values,actual))/horizon
   report[name+'_interval_coverage']=sum(v['0.1']<=y<=v['0.9'] for v,y in zip(values,actual))/horizon
  cumulative_pred=cumulative_actual=0;errors=[]
  for i in range(horizon):
   cumulative_pred+=predicted['inflow'][i]['0.5']-predicted['outflow'][i]['0.5'];cumulative_actual+=inflow[cutoff+i]-outflow[cutoff+i];errors.append(abs(cumulative_pred-cumulative_actual))
  report['cumulative_cashflow_mae_minor']=sum(errors)/horizon;report['final_balance_error_minor']=errors[-1];reports.append(report)
 print(json.dumps(reports,indent=2));(root/'tests/backtest-results.json').write_text(json.dumps(reports,indent=2)+'\n')
finally:
 proc.terminate();proc.wait(timeout=10)
