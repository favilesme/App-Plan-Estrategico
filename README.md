# App-Plan-Estrategico

Archivos fuente de la Aplicacion de Plan Estrategico creada en Sites.

Aplicación privada de planificación estratégica de Anima Praxis. Este repositorio conserva el código fuente; cada instalación del Site mantiene sus propios usuarios, datos y configuración de entorno. El estado funcional actual corresponde al **Sprint 2**: arquitectura multiusuario, perfil empresarial, filosofía empresarial y diagnóstico guiado. Los módulos posteriores aparecen en la navegación y aún no ejecutan la metodología.

## Estructura

| Ruta | Contenido |
|---|---|
| `app/` | Páginas, acciones de servidor, autenticación y rutas API |
| `components/`, `hooks/`, `public/` | Interfaz y recursos propios |
| `lib/` | Roles, consultas, preguntas y configuración metodológica |
| `db/`, `drizzle/` | Esquema y migraciones D1, versionadas en orden |
| `scripts/`, `build/`, `vendor/` | Scripts de instalación y build, Worker y recursos requeridos |
| `.openai/hosting.json` | Identificador del Site y nombres lógicos de D1/R2, sin secretos |
| `package.json`, `package-lock.json` | Dependencias reproducibles con npm |
| `SPRINT_*.md` | Alcance, decisiones y pruebas de cada sprint |

## Identidad visual

Los dos logotipos aprobados están en `public/brand/`: la versión rectangular se usa en la navegación y la cuadrada en el inicio y como icono del Site. La interfaz utiliza los valores de la paleta facilitada: Azul Profundo `#192538`, Gris Pizarra `#5A626F`, Dorado Suave `#D6A871` y Dorado Claro `#E6C99F`; el blanco y los tonos crema sirven de fondo. Los colores rojo y verde quedan reservados para estados funcionales.

Los titulares solicitan **Garamond** y el texto **Avenir** mediante CSS. Los archivos de fuente no se adjuntaron y no se incluyen fuentes comerciales en este repositorio. En equipos sin esas familias se muestran alternativas serif y sans-serif; para una apariencia idéntica en todos los dispositivos se necesitan archivos webfont con licencia de distribución.

## Ejecutar desde una clonación limpia

Requiere **Node.js 22.13 o superior** y npm.

```sh
git clone https://github.com/favilesme/App-Plan-Estrategico.git
cd App-Plan-Estrategico
npm ci
export SITE_OWNER_EMAIL=seedy@sites.test
npm run build
```

Para una base D1 local nueva, aplicar las migraciones una sola vez y en orden:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_loose_moon_knight.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_careful_skaar.sql
npm run dev
```

Abrir la dirección local que muestra Vite y entrar por `/signin-with-chatgpt?return_to=/`. El modo portable simula la identidad `seedy@sites.test` **solo en desarrollo local**. Si se usa otro correo de prueba, ponerlo también en `SITE_OWNER_EMAIL`. No usar información empresarial real en la base de prueba.

`npm run build` verifica que el Worker pueda generarse. `npm run lint` ejecuta el análisis estático. El archivo `.env.example` enumera la variable de entorno necesaria; el ejemplo no carga variables automáticamente. Para producción, configurar `SITE_OWNER_EMAIL` en las variables del Site, sin guardar su valor en Git.

## Persistencia y acceso

La aplicación usa los enlaces `DB` (Cloudflare D1) y `BUCKET` (Cloudflare R2) declarados en `.openai/hosting.json`. Los datos de clientes, aprobaciones, archivos y auditoría pertenecen a la instancia privada del cliente y **no** se copian a GitHub. La identidad del visitante la aporta Sites mediante Sign in with ChatGPT. Compartir el Site y asignar un rol interno son operaciones distintas.

## Sincronización y publicación

La rama `main` de este repositorio es la referencia del código. Para cada cambio relevante:

1. Partir de `main` actualizado, revisar cambios remotos y desarrollar en una rama o copia de trabajo.
2. Verificar compilación y migraciones; revisar que no se incluyan secretos ni datos de clientes.
3. Crear un commit descriptivo y actualizar `main` en GitHub mediante avance normal, sin `push --force`.
4. Llevar **ese mismo commit** al repositorio fuente del Site y publicar una versión mediante el flujo de Sites. Confirmar el estado del despliegue y las migraciones de producción.

Sites mantiene además su propio repositorio de origen para generar las versiones publicadas. **GitHub y Sites no se sincronizan solos**: un cambio en un destino debe enviarse explícitamente al otro. La publicación del Site usa la instancia ya registrada en `.openai/hosting.json`; no se debe crear un Site nuevo para este proyecto.

## Seguridad del repositorio

`.gitignore` excluye dependencias, builds, bases locales, cachés, logs y archivos de entorno. No añadir tokens, claves, credenciales, respaldos con datos empresariales ni exportaciones D1/R2. El repositorio de GitHub indicado es actualmente público; conservar allí solo código y documentación aptos para ese nivel de visibilidad.
