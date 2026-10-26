import json,base64,os
src=open('v3.py').read()
CSS=src.split("CSS='''")[1].split("'''")[0]
b64=lambda p:base64.b64encode(open(p,'rb').read()).decode()
icons=json.load(open('proto/icons.json'))
dv=json.load(open('proto/dv.json')) if os.path.exists('proto/dv.json') else {}
js=open('proto/app.js').read()
head="const ICONS="+json.dumps(icons)+";const LOGO_DARK='data:image/png;base64,"+b64('fl-dark.png')+"';const LOGO_WHITE='data:image/png;base64,"+b64('fl-white.png')+"';const DV="+json.dumps(dv,ensure_ascii=False)+";"
fav=b64('/home/user/oceanx-pos/docs/marketing/fuel-demo/logo/icons/theyofihaara-icon-black-64.png')
html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Theyo Fihaara demo</title><link rel="icon" href="data:image/png;base64,'+fav+'"><style>@font-face{font-family:Faruma;src:url(data:font/woff2;base64,'+b64('Faruma.woff2')+')}'+CSS+open('proto/extra.css').read()+'</style></head><body><div id="app"></div><div id="toast"></div><script>'+head+'\n'+js+'</script></body></html>'
open('proto/theyo-fihaara-demo.html','w').write(html)
print(len(html)//1024,'KB')
