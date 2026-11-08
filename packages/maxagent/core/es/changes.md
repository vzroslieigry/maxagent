# Novedades de maxagent

El agente muestra al dueño las novedades una vez tras una actualización (reglas, sección 8) y deja una nota en `experience/maxagent.md`.

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
