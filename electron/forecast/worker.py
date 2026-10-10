"""Local-only Chronos-2 inference. Stdout is JSON protocol only."""
import os,sys,json,contextlib,math
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',TOKENIZERS_PARALLELISM='false')
pipeline=None

def forecast(request):
    global pipeline
    with contextlib.redirect_stdout(sys.stderr):
        import torch,pandas as pd
        from chronos import Chronos2Pipeline
        torch.set_num_threads(min(4,os.cpu_count() or 1))
        if pipeline is None:
            pipeline=Chronos2Pipeline.from_pretrained(sys.argv[1],device_map='cpu',local_files_only=True,torch_dtype=torch.float32)
        result=[]
        for account in request['accounts']:
            rows=[]
            for direction in ['inflow','outflow']:
                rows.extend({'item_id':direction,'timestamp':date,'target':value} for date,value in zip(account['dates'],account[direction]))
            frame=pd.DataFrame(rows);frame['timestamp']=pd.to_datetime(frame['timestamp'])
            predicted=pipeline.predict_df(frame,prediction_length=request['horizon'],quantile_levels=[0.1,0.5,0.9],id_column='item_id',timestamp_column='timestamp',target='target',cross_learning=False)
            directions={}
            for direction in ['inflow','outflow']:
                values=predicted[predicted['item_id']==direction].sort_values('timestamp')
                directions[direction]=[{str(q):max(0,float(row[str(q)])) for q in [0.1,0.5,0.9]} for _,row in values.iterrows()]
                if len(directions[direction])!=request['horizon'] or any(not math.isfinite(v) for day in directions[direction] for v in day.values()):
                    raise ValueError('Invalid model output')
            result.append({'accountId':account['accountId'],**directions})
        return result

for line in sys.stdin:
    request={}
    try:
        request=json.loads(line)
        if request.get('action')=='hello': result={'ready':True,'model':'amazon/chronos-2'}
        elif request.get('action')=='forecast': result=forecast(request)
        else: raise ValueError('Unsupported worker action')
        print(json.dumps({'requestId':request['requestId'],'result':result},allow_nan=False),flush=True)
    except Exception as error:
        print(json.dumps({'requestId':request.get('requestId'),'error':str(error)}),flush=True)
