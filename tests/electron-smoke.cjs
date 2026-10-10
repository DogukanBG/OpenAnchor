const {app,BrowserWindow}=require('electron'),fs=require('fs'),path=require('path')
process.env.OPENANCHOR_TEST_DATA=fs.mkdtempSync('/private/tmp/openanchor-ui-');require('../electron/main')
app.whenReady().then(()=>require('./smoke-checks.cjs')({app,window:BrowserWindow.getAllWindows()[0],root:path.resolve(__dirname,'..')}))
