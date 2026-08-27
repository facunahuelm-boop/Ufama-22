# Sistema Operativo Digital de la Cooperativa — MVP

Sistema de gestión interno para una cooperativa de vivienda por ayuda mutua en Uruguay, con 5 módulos (Obra, Trabajo, Compras, Seguridad, Finanzas), Documentos, Dashboard, Alertas automáticas, Auditoría y un Asistente de IA. Construido según el análisis profesional previo (`Sistema_Operativo_Digital_Cooperativa_Analisis.docx`).

Es un prototipo funcional de alcance MVP: prioriza tener los cinco módulos funcionando de punta a punta con datos reales, antes que pulir cada detalle. La sección "Qué quedó afuera a propósito" explica los límites conscientes.

## Puesta en marcha local (2 minutos)

Requisitos: Node.js 22 o superior (usa el módulo nativo `node:sqlite`, no hace falta instalar nada de base de datos aparte).

```bash
npm install
npm run seed     # crea data/coop.db con datos de ejemplo (una obra simulada de ~2 meses)
npm run dev       # http://localhost:3000
```

Al entrar redirige a `/login`. Ahí mismo hay un desplegable con los 11 usuarios de prueba, uno por rol. La contraseña de todos es:

```
cooperativa2026
```

Por ejemplo: `helena@coop.uy` (Consejo Directivo) ve todo; `ana@coop.uy` (Socia) ve una versión acotada; `beatriz@coop.uy` (Comisión de Obra) puede cargar tareas y avances.

`npm run seed` borra y vuelve a crear la base — usalo cuando quieras reiniciar la demo a su estado inicial.

## Qué incluye

- **Obra**: cronograma por etapas, semáforo automático (verde/amarillo/rojo) calculado por atraso y por problemas críticos abiertos, avances con foto, problemas/observaciones, dependencias simples entre tareas.
- **Trabajo**: calendario de jornadas de ayuda mutua, propuesta de distribución de tareas por núcleo familiar generada por un motor de reglas (habilidades registradas + disponibilidad), confirmación de asignaciones, registro de asistencia y horas acumuladas por núcleo.
- **Compras**: solicitudes de compra, carga de presupuestos de proveedores, comparación automática en lenguaje simple (precio, envío, plazo, forma de pago, garantía) que **nunca** elige por sí sola al proveedor, registro de la decisión y motivo, historial de proveedores.
- **Seguridad**: documentación con vencimientos y alertas, checklist de inspección, incidentes/observaciones con foto (con una nota de IA "asistencia preliminar" que siempre aclara que no reemplaza al responsable de seguridad).
- **Finanzas**: ingresos/egresos, distinción explícita entre saldo bancario y disponible prudencial (saldo − comprometido), gasto por categoría, presupuesto vs. real, próximos pagos. Los montos detallados solo los ve Administración, Tesorería, Consejo Directivo, Comisión Fiscal y el Administrador del sistema (los demás roles ven un resumen).
- **Documentos**: repositorio con categorías (actas, reglamentos, contratos, etc.), subida y descarga real de archivos.
- **Alertas**: motor de reglas que recalcula automáticamente alertas críticas/importantes/informativas a partir de los datos (documentos vencidos, tareas atrasadas, riesgos abiertos, desvíos de presupuesto, disponible prudencial negativo, tareas de jornada sin cubrir), asignadas a la comisión responsable.
- **Auditoría**: registro de solo lectura (no editable desde la aplicación) de compras, pagos, aprobaciones y otras acciones sensibles: quién, qué, cuándo, valor anterior y nuevo.
- **Roles y permisos**: 11 roles con una matriz de acceso por módulo (lectura / edición / aprobación / configuración), igual a la propuesta de la sección 7 del análisis.
- **Asistente de IA**: chat con preguntas sugeridas que lee los datos reales del sistema y cita la fuente. Funciona en dos modos (ver más abajo).

## El Asistente de IA: motor local vs. Claude real

Por decisión explícita al construir este MVP, el chat funciona **sin necesitar ninguna API key** todavía: un motor de reglas locales (`src/lib/ia.ts`) interpreta las preguntas frecuentes ("¿cómo viene la obra?", "¿qué tareas están atrasadas?", "¿cuánto dinero tenemos?", etc.) y arma la respuesta consultando la base de datos real, citando siempre el módulo de origen.

Cuando quieras respuestas más flexibles generadas por un modelo de lenguaje real:

1. Conseguí una API key en [console.anthropic.com](https://console.anthropic.com).
2. Agregala como variable de entorno `ANTHROPIC_API_KEY` (en `.env.local` para desarrollo, o en las variables de entorno de tu hosting en producción).
3. Reiniciá el servidor. El chat va a usar automáticamente Claude, pasándole como contexto los mismos datos que usa el motor local (obra, finanzas, compras pendientes, alertas), filtrados según el rol de quien pregunta. El resto del sistema no cambia.

En ningún modo la IA aprueba compras, pagos, ni decisiones — eso está impuesto a nivel de diseño (ver sección 17 del análisis), no solo de prompt.

## Arquitectura y por qué se eligió así

| Capa | Elección en este MVP | Nota |
|---|---|---|
| Framework | Next.js 16 (App Router, Server Actions) | Un solo proyecto para frontend y backend. |
| Base de datos | SQLite vía el módulo nativo `node:sqlite` (Node 22+) | **Prisma no se pudo usar en este entorno de desarrollo**: necesita descargar binarios desde `binaries.prisma.sh`, bloqueado por la política de red del sandbox donde se construyó este MVP. `node:sqlite` no depende de ninguna descarga externa ni de compilar nada, así que funciona igual en cualquier máquina con Node 22+. Fuera de este sandbox no hay ningún impedimento para usar Prisma si lo preferís. |
| Autenticación | Cookie firmada (JWT con `jose`) + `bcryptjs` para contraseñas | Liviano, sin dependencias nativas. Cambiá `AUTH_SECRET` en producción (ver más abajo). |
| Archivos subidos | Se guardan en `public/uploads/` | Ver limitación importante más abajo. |
| Estilos | Tailwind CSS v4, mobile-first | Mismo diseño visual que el documento de análisis (semáforos, tarjetas, colores institucionales). |

Toda la lógica de acceso a datos pasa por `src/lib/db.ts` (funciones genéricas `all`, `get`, `insert`, `update`) y `src/lib/logic.ts` (semáforo, alertas, finanzas, comparación de compras). El resto de la aplicación (páginas y acciones) usa esas funciones, no SQL directo. Esto es a propósito: **migrar a otra base de datos significa reescribir esas dos capas, no la aplicación entera.**

## ⚠️ Importante antes de usarlo con la cooperativa real

Este MVP corre hoy con una base de datos SQLite en un archivo local (`data/coop.db`) y los archivos subidos en `public/uploads/`. Esto anda perfecto en:

- tu computadora, para probarlo,
- un servidor propio o una VPS con disco persistente,
- un contenedor Docker con un volumen persistente.

**No anda bien tal cual en un hosting serverless típico como Vercel**, porque las funciones serverless no tienen disco persistente entre ejecuciones: cada escritura se puede perder. Antes de poner esto en producción para que la cooperativa lo use de verdad, tenés dos caminos:

### Camino rápido: hosting con disco persistente

Desplegar este mismo proyecto (sin cambiar código) en un servicio que sí ofrezca disco persistente: Railway, Render, Fly.io, o un VPS económico. Alcanza con montar un volumen en la carpeta `data/` (y opcionalmente en `public/uploads/`) y configurar la variable `AUTH_SECRET`. Es el camino más rápido para probar con la cooperativa real sin reescribir nada.

### Camino escalable: migrar a Supabase (Postgres) + Vercel

El camino que se dejó preparado en el análisis original. Pasos generales:

1. Crear un proyecto gratuito en [supabase.com](https://supabase.com).
2. Adaptar `src/lib/schema.sql` a PostgreSQL (los cambios son menores: `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY` o `GENERATED ALWAYS AS IDENTITY`, `datetime('now')` → `now()`) y ejecutarlo en el editor SQL de Supabase.
3. Instalar el cliente de Postgres (`npm install postgres` o `@supabase/supabase-js`) y reescribir las funciones `all`, `get`, `insert`, `update` de `src/lib/db.ts` para que usen ese cliente en vez de `node:sqlite`. El resto del código de la aplicación no debería necesitar cambios, porque todos consumen esas mismas funciones.
4. Mover el almacenamiento de archivos (`src/lib/upload.ts`) a Supabase Storage en vez de `public/uploads/`.
5. Desplegar en Vercel, configurando `DATABASE_URL` (o las variables de Supabase), `AUTH_SECRET` y, si corresponde, `ANTHROPIC_API_KEY`.

Este segundo camino es el que conviene cuando la cooperativa ya probó el MVP y quiere seguir con él durante los ~2 años de obra, con más de un servidor o con necesidad real de escalar.

## Variables de entorno

Creá un archivo `.env.local` (no se commitea) con lo que necesites:

```bash
AUTH_SECRET=una-clave-larga-y-aleatoria-antes-de-produccion
ANTHROPIC_API_KEY=sk-ant-...   # opcional, activa el motor de IA con Claude real
```

Si no definís `AUTH_SECRET`, el sistema usa una clave de desarrollo — **cambiala antes de usar esto con datos reales de la cooperativa.**

## Qué quedó afuera a propósito (Fase 2)

Siguiendo el roadmap del análisis (sección 20), este MVP no incluye todavía:

- Búsqueda semántica de la IA dentro de documentos largos (RAG) — hoy la IA responde sobre datos estructurados, no sobre el contenido libre de PDFs.
- Análisis automático de fotos de seguridad por IA (hoy deja una nota de "asistencia preliminar" fija, no analiza la imagen en sí).
- Permisos por documento individual dentro de "Documentos" (hoy el permiso es por módulo, no por categoría o documento específico — por ejemplo, "documentación de socios" debería tener un control más fino antes de un uso real).
- Notificaciones push/email automáticas de alertas (hoy las alertas se ven al entrar al sistema, no se envían solas).
- Reportes descargables (PDF/Excel) de resúmenes semanales o mensuales.

## Estructura del proyecto

```
src/
  app/                  páginas (App Router) y layout con navegación mobile-first
    (app)/              rutas protegidas por sesión: dashboard, obra, trabajo, compras...
    login/
  components/           componentes de UI reutilizables (Card, Badge, Nav, ChatIA...)
  lib/
    schema.sql           esquema completo de la base de datos
    db.ts                capa de acceso a datos (SQLite) + auditoría + alertas
    logic.ts              semáforo, finanzas, motor de comparación de compras, motor de alertas
    ia.ts                  motor de IA (local + Claude opcional)
    roles.ts               matriz de roles y permisos
    auth.ts                 sesión (cookie firmada) y hashing de contraseñas
    actions/                Server Actions por módulo (mutaciones)
scripts/
  seed.mjs               datos de ejemplo
test-e2e.mjs              smoke test opcional con Playwright (ver abajo)
```

## Smoke test automático (opcional)

Hay un script de prueba end-to-end con Playwright que recorre los módulos con distintos roles, crea una tarea, carga una comparación de compras y consulta al asistente de IA, para detectar errores de un vistazo:

```bash
npx playwright install chromium   # una sola vez
npm run dev &                      # en otra terminal
node test-e2e.mjs
```

Termina con `ALL CHECKS PASSED` o una lista de errores concretos.

## Recordatorio de diseño (no técnico)

Este sistema es un asistente de organización, no un reemplazo de las personas ni de los profesionales responsables (IAT, contador, técnico prevencionista, escribano). Ninguna pantalla aprueba automáticamente una compra, un pago, una decisión técnica o una cuestión de seguridad: siempre queda un clic explícito de la persona u órgano con esa atribución. Para el detalle completo de qué es obligación legal, qué es buena práctica, qué es procedimiento interno y qué es recomendación de diseño, ver el documento `Sistema_Operativo_Digital_Cooperativa_Analisis.docx`.
