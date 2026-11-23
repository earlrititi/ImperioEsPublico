"""Only the explicit synthetic localhost fixture; never signs into production."""
from pathlib import Path
import json, sys
from playwright.sync_api import sync_playwright

fixture=json.loads(Path('tmp/crm-browser-fixture.json').read_text())
assert fixture['synthetic_only'] and fixture['origin']=='http://127.0.0.1:25461'
out=Path(sys.argv[1] if len(sys.argv)>1 else 'tmp/crm-admin-visual');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True)
    context=browser.new_context()
    name,value=fixture['cookie'].split('=',1)
    context.add_cookies([{'name':name,'value':value,'url':fixture['origin']}])
    context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(fixture['origin']) else route.abort())
    page=context.new_page(); errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    for width in [1440,390]:
        page.set_viewport_size({'width':width,'height':1000})
        page.goto(fixture['origin']+'/admin/automatizaciones',wait_until='networkidle')
        page.get_by_role('heading',name='Rendimiento del CRM',exact=True).wait_for()
        page.get_by_text('Stripe · pedidos Live registrados',exact=True).wait_for()
        assert page.locator('body').evaluate('(el)=>el.scrollWidth')<=width
        button=page.get_by_role('button',name='Pausar todas las familias comerciales',exact=True)
        button.click()
        page.get_by_role('button',name='Retirar pausa comercial global',exact=True).wait_for()
        state=page.request.get(fixture['origin']+'/api/admin/crm').json()
        assert state['report']['policy']['paused'] is True
        page.get_by_role('button',name='Retirar pausa comercial global',exact=True).click()
        button.wait_for()
        page.screenshot(path=str(out/f'crm-admin-{width}.png'),full_page=True)
    assert not errors,errors
    browser.close()
print('PASS CRM admin desktop/mobile, no page overflow, real UI pause -> API -> local PostgreSQL -> refreshed UI; no external request.')
