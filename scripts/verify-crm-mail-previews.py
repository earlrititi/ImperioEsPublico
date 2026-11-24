"""Offline mail rendering at 390/600px with original local brand assets."""
from pathlib import Path
from urllib.parse import urlparse,unquote
import json,sys,mimetypes
from playwright.sync_api import sync_playwright
from PIL import Image,ImageOps,ImageDraw

catalog=Path(sys.argv[1]).resolve(); out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
public=Path('public').resolve(); data=json.loads((catalog/'catalog.json').read_text(encoding='utf-8'))
assert data['synthetic_only'] and data['network_forbidden']
results=[]; thumbs=[]; desktop_thumbs=[]
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    context=browser.new_context()
    def local_asset(route):
        url=urlparse(route.request.url)
        path=(public/unquote(url.path).lstrip('/')).resolve()
        if url.hostname=='imperioes.com' and public in path.parents and path.is_file():
            route.fulfill(path=str(path),content_type=mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
        else: route.abort()
    context.route('**/*',local_asset)
    page=context.new_page()
    for record in data['records']:
        for width in [390,600]:
            page.set_viewport_size({'width':width,'height':900})
            page.set_content((catalog/record['preview']).read_text(encoding='utf-8'),wait_until='networkidle')
            page.locator('img').evaluate_all('(images)=>Promise.all(images.map(image=>image.decode()))')
            assert page.locator('body').evaluate('(el)=>el.scrollWidth')<=width,record['id']
            assert page.locator('img').evaluate_all('(images)=>images.every(image=>image.complete&&image.naturalWidth>0)'),record['id']
            results.append({'id':record['id'],'width':width,'overflow':False,'images_loaded':True})
            if width==390 or record['id'].startswith('automation-') or 'merch_purchase' in record['id']:
                name=f'{record["id"]}-{width}.png'
                page.screenshot(path=str(out/name),full_page=True)
                if width==390:
                    img=Image.open(out/name).convert('RGB');img.thumbnail((190,650))
                    tile=Image.new('RGB',(210,690),'#eeeeee');tile.paste(img,((210-img.width)//2,28));ImageDraw.Draw(tile).text((8,8),record['id'][:31],fill='black')
                    thumbs.append(tile)
                else:
                    img=Image.open(out/name).convert('RGB');img.thumbnail((270,640))
                    tile=Image.new('RGB',(290,675),'#eeeeee');tile.paste(img,((290-img.width)//2,28))
                    ImageDraw.Draw(tile).text((6,6),record['id'][:40],fill='black');desktop_thumbs.append(tile)
    browser.close()
cols=7
for start in range(0,len(thumbs),21):
    batch=thumbs[start:start+21];sheet=Image.new('RGB',(cols*210,((len(batch)+cols-1)//cols)*690),'white')
    for index,tile in enumerate(batch):sheet.paste(tile,((index%cols)*210,(index//cols)*690))
    sheet.save(out/f'contact-sheet-{start//21+1}.jpg',quality=90)
for start in range(0,len(desktop_thumbs),7):
    batch=desktop_thumbs[start:start+7];sheet=Image.new('RGB',(7*290,675),'white')
    for index,tile in enumerate(batch):sheet.paste(tile,(index*290,0))
    sheet.save(out/f'desktop-contact-sheet-{start//7+1}.jpg',quality=93)
(out/'visual-checks.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(f'PASS {len(results)} offline layouts: no page overflow; original brand images loaded at 390/600px; no external network.')
