"""Reproducible vector A0 lifecycle and literal A4 catalogue; no service access.

Usage: python scripts/render-crm-review.py <catalog-dir> <output-dir>
Dependencies: reportlab, pymupdf. Input is exported by export-crm-mail-catalog.mjs.
"""
from pathlib import Path
import sys, json, math, html, hashlib, textwrap
import re
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pymupdf
from PIL import Image, ImageDraw

CAT = Path(sys.argv[1]); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
data = json.loads((CAT / 'catalog.json').read_text(encoding='utf-8'))
state_path = CAT/'production-state.json'
state = json.loads(state_path.read_text(encoding='utf-8-sig')) if state_path.exists() else {}
released = state.get('coordinator_active') is True and state.get('welcome_approved') is True
commercial_active = released and state.get('commercial_paused') is not True
fonts = Path('C:/Windows/Fonts')
pdfmetrics.registerFont(TTFont('Review', str(fonts / 'arial.ttf')))
pdfmetrics.registerFont(TTFont('ReviewBold', str(fonts / 'arialbd.ttf')))
pdfmetrics.registerFontFamily('Review', normal='Review', bold='ReviewBold')
PAPER = colors.HexColor('#faf7f0'); INK = colors.HexColor('#272b2c')
RED = colors.HexColor('#8b2431'); TEAL = colors.HexColor('#176e71')
GRAY = colors.HexColor('#647274'); GOLD = colors.HexColor('#af7d32')

def clean(value):
    return str(value).replace('\u2011', '-').replace('\u2013', '-').replace('\u2014', '-')

def para(c, value, x, y, width, size=15, leading=20, color=INK, bold=False):
    """Top-origin paragraph; returns lower y position in mm."""
    style = ParagraphStyle('card', fontName='ReviewBold' if bold else 'Review', fontSize=size,
                           leading=leading, textColor=color, spaceAfter=0, splitLongWords=True)
    p = Paragraph(clean(value), style)
    _, h = p.wrap(width * mm, 1000 * mm)
    p.drawOn(c, x * mm, (841 - y) * mm - h)
    return y + h / mm

def box(c, x, y, w, h, fill=PAPER, stroke=colors.HexColor('#d6d6ce'), radius=5):
    c.setFillColor(fill); c.setStrokeColor(stroke); c.setLineWidth(.75)
    c.roundRect(x*mm, (841-y-h)*mm, w*mm, h*mm, radius*mm, fill=1, stroke=1)

def arrow(c, points, color=colors.HexColor('#bdc6c4'), width=1.2, dash=None):
    c.setStrokeColor(color); c.setFillColor(color); c.setLineWidth(width)
    c.setDash(dash or [])
    p = c.beginPath(); p.moveTo(points[0][0]*mm, (841-points[0][1])*mm)
    for x,y in points[1:]: p.lineTo(x*mm,(841-y)*mm)
    c.drawPath(p); c.setDash([])
    (x0,y0),(x1,y1) = points[-2:]; a = math.atan2(y1-y0,x1-x0)
    tip = (x1*mm,(841-y1)*mm); length=8
    p=c.beginPath(); p.moveTo(*tip)
    for offset in [-.5,.5]: p.lineTo(tip[0]-length*math.cos(a+offset),tip[1]+length*math.sin(a+offset))
    p.close(); c.drawPath(p,fill=1,stroke=0)

def subjects(key):
    return [r for r in data['records'] if r['id'].startswith('automation-'+key+'-')]

def mail_lines(key):
    return '<br/>'.join(f'<b>+{r["afterHours"]} h</b> · «{html.escape(r["subject"])}»' for r in subjects(key))

def diagram():
    path = OUT/'IMPERIO_ES_CRM_ciclo_de_vida_A0.pdf'
    c = canvas.Canvas(str(path), pagesize=(1189*mm,841*mm), pageCompression=1)
    c.setTitle('Imperio Español | Arquitectura CRM de ciclo de vida')
    c.setAuthor('Imperio Español - revisión técnica')
    c.setFillColor(PAPER); c.rect(0,0,1189*mm,841*mm,fill=1,stroke=0)
    para(c, 'IMPERIO ESPAÑOL',18,16,1000,30,34,RED,True)
    para(c, 'Sistema de captación, conversión y fidelización por email',18,31,1000,24,29,INK,True)
    para(c, 'Revisión 23 noviembre 2026 · '+('Implementación publicada' if released else 'Arquitectura preparada en rama')+' · Aceptación del proveedor no equivale a entrega',18,47,1050,14,18,GRAY)
    status_line = ('PRODUCCIÓN: 49 cuentas verificadas incorporadas; bajas y rebotes actualizan su elegibilidad. 060-061 aplicadas. Activas: bienvenida, carrito y checkout; máximo 1/24 h y 3/7 días. Producto, visita y posventa apagados.' if released else 'PRODUCCIÓN: incorporación y flags deben comprobarse en un corte autorizado. Nueva coordinación, bienvenida ampliada y panel pendientes de autorización y publicación.')
    if released and not commercial_active:
        status_line = 'PRODUCCIÓN: implementación publicada y 060-061 aplicadas. Envío comercial temporalmente PAUSADO; bienvenida, carrito y checkout requieren reanudación. Bajas y rebotes actualizan elegibilidad.'
    para(c, status_line,18,61,1153,12,16,TEAL,True)
    coords = {
      'A':(18,78,275,153),'B':(310,78,275,153),'C':(602,78,275,153),'D':(894,78,277,153),
      'E':(18,253,275,153),'F':(18,428,275,153),
      'G':(18,622,275,168),'H':(310,622,275,168),'I':(602,622,275,168),'J':(894,622,277,168),
      'K':(894,428,277,153),'L':(894,253,277,153),
    }
    # Identity spokes are deliberately behind cards. Arrow direction means a rule decision,
    # not an assertion that every person should receive every communication.
    for key,(x,y,w,h) in coords.items():
        cx,cy=x+w/2,y+h/2
        if cy<240: endpoint=(cx,y+h); start=(max(354,min(835,cx)),276)
        elif cy>610: endpoint=(cx,y); start=(max(354,min(835,cx)),588)
        elif cx<300: endpoint=(x+w,cy); start=(327,cy)
        else: endpoint=(x,cy); start=(862,cy)
        arrow(c,[start,endpoint])
    # Actual lifecycle transitions with short paths through the open gutters.
    for a,b in [('A','B'),('B','C'),('C','D'),('G','H')]:
        ax,ay,aw,ah=coords[a]; bx,by,bw,bh=coords[b]
        arrow(c,[(ax+aw,ay+20),(bx,by+20)],TEAL,2)
    arrow(c,[(602,642),(585,642)],TEAL,2)  # Reservation -> confirmed purchase.
    arrow(c,[(447,622),(447,604),(884,604),(884,517),(894,517)],TEAL,1.8)  # Purchase -> shipping.
    arrow(c,[(1032,622),(1032,612),(520,612),(520,622)],TEAL,1.4)  # Plan -> customer.
    arrow(c,[(155,406),(155,428)],TEAL,2)  # Product -> cart.
    arrow(c,[(155,581),(155,622)],TEAL,2)  # Cart -> checkout.
    arrow(c,[(1032,428),(1032,406)],TEAL,2)
    arrow(c,[(1138,253),(1138,244),(1030,244),(1030,231)],GOLD,1.5,[4,3])
    headings = {
      'A':('VISITANTE ANÓNIMO','ACTUAL · Sin email automático',
       'Evento: home, archivo, ficha, carrito o checkout invitado.<br/><br/><b>Identidad:</b> sin dirección acreditada. CTAs hacia recurso, newsletter y compra voluntaria.<br/><b>Regla:</b> rechazar marketing no bloquea comprar. El carrito técnico no prueba consentimiento.<br/><br/><b>Salida:</b> captación B o compra H. El checkout de invitado no autoriza recuperación comercial.'),
      'B':('CAPTACIÓN Y VERIFICACIÓN','ACTUAL EN CÓDIGO · Confirmación según flags',
       'Evento: solicitud voluntaria, cuenta PIQUERO o casilla comercial opcional.<br/><br/><b>Servicio:</b> «Confirma tus comunicaciones de Imperio Español». Enlace <b>48 h</b>.<br/><b>Recurso:</b> «Tus 7 historias del Siglo de Oro» / «Tu manifiesto de Imperio Espanol».<br/><br/>Normalizar email, guardar prueba y finalidad. No reactivar retiradas ni convertir un recurso solicitado en autorización comercial.'),
      'C':('BIENVENIDA Y ACTIVACIÓN',('ACTIVA PARA CUENTAS ELEGIBLES' if commercial_active else 'PUBLICADA PERO PAUSADA' if released else 'ACTUAL EN CÓDIGO')+' · P5 comercial',
       mail_lines('welcome')+'<br/><br/>Historial por email normalizado: cuenta y contacto comparten secuencia. Recurso primero; no ráfagas atrasadas. Mantener editorial elegible tras compra; excluir oferta de camiseta o plan ya adquirido.'),
      'D':('INTERÉS EDITORIAL','ACTUAL + PROPUESTO · P6 / P8',
       '<b>Actual:</b> newsletters y contenido editorial elegido. Historial y permisos comerciales vigentes.<br/><br/><b>Recuperación genérica P8 (APAGADA):</b> '+mail_lines('site')+'<br/><br/><b>PROPUESTO:</b> intereses declarados, recomendaciones con evidencia suficiente y experimento de volumen reducido. No enviar por cada lectura. Una visita sin permiso analítico no activa conducta.'),
      'E':('INTERÉS EN CAMISETA','ACTUAL EN CÓDIGO · APAGADO · P4 comercial',
       mail_lines('viewed_product')+'<br/><br/>Evento: visita identificada a ficha sin avance posterior.<br/><b>Exige:</b> marketing + analítica vigentes; email verificado; sin carrito, checkout o pago posterior.<br/><b>Contenido:</b> ficha real, tallas, tejido y fotografía; precio y opciones de envío desde servidor. Sin stock o descuentos inventados.'),
      'F':('CARRITO ABANDONADO',('ACTIVO SI HAY INTENCIÓN NUEVA' if commercial_active else 'PUBLICADO PERO PAUSADO' if released else 'ACTUAL EN CÓDIGO')+' · P3 comercial',
       mail_lines('cart')+'<br/><br/>Evento identificado de carrito; estado técnico conservado en cookie. Comprobar precio y stock al volver.<br/><b>Cancelar:</b> vaciado registrado, checkout posterior, pago, retirada o supresión.<br/><b>Retorno:</b> /carrito; no garantiza sincronización entre dispositivos ni reserva unidades.'),
      'G':('CHECKOUT ABANDONADO',('ACTIVO SI HAY INTENCIÓN NUEVA' if commercial_active else 'PUBLICADO PERO PAUSADO' if released else 'ACTUAL EN CÓDIGO')+' · P2 comercial',
       mail_lines('checkout')+'<br/><br/><b>Antes de enviar:</b> intención nueva aprobada, marketing + analítica; Stripe y pedido actual sin pago ni procesamiento.<br/><b>Bloqueos:</b> discrepancia financiera, compra, retirada, lease perdido o mensaje obsoleto.<br/><b>PROPUESTO:</b> comparar +1 h frente a +2-4 h; control intacto, sin cobros ni reintentos de pago desde email.'),
      'H':('COMPRA CONFIRMADA','ACTUAL · P1 servicio',
       'Fuente de verdad: Stripe conciliado con pedido.<br/><br/>«Hemos recibido tu pago» / «Tu factura está pagada». Pedido: «Hemos recibido tu pedido» o asunto dinámico con referencia y estado.<br/><br/>Importes, IVA, tallas, cantidad, descuento y envío reales. Idempotencia por evento/operación; cancelar recuperaciones vinculadas.<br/><b>Distinciones:</b> pedido recibido, pago confirmado, preparación y envío son hechos diferentes. Reembolso no prueba entrega.'),
      'I':('RESERVAS Y LISTA DE ESPERA','ACTUAL · P1 servicio',
       'Eventos: WAITLIST, RESERVED, PURCHASE_AVAILABLE, PAYMENT_PENDING, PAID, CANCELLED y EXPIRED.<br/><br/>«Tu camiseta Imperio E está reservada». Resto: «Reserva {referencia}: {estado}» / «Pedido {referencia}: {estado}».<br/><br/>Reserva gratuita sin cargo. No prometer stock en lista de espera. Invitación solo con estado actual compatible y enlace privado válido. Una compra o cancelación invalida la invitación atrasada.'),
      'J':('SUSCRIPCIONES Y PLANES','ACTUAL · P1 servicio',
       '«Tu cuenta PIQUERO esta activa». «Tu suscripcion {PLAN} esta activa». «Tu {15/20}% para la Camiseta Imperial».<br/><br/>Stripe: renovación, fallo, confirmación requerida, cancelación prevista/final y reembolso, según estado actual.<br/><br/>No activar un plan sin pago confirmado. Ventajas reales y periodicidad explícita. 15 % / 20 % según plan elegible; el descuento no reduce envío. Separar facturación de carrito físico.'),
      'K':('ENVÍO Y RECEPCIÓN','WORKER POSVENTA APAGADO · P1 servicio',
       'Eventos: preparación, expedición, entrega logística, recepción, incidencia o devolución.<br/><br/>«¿Te ha llegado la camiseta correctamente?»<br/><b>+48 h</b> desde entrega del transportista verificada (configurable).<br/><br/>Confirmación por enlace seguro; recepción del cliente separada de logística. Envíos parciales por paquete; declaración del vendedor no prueba entrega. No activar el worker si el flag sigue apagado.'),
      'L':('FIDELIZACIÓN Y RECOMPRA','ACTUAL EN CÓDIGO · APAGADO / PROPUESTO · P7',
       '«Gracias por compartir nuestra historia».<br/><b>+72 h</b> desde recepción confirmada (configurable).<br/><br/>Exige permiso comercial y ausencia de incidencia, disputa, devolución o reembolso. Reseña voluntaria; publicar imagen, nombre o testimonio exige autorización independiente.<br/><br/><b>PROPUESTO:</b> recomendaciones y recompra con productos reales. Sin nuevos descuentos ni activación retrospectiva.'),
    }
    for key,(title,status,body) in headings.items():
        x,y,w,h=coords[key]; box(c,x,y,w,h,colors.white)
        c.setFillColor(RED); c.roundRect((x+7)*mm,(841-y-19)*mm,12*mm,12*mm,3*mm,fill=1,stroke=0)
        para(c,key,x+10,y+8,10,21,23,colors.white,True)
        para(c,title,x+25,y+8,w-32,20,24,INK,True)
        para(c,status,x+9,y+27,w-18,12.5,16,TEAL,True)
        end=para(c,body,x+9,y+40,w-18,14,19)
        if end>y+h-6: raise ValueError(f'Card {key} overflow {end} > {y+h-6}')
    box(c,327,260,535,337,colors.HexColor('#edf2ef'),colors.HexColor('#bacac4'),8)
    para(c,'USUARIO / CONTACTO',342,273,505,30,36,RED,True)
    para(c,'ANÓNIMO → IDENTIFICADO → VERIFICADO → CLIENTE / SUSCRIPTOR',342,292,505,16,21,INK,True)
    yy=para(c,'Email normalizado + prueba de consentimiento + estados actuales de compra, cuenta y entrega',342,307,505,15,21,GRAY)
    yy=para(c,'DECISIÓN ANTES DE CADA ENVÍO',342,yy+7,505,18,23,TEAL,True)
    rules=[
      '<b>1. Servicio y seguridad:</b> P1, fuera de topes promocionales. Estado contractual y destinatario válidos.',
      '<b>2. Elegibilidad comercial:</b> permiso y verificación actuales; sin baja, rebote permanente o spam. Analítica adicional solo para conducta.',
      '<b>3. Prioridad:</b> checkout P2 > carrito P3 > producto P4 > bienvenida P5 > editorial P6 > fidelización P7 > visita P8.',
      ('<b>4. Coordinación publicada:</b> reserva por email, lease vigente, prioridad entre colas e historial compartido. Solo las familias aprobadas pueden enviar.' if released else '<b>4. Coordinación preparada en rama:</b> reserva por email, lease vigente, prioridad entre colas e historial compartido; no se presupone desplegada.'),
      '<b>5. Cadencia '+('aplicada' if released else 'preparada')+':</b> máximo 1 / 24 h y 3 / 7 días, configurable. PROPUESTO: 09:00-20:00 cuando exista zona horaria acreditada; nunca inferirla por idioma.',
      '<b>6. Pago o cambio de permiso:</b> invalidar recuperación y comprobar hechos otra vez inmediatamente antes del proveedor. Una llamada HTTP no es atómica con SQL.',
      '<b>7. Proveedor:</b> clave estable + snapshot; aceptación ≠ entrega. Resultado incierto conserva reserva y requiere reintento acotado/revisión.',
    ]
    for item in rules: yy=para(c,item,342,yy+4,505,14.5,20)
    yy=para(c,'RECORRIDOS Y RETORNOS',342,yy+8,505,17,22,TEAL,True)
    yy=para(c,'Captación B → bienvenida C → interés D/E → carrito F → checkout G → compra H.<br/>Reserva I → compra H. Plan J ↔ cliente H. Compra H → entrega K → fidelización L → interés D/E.<br/>Baja / rebote / queja → supresión comercial. Incidencia / devolución → pausa de fidelización.',342,yy+3,505,14.5,20)
    yy=para(c,'MEDICIÓN Y CONTROL',342,yy+7,505,17,22,TEAL,True)
    yy=para(c,'Stripe/pedidos: dinero confirmado, reembolsos y recompra. GA4: conducta consentida, fuente separada. UTMs no prueban ventas. Sin clic verificable no declarar atribución; sin costes no declarar margen.<br/>Pausa reversible, aprobación de plantillas/audiencia y límites antes de desplegar. Experimentos propuestos: sin ganador con muestra insuficiente.',342,yy+3,505,14,19)
    if yy>586: raise ValueError(f'Center overflow: {yy}')
    para(c,'ACTUAL = existe en código · PROPUESTO = requiere validación / trabajo adicional · NO VERIFICADO = no acredita activación real de producción',18,804,1153,13,18,GRAY,True)
    para(c,'Líneas grises: decisiones por identidad. Flechas verdes: avances entre etapas. Flecha discontinua: retorno a interés. Los cuerpos literales y hashes están en el anexo independiente.',18,816,1153,12,17,GRAY)
    if released:
        para(c,'Código '+data['git_commit'][:7]+' · Producción '+state.get('production_commit','')[:7]+' · Activación '+state.get('activated_at','NO VERIFICADA')+' · Sin métricas volátiles de envío en este plano.',18,828,1153,10,13,GRAY)
    c.showPage(); c.save(); return path

def appendix():
    path=OUT/'IMPERIO_ES_CRM_catalogo_literal_A4.pdf'
    styles=getSampleStyleSheet()
    for style in styles.byName.values(): style.fontName='Review'
    styles.add(ParagraphStyle('TitleReview',fontName='ReviewBold',fontSize=22,leading=27,textColor=RED,spaceAfter=20))
    styles.add(ParagraphStyle('MailTitle',fontName='ReviewBold',fontSize=16,leading=21,textColor=RED,spaceAfter=12))
    styles.add(ParagraphStyle('MetaReview',fontName='Review',fontSize=8.5,leading=12,textColor=GRAY,spaceAfter=6,splitLongWords=True))
    styles.add(ParagraphStyle('BodyReview',fontName='Review',fontSize=10.2,leading=14.4,textColor=INK,spaceAfter=10,splitLongWords=True))
    doc=SimpleDocTemplate(str(path),pagesize=A4,rightMargin=19*mm,leftMargin=19*mm,topMargin=21*mm,bottomMargin=19*mm,
                          title='Imperio Español | Catálogo literal de comunicaciones',author='Imperio Español - revisión técnica')
    story=[]
    # Literal message copy takes precedence over typographic normalization.
    def p(value,style='BodyReview',literal=False): return Paragraph(html.escape(str(value) if literal else clean(value)).replace('\n','<br/>'),styles[style])
    story += [p('IMPERIO ESPAÑOL\nCatálogo literal de comunicaciones','TitleReview'),p('Revisión del 23 de noviembre de 2026. Generación local con ejemplos sintéticos; el catálogo no realiza envíos.'),
      p(f'{len(data["records"])} variantes renderizadas desde funciones reales. Las doce automatizaciones conservan su cuerpo literal con {{{{nombre}}}}; la vista HTML aplica un nombre ficticio. Los mensajes dinámicos muestran valores ficticios y no sustituyen la comprobación del estado actual.'),
      p('ACTUAL EN CÓDIGO no acredita por sí solo producción activa. A petición expresa del titular se incorporaron 49 cuentas verificadas; 46 se regularizaron como declaración histórica del titular, sin fabricar fecha de aceptación individual ni levantar bajas. Bajas, rebotes y reclamaciones actualizan la elegibilidad después de la incorporación. '+('060-061 están aplicadas; coordinación y bienvenida/carrito/checkout publicadas y aprobadas, 1/24 h y 3/7 días. Producto, visita, bienvenida central de contactos y posventa permanecen apagados.' if released else 'La coordinación y bienvenida ampliada requieren autorización de 060-061 y publicación.')+' Los experimentos no están activados. No se modificaron secretos.'),
      *([p('PAUSA TEMPORAL: el envío comercial se encuentra detenido en el corte del manifiesto. La publicación de código y su aprobación no equivalen a una reanudación.')] if released and not commercial_active else []),
      p('Los valores de precio y los estados de este documento son ejemplos cuando así se indica. El envío real toma los hechos del pedido, la configuración vigente y Stripe. Las URLs con FIXTURE son muestras sin validez.'),
      p(f'Render corporativo: {data["corporate_brand"]}; marcador compatible {data["corporate_layout"]}. Solo logos oficiales PNG del proyecto. HTMLs reproducibles en el catálogo adjunto.'),
      p('La referencia PDF original nombrada en el prompt no estaba disponible. El diagrama se reconstruye a partir de la arquitectura y los asuntos reales del código, con estados propuestos identificados.'),
      p('Fuentes y repetición','Heading2'),p('node --import tsx scripts/export-crm-mail-catalog.mjs <directorio>\npython scripts/render-crm-review.py <directorio> <salida>\npython scripts/verify-crm-mail-previews.py <directorio> <salida-png>'),
      p('El SHA-256 identifica el archivo fuente y el payload renderizado de cada ejemplo. No es el digest de aprobación activo de Supabase. Cambiar una plantilla obliga a regenerar catálogo y pruebas; no concede autorización de envío.'),
      p('Fuente de código: '+data['git_commit']+'\nPublicación: '+state.get('production_commit','NO VERIFICADA')+'\nActivación: '+state.get('activated_at','NO VERIFICADA')+'\nScope: '+state.get('scope','NO VERIFICADO'),'MetaReview'),PageBreak()]
    for n,r in enumerate(data['records'],1):
      story += [p(f'{n:02d}. {r["subject"]}','MailTitle'),
        p(f'{r["id"]} | {r["family"]} | {r["status"]}','MetaReview'),
        p('Disparador: '+r['trigger'],'MetaReview'),p('Elegibilidad: '+r['segment'],'MetaReview'),
        p('Preheader: '+(r.get('preheader') or '(vacío en la plantilla)'),'MetaReview'),
        p('Versión: '+r['version']+' | Fuente: '+r['source'],'MetaReview'),
        p('SHA-256 fuente: '+r['source_sha256']+'\nSHA-256 renderizado: '+r['rendered_sha256'],'MetaReview'),
        Spacer(1,5*mm),p('Cuerpo literal' if r['id'].startswith('automation-') else 'Cuerpo renderizado con datos ficticios','Heading3'),
        p(r['content'] if r['id'].startswith('automation-') else r['text'],literal=True)]
      if r.get('cta_label'): story += [p('CTA principal: '+r['cta_label']+'\nDestino: '+r['cta_url'],'MetaReview')]
      else:
        relevant=[l for l in r['links'] if l['label'] and l['label'] not in ['Instagram','Facebook','X','imperioes.com','contacto@imperioes.com']]
        if relevant: story += [p('Enlaces renderizados:\n'+'\n'.join(l['label']+' - '+l['url'] for l in relevant),'MetaReview')]
      if r.get('sample'): story += [p(r['sample'],'MetaReview')]
      if r.get('idempotency'): story += [p('Clave lógica (ejemplo): '+r['idempotency'],'MetaReview')]
      if n<len(data['records']): story += [PageBreak()]
    def footer(c,doc):
      c.saveState(); c.setStrokeColor(colors.HexColor('#d7d7cd')); c.line(19*mm,15*mm,191*mm,15*mm)
      c.setFont('Review',8); c.setFillColor(GRAY); c.drawString(19*mm,10*mm,'IMPERIO ESPAÑOL · Catálogo sintético · Revisión sin envío')
      c.drawRightString(191*mm,10*mm,str(doc.page)); c.restoreState()
    doc.build(story,onFirstPage=footer,onLaterPages=footer); return path

paths=[diagram(),appendix()]
render=OUT/'rendered'; render.mkdir(exist_ok=True)
checks=[]
for path in paths:
    doc=pymupdf.open(path)
    thumbs=[]
    for i,page in enumerate(doc):
        factor=.65 if path==paths[0] else 1.25
        pix=page.get_pixmap(matrix=pymupdf.Matrix(factor,factor),alpha=False)
        pix.save(render/f'{path.stem}-{i+1:03d}.png')
        if path==paths[1]:
            image=Image.open(render/f'{path.stem}-{i+1:03d}.png').convert('RGB')
            image.thumbnail((230,330))
            tile=Image.new('RGB',(250,360),'#e9e9e3');tile.paste(image,((250-image.width)//2,23))
            ImageDraw.Draw(tile).text((8,5),f'Página {i+1}',fill='black');thumbs.append(tile)
    for start in range(0,len(thumbs),24):
        batch=thumbs[start:start+24];sheet=Image.new('RGB',(1500,math.ceil(len(batch)/6)*360),'white')
        for i,tile in enumerate(batch):sheet.paste(tile,((i%6)*250,(i//6)*360))
        sheet.save(render/f'{path.stem}-contact-sheet-{start//24+1}.jpg',quality=94)
    checks.append({'file':str(path),'pages':len(doc),'page_mm':[round(doc[0].rect.width/mm,1),round(doc[0].rect.height/mm,1)],'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(OUT/'pdf-verification.json').write_text(json.dumps(checks,indent=2),encoding='utf-8')
diagram_doc=pymupdf.open(paths[0]); annex_doc=pymupdf.open(paths[1])
assert len(diagram_doc)==1 and len(annex_doc)==len(data['records'])+1
assert not diagram_doc[0].get_images() and len(diagram_doc[0].get_drawings())>50
normalized=lambda value: re.sub(r'\s+','',value).replace('\u00ad','')
for n,record in enumerate(data['records'],1):
    page=annex_doc[n]; literal=record['content'] if record['id'].startswith('automation-') else record['text']
    assert normalized(literal) in normalized(page.get_text()),'Literal body mismatch: '+record['id']
    assert normalized(record['subject']) in normalized(page.get_text()),'Subject mismatch: '+record['id']
    for block in page.get_text('blocks'):
        assert block[0]>=40 and block[2]<page.rect.width-40 and block[1]>=35 and block[3]<page.rect.height-20,(n,block[:4])
    assert '\ufffd' not in page.get_text()
print(json.dumps(checks))
print(f'PASS {len(data["records"])} complete literal bodies, subjects and page bounds; one vector A0; {len(annex_doc)} A4 pages.')
