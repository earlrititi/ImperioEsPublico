# Publicacion en Vercel y ramas de GitHub

Estado revisado el 28 de septiembre de 2026.

## 1. Como esta conectado el proyecto

La carpeta local tiene dos remotos de Git:

| Nombre local | Repositorio | Estado actual |
| --- | --- | --- |
| `deploy` | `https://github.com/earlrititi/ImperioEsPublico.git` | Es el repositorio conectado a Vercel. |
| `origin` | `https://github.com/earlrititi-lang/Imperio_web.git` | GitHub responde `Repository not found`; no debe usarse hasta reparar el acceso o la URL. |

Vercel tiene enlazado el proyecto `imperio-espa-ol-deploy` con:

- repositorio: `earlrititi/ImperioEsPublico`;
- rama de produccion: `main`;
- framework: Astro;
- version de Node en Vercel: `24.x`;
- dominios de produccion: `imperioes.com` y `www.imperioes.com`.

El flujo automatico es:

```text
rama de GitHub distinta de main
        |
        v
Vercel crea una Preview
        |
        v
merge o push a deploy/main
        |
        v
Vercel crea una Production y asigna imperioes.com
```

La rama local activa es:

```text
feature/subscriptions-stripe-supabase-resend
```

Aunque se llama `feature/...`, actualmente esta configurada para seguir
`deploy/main`. La rama local `main` sigue `origin/main`, que esta 95 commits por
detras del codigo usado en produccion y cuyo repositorio no es accesible ahora.
Por eso no se debe ejecutar `git push origin main` ni usar la rama local `main`
como referencia de produccion sin corregir antes la configuracion.

## 2. GitHub Pages no publica imperioes.com

Existe `.github/workflows/deploy.yml`. Ese workflow se ejecuta al actualizar
`main`, pero despliega en GitHub Pages mediante `actions/deploy-pages`.

Es un sistema diferente de Vercel:

- GitHub Pages no controla `imperioes.com` en la configuracion actual.
- Vercel esta conectado directamente a `earlrititi/ImperioEsPublico`.
- Al hacer merge en `deploy/main` pueden arrancar tanto Vercel como el workflow
  de GitHub Pages.
- Si GitHub Pages no se utiliza, conviene retirar ese workflow en una tarea
  separada para evitar despliegues duplicados y confusiones.

## 3. Dos formas de publicar

### Opcion A: publicar mediante GitHub, recomendada para trabajo normal

Este flujo conserva historial, permite revisar el cambio y mantiene GitHub y
produccion sincronizados.

```powershell
Set-Location "C:\Users\lorit\Imperio E"
git fetch deploy
git switch -c cambio/nombre-breve deploy/main

# Editar y comprobar el proyecto.
npm run check
npm test

git status --short
git add <archivos-revisados>
git commit -m "Descripcion breve del cambio"
git push -u deploy HEAD
```

Ese ultimo comando crea una rama del mismo nombre en
`earlrititi/ImperioEsPublico`. Vercel deberia generar una Preview. Despues se
abre una Pull Request en GitHub contra `main`. Al fusionarla, Vercel publica la
nueva version en produccion.

No se recomienda usar `git add .` sin revisar antes `git status`, porque el
directorio puede contener cambios de varias tareas.

### Opcion B: publicar directamente con Vercel CLI

Este es el procedimiento utilizado cuando hay que publicar exactamente el
estado actual de la carpeta, incluidos archivos modificados que aun no tienen
commit. No actualiza GitHub: produccion puede quedar por delante del repositorio
hasta que esos cambios se confirmen y se suban.

En este proyecto el artefacto se copia a una carpeta temporal externa porque el
despliegue directo desde el repositorio ha mostrado estados `BLOCKED` o
`UNKNOWN`. La carpeta externa solo contiene el resultado compilado y el enlace
al proyecto de Vercel.

## 4. Comandos corregidos para publicar con Vercel CLI

Abre PowerShell y ejecuta cada bloque por separado. No continues si aparece un
error.

### Paso 1. Entrar en el proyecto y detener el servidor local

```powershell
Set-Location "C:\Users\lorit\Imperio E"
node node_modules/astro/bin/astro.mjs dev stop
```

Si responde que no hay ningun servidor activo, se puede continuar.

### Paso 2. Revisar y validar

```powershell
git status --short
npm run check
if ($LASTEXITCODE -ne 0) { throw "Astro check ha fallado" }

npm test
if ($LASTEXITCODE -ne 0) { throw "Las pruebas han fallado" }
```

Se usan `check` y `test` en vez de `npm run verify` porque `verify` tambien hace
un build normal. Vercel volvera a compilar inmediatamente con la configuracion
de produccion, por lo que ese primer build seria redundante.

### Paso 3. Confirmar la sesion y descargar la configuracion

```powershell
npx vercel whoami
npx vercel pull --yes --environment=production
```

Si `whoami` responde `Not authorized`, ejecuta:

```powershell
npx vercel login
```

Tener una sesion iniciada en vercel.com no inicia automaticamente la sesion de
la terminal. `vercel login` muestra un enlace y un codigo para autorizarla.

`vercel pull` actualiza `.vercel/project.json` y la configuracion local de
produccion. El archivo `project.json` indica a la CLI que esta carpeta pertenece
al proyecto `imperio-espa-ol-deploy`.

### Paso 4. Crear el artefacto de produccion

```powershell
npx vercel build --prod --yes
if ($LASTEXITCODE -ne 0) { throw "La compilacion de Vercel ha fallado" }
```

El resultado se guarda en `.vercel\output`. Todavia no se ha publicado nada.

### Paso 5. Copiar correctamente el artefacto fuera del repositorio

```powershell
$deployDir = Join-Path $env:TEMP ("imperio-deploy-" + [guid]::NewGuid().ToString("N"))
$vercelDir = Join-Path $deployDir ".vercel"

New-Item -ItemType Directory -Path $vercelDir -Force | Out-Null
Copy-Item -LiteralPath ".vercel\output" -Destination (Join-Path $vercelDir "output") -Recurse -Force
Copy-Item -LiteralPath ".vercel\project.json" -Destination (Join-Path $vercelDir "project.json") -Force

$deployDir
```

La estructura correcta debe ser:

```text
%TEMP%\imperio-deploy-<identificador>\
└── .vercel\
    ├── output\
    └── project.json
```

### Paso 6. Publicar el artefacto

```powershell
Push-Location $deployDir
try {
    npx vercel deploy --prebuilt --prod --yes
    if ($LASTEXITCODE -ne 0) { throw "El despliegue ha fallado" }
}
finally {
    Pop-Location
}
```

`--prebuilt` obliga a utilizar el artefacto ya generado. `--prod` lo publica en
produccion. El comando debe terminar con `readyState: READY` o mostrar
`Aliased https://imperioes.com`.

Copia la URL concreta del deployment que aparece en la salida, por ejemplo:

```text
https://imperio-espa-ol-deploy-xxxxxxxxx-earlrititi-2806s-projects.vercel.app
```

### Paso 7. Verificar la publicacion

Sustituye la URL de ejemplo por la que haya devuelto el despliegue:

```powershell
$deploymentUrl = "https://imperio-espa-ol-deploy-xxxxxxxxx-earlrititi-2806s-projects.vercel.app"

npx vercel inspect $deploymentUrl

(Invoke-WebRequest -Uri "https://imperioes.com" -UseBasicParsing).StatusCode
(Invoke-WebRequest -Uri "https://www.imperioes.com" -UseBasicParsing).StatusCode

npx vercel logs $deploymentUrl --level error --since 10m
```

El resultado esperado es:

- `inspect`: estado `Ready`;
- ambos dominios: codigo HTTP `200`;
- logs: sin errores relacionados con el cambio;
- comprobacion visual de las paginas modificadas.

## 5. Por que no funciono el bloque anterior

### La ruta de `.vercel` estaba mal construida

Se utilizo:

```powershell
New-Item -ItemType Directory -Path "$deployDir.vercel" -Force
```

PowerShell lo interpreta como el valor de `$deployDir` seguido del texto
`.vercel`. El resultado es algo parecido a:

```text
C:\Users\...\Temp\imperio-deploy-abc.vercel
```

Pero Vercel busca esta estructura dentro de la carpeta a la que se entra con
`Push-Location`:

```text
C:\Users\...\Temp\imperio-deploy-abc\.vercel
```

La correccion es construir la ruta con `Join-Path`:

```powershell
$vercelDir = Join-Path $deployDir ".vercel"
```

### Las URLs tenian sintaxis de Markdown

Esto sirve dentro de un documento, pero no en PowerShell:

```text
[https://imperioes.com](https://imperioes.com)
```

En los comandos debe aparecer solo la URL:

```powershell
"https://imperioes.com"
```

### La sesion web y la sesion de la CLI son distintas

Aunque vercel.com este abierto y autenticado en el navegador, la terminal puede
responder `Not authorized`. Se resuelve con `npx vercel login`.

### Era mejor inspeccionar el deployment concreto

El dominio `imperioes.com` es un alias que cambia de un deployment a otro. Para
confirmar exactamente la version recien publicada, `vercel inspect` y
`vercel logs` deben recibir primero la URL unica generada por el despliegue.

## 6. Que publica cada metodo

| Metodo | Incluye cambios sin commit | Actualiza GitHub | Publica produccion |
| --- | --- | --- | --- |
| Push a una rama distinta de `main` | No | Si | No, crea Preview |
| Merge o push a `deploy/main` | No | Si | Si, automaticamente |
| `vercel deploy --prebuilt --prod` | Si | No | Si, directamente |

Para mantener un historial fiable, despues de una publicacion directa con la
CLI deben revisarse, confirmarse y subirse a GitHub los mismos cambios. De lo
contrario, una publicacion automatica posterior desde `deploy/main` podria
reemplazar produccion con una version que no los contiene.
