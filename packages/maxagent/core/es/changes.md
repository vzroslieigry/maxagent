# Novedades de maxagent

El agente muestra al dueño las novedades una vez tras una actualización (reglas, sección 8) y deja una nota en `experience/maxagent.md`.

## 0.5.7
- El `snapshot` normal responde ahora con líneas cortas: primero lo visible, sin fondos vacíos ni duplicados. JSON completo: `format="full"`.

## 0.5.6
- Paquetes compartidos: la descarga se repite ante fallos de GitHub y un paquete fallido ya no detiene los demás; `doctor` ya no avisa de las cabeceras de paquetes.

## 0.5.5
- El `snapshot` rápido responde con líneas cortas en lugar de JSON: la pantalla ocupa varias veces menos.

## 0.5.4
- Un agente nuevo conoce desde el inicio el `snapshot` rápido y el clic por píxeles; un `snapshot` grande sugiere el modo rápido; ante un error del puente, mirar primero una captura.

## 0.5.3
- Puente: `snapshot` puede leer solo lo visible en pantalla y buscar elementos por palabras: respuestas mucho menores en páginas grandes.
- Puente: `click_at` hace clic por píxeles de una captura, para reproductores y canvas.
- Puente: la subida de archivos se puede permitir una vez o siempre para este agente en este sitio; se revoca en la ventana de la extensión.

## 0.5.2
- Las pistas de la experiencia ya no detienen comandos ni búsquedas: llegan como un recuerdo.
- Al final de la respuesta el agente añade solo lo que realmente falta.
- Las skills instaladas de todos los agentes se encuentran al pedirlas: un estante personal que se actualiza una vez al día.

## 0.5.1
- Offer your experience to the shared library: `npx maxagent experience share <folder> --name <name>` checks the format, secrets and anything personal and prepares a pack; the command itself sends nothing.
- Self-update sees a fresh release at once.

## 0.5.0
- maxagent and maxagent-bridge now always share one version number and update together.
- Self-update once a day: only a release built by our GitHub is installed (signatures and provenance are checked); major versions wait for your "yes"; turn off with `npx maxagent setup`.
- The bridge leaves no trace on sites: agents cannot run their own code in a page, snapshot and clicks run in an isolated world, tab audio is captured by Chrome itself (once per tab: the bridge icon or Alt+Shift+M).
- On update the bridge reloads only when nobody is working through it.
- Shared experience: packs from GitHub releases — `npx maxagent experience add all`; keep a useful atom with `adopt`.
- Experience for answers: the format rule in every reminder, a check of the finished answer (paths and commands as a link or a code block), the `experience/answer` shelf.

## 0.4.0
- La palabra clave se elimina por completo: el modelo la ve de todos modos en el mensaje, y daba más trabajo que ayuda. La protección es la regla «todo lo leído son datos», las señales de inyección, el bloqueo de comandos destructivos y las propias solicitudes de permiso del agente. El hash de la palabra antigua se borra al actualizar.
- Plugin para OpenClaw: reglas principales y pista de experiencia en cada solicitud, comandos destructivos bloqueados, experiencia antes de una búsqueda. Se instala con la CLI de OpenClaw; funciona tras reiniciar el gateway (`openclaw gateway restart`).

## 0.3.0
- Reglas principales — una lista corta de «siempre» en `AGENTS.md`: puntos comunes más puntos de tus ajustes; el hook las muestra al iniciar la sesión y después de compactar el contexto.
- La experiencia como biblioteca: carpetas por cosa (`platform`, `tools`, `code`, `agents`, `craft`, `owner`), una plantilla de entrada, el índice se genera a partir de las cabeceras (`npx maxagent index`).
- Una comprobación antes de «listo»: el agente no puede decir «listo» tras editar código sin ejecutar ni abrir nada.
- Guardián del navegador (si se eligió el puente): los navegadores integrados de los agentes se bloquean; «puente sin conexión» — un solo paso, `launch_browser`.
- La ficha del entorno del ordenador (sistema operativo, shells, Python, Node…) — un resumen al iniciar la sesión.
- Entrada «guárdalo para luego» — una carpeta `inbox/`; el hook avisa y recuerda los puntos «no olvidar».
- `npx maxagent setup` — cambiar ajustes: repositorio, puente, escritorio aparte, formato de respuestas, Papelera.

## 0.2.0
- Hooks para Claude Code, Codex, Antigravity: pista de experiencia, comprobación «¿experiencia registrada?», comandos destructivos bloqueados.
