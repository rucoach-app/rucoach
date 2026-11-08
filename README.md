<div align="center">
  <img src="./public/android-chrome-192x192.png" alt="RU Coach Logo" width="96" height="96" />

  # RU Coach — Rodrigo Urbina Personal Coaching

  **Plataforma Web Progresiva (PWA) de Entrenamiento Personalizado, Biomecánica Aplicada y Seguimiento Deportivo de Alto Rendimiento**

  [![Next.js 16](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![React 19](https://img.shields.io/badge/React-19.2-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
  [![TypeScript 5](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
  [![Cloudflare R2](https://img.shields.io/badge/Cloudflare-R2_&_DNS-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://www.cloudflare.com/)
  [![PWA Installable](https://img.shields.io/badge/PWA-iOS_%7C_Android_%7C_Desktop-F59E0B?style=for-the-badge)](https://rucoach.app)

  [**Sitio en Producción (`rucoach.app`)**](https://rucoach.app) · [**Portal de Documentación (`docs/`)**](./docs/INDEX.md) · [**Arquitectura**](./docs/ARCHITECTURE.md) · [**Base de Datos (22 Tablas)**](./docs/DATABASE_GUIDE.md) · [**Infraestructura Cloud**](./docs/INFRASTRUCTURE.md) · [**Motor Biomecánico**](./docs/ANATOMY_AND_BIOMECHANICS.md)
</div>

---

## Vista General

**RU Coach** es una plataforma de software integral de alto rendimiento diseñada para centralizar y elevar la relación entre **Entrenador (Coach)**, **Atleta (Asesorado)** y **Recepción**. Combina prescripción estructurada de rutinas continuas (con biseries, superseries y catálogo bilingüe de **1,330 ejercicios**), registro de sesiones en vivo con temporizadores hápticos/sonoros, **motor de sobrecarga progresiva automática con barrera clínica de dolor**, biometría antropométrica, comparador visual de progreso físico (*Antes / Después*), chat en tiempo real y notificaciones Web Push nativas.

<div align="center">
  <table>
    <tr>
      <td align="center" width="65%">
        <img src="./public/pwa-screenshot-desktop.png" alt="RU Coach — Vista Desktop" width="100%" />
        <br />
        <sub><b>Experiencia Desktop (1440px)</b> — Panel de Control y Analítica</sub>
      </td>
      <td align="center" width="35%">
        <img src="./public/pwa-screenshot-mobile.png" alt="RU Coach — Vista Móvil PWA" width="78%" />
        <br />
        <sub><b>Experiencia Móvil PWA (iOS & Android)</b></sub>
      </td>
    </tr>
  </table>
</div>

---

## Arquitectura del Sistema

```mermaid
flowchart LR
  subgraph Client["PWA Multiplataforma (iOS / Android / Desktop)"]
    UI["Next.js 16 App Router\nReact 19 + Tailwind v4"]
    SW["Service Worker (Serwist)\nCache + Web Push VAPID"]
  end

  subgraph Edge["Seguridad & Servidor"]
    Proxy["proxy.ts\nGuardia SSR + RBAC"]
    Actions["Server Actions\nValidación Zod + Lógica"]
  end

  subgraph Cloud["Infraestructura Cloud"]
    SB[("Supabase PostgreSQL 17\n22 Tablas + RLS + Triggers")]
    RT["Supabase Realtime\nChat en Vivo"]
    R2[("Cloudflare R2\n1,330 GIFs + Fotos + Avatares")]
    Resend["Resend SMTP & API\nEmails Transaccionales"]
  end

  UI --> Proxy
  Proxy --> Actions
  Actions --> SB
  Actions --> R2
  Actions --> Resend
  UI <--> RT
  SW <--> Actions
```

---

## Índice de Documentación Especializada

Para detalles exhaustivos de ingeniería y operación, consulta los documentos de la carpeta [`docs/`](./docs/INDEX.md):

* 📐 **[Arquitectura de Software (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)**: Topología de Server Components vs Client Components, estructura de directorios, edge routing (`proxy.ts`) y seguridad.
* 🗄️ **[Base de Datos Relacional (`docs/DATABASE_GUIDE.md`)](./docs/DATABASE_GUIDE.md)**: Diccionario de datos de las 22 tablas, diagramas entidad-relación, funciones almacenadas, triggers y políticas RLS optimizadas con `InitPlan`.
* ☁️ **[Infraestructura y Servicios Cloud (`docs/INFRASTRUCTURE.md`)](./docs/INFRASTRUCTURE.md)**: Configuración de Vercel, Supabase, Cloudflare DNS/R2, Resend, matriz de variables de entorno y CI/CD.
* 🧬 **[Biomecánica y Motor Anatómico (`docs/ANATOMY_AND_BIOMECHANICS.md`)](./docs/ANATOMY_AND_BIOMECHANICS.md)**: Los 18 grupos musculares canónicos, BodyMap SVG 2D, cálculo de fatiga neuromuscular, estimación de recuperación y fórmulas de 1RM.
* 🏋️ **[Rutinas y Progresión de Cargas (`docs/ROUTINES_AND_WORKOUTS.md`)](./docs/ROUTINES_AND_WORKOUTS.md)**: Constructor de rutinas, biseries/superseries, sustituciones de ejercicios, cronómetro minimizable y motor de sobrecarga con barrera clínica de dolor.
* 👥 **[Ecosistema de Roles y Flujos (`docs/ROLES_AND_WORKFLOWS.md`)](./docs/ROLES_AND_WORKFLOWS.md)**: Manual de los portales de Coach (`/admin`), Atleta (`/client`) y Recepción (`/receptionist`), ciclo de cobros y mensajería en tiempo real.
* 📱 **[PWA y Estrategia Offline (`docs/PWA_AND_OFFLINE.md`)](./docs/PWA_AND_OFFLINE.md)**: Service Worker con Serwist, políticas de caché, notificaciones Web Push nativas (VAPID) y adaptación móvil con `VisualViewport`.

---

## Ecosistema de Módulos por Rol

### 1. Portal del Coach / Administrador (`/admin/*`)
- **Dashboard Operativo (`/admin/dashboard`)**: KPIs en tiempo real (asesorados activos, sesiones completadas en la semana, récords personales del mes, alertas de inactividad +3 días y membresías próximas a vencer), curvas de adherencia y acceso rápido por atleta.
- **Hub Clínico y Deportivo 360° del Asesorado (`/admin/clients/[clientId]`)**:
  - **Alerta Clínica de Molestias**: Banner prioritario con reportes de dolor activos (`client_pain_reports`) y resolución clínica con un clic (`resolveClientPainReport`).
  - **Pestaña Resumen**: Rachas activas, nivel/XP, datos antropométricos, tamizaje de lesiones y bloc de notas privadas del coach.
  - **Pestaña Rutina**: Desglose diario del programa activo con **Cobertura Muscular Semanal (`WeeklyMuscleCoverage`)** en vivo, trazabilidad de **sustituciones de ejercicios** (`client_exercise_overrides`) y botón para restaurar el ejercicio original (`revertExerciseOverride`).
  - **Pestaña Historial**: Sesiones finalizadas con duración, tonelaje movido, series efectivas, **esfuerzo percibido post-entreno (`feeling_score` 1–5)** y comentarios del atleta (`feeling_note`).
  - **Pestaña Progreso, Biomecánica y Físico**:
    - **Analítica Biomecánica 3-en-1 (`MuscleBalanceCard`)**: Mapa corporal SVG interactivo (18 músculos canónicos), balance de volumen semanal (efectivo vs. planeado), cálculo de fatiga neuromuscular con horas estimadas a recuperación y retención de 1RM con decaimiento fisiológico.
    - **Heatmap Anual de Actividad (`ActivityHeatmap`)**: 52 semanas de consistencia con alternador de Volumen y Sesiones en paleta ámbar/oro de la marca.
    - Curvas de evolución de fuerza por ejercicio (`@tanstack/charts`), historial de **7 perímetros y medidas corporales** (Peso, % Grasa, Cintura, Cadera, Pecho, Brazo, Muslo) y galería privada de fotos de progreso con URLs firmadas desde Cloudflare R2.
- **Constructor Visual de Rutinas (`/admin/routines/builder` y `/admin/routines`)**:
  - Diseño de programas continuos (sin semanas forzadas) o con duración fija (`duration_weeks = null | number`), distribución de días de entrenamiento/descanso con **Enfoque del día (`focus`)** y contadores de volumen en vivo (`X ej. · Y series`).
  - **Series de Aproximación / Calentamiento (`warmup_sets`)**: Configuración discreta por ejercicio en acordeón colapsable para feeder/warmup sets sin saturar la vista.
  - **Cobertura Muscular en Vivo (`WeeklyMuscleCoverage`)**: Cálculo en tiempo real de volumen y estimulación muscular con mapa frontal/dorsal reactivo.
  - Reordenamiento *Drag & Drop* (`@dnd-kit`), agrupación visual de **Biseries y Superseries (Grupos A–E)**, vista previa técnica integrada (`ExerciseDetailDrawer`), prescripción de series, repeticiones, descanso y **notas por ejercicio (`notes`)**.
  - **Edición No Destructiva (`updateRoutineFromBuilder`)** que preserva el ciclo de días y las sustituciones de ejercicios del atleta, **clonación en 1 clic (`cloneRoutine`)** y **asignación rápida (`AssignRoutineModal`)** con notificación vía **Resend** y **Web Push**.
- **Catálogo Bilingüe y Editor Paso a Paso de Ejercicios (`/admin/exercises`)**:
  - **1,330+ ejercicios** con esquema bilingüe (`_es` prioritario), GIFs demostrativos servidos desde Cloudflare R2, clasificación por modalidad (`strength`, `bodyweight`, `timed`, `cardio`, `mobility`) y bandera `uses_external_load`.
  - **Filtro Anatómico Interactivo (`BodyMap` + `MuscleExplorerPanel`)**: Selección visual directa en mapa corporal SVG o chips musculares, sincronizado con la URL (`?muscle=...`).
  - **Creación y Edición por Puntos (`ExerciseFormModal`)**: Permite editar o crear ejercicios con una lista interactiva de pasos numerados (insertar, reordenar, pegar bloques de texto) y subida directa de GIF/imagen a Cloudflare R2.
- **Pagos Inteligentes, Descuentos y Vigencias (`/admin/payments` y `/admin/settings`)**:
  - Evaluación de vigencia efectiva (`period_end` vencido, por vencer en $\le 5$ días o vigente), cobro libre/personalizado sin plan fijo, renovación rápida en 1 clic, píldoras de descuento (`-10%`, `-15%`, `-20%`, `-50%`) o precio personalizado, reactivación inmediata de acceso y gestor CRUD de **Planes y Tarifas (`membership_plans`)**.
- **Invitaciones y Mensajería Realtime Multi-Canal (`/admin/invitations`, `/admin/messages`)**:
  - Códigos de invitación exclusivos para nuevos atletas o coaches y bandeja de chat en vivo con `postgres_changes` + canal Broadcast `chat_room` + puente Service Worker (`CHAT_NEW_MESSAGE`), soporte de teclado virtual móvil (`VisualViewport`) e indicadores de lectura (`Check` / `CheckCheck`).


### 2. Portal del Asesorado / Atleta (`/client/*`)
- **Onboarding Clínico y Antropométrico en 4 Pasos (`/onboarding`)**:
  - Sincronización inteligente de datos pre-cargados por el coach, creación automática de la **medición base Día 1** en `body_measurements`, selección de objetivos y disponibilidad semanal (`2` a `6+` días/semana), **tamizaje articular/lesiones** que genera alertas clínicas automáticas y activación de notificaciones Push compatible con iOS/Android/Desktop.
- **Dashboard del Atleta (`/client/dashboard`)**: Nivel actual, barra de XP, racha de días calendario, tarjeta de **Rotación Dinámica de Microciclos** (el plan progresa sesión a sesión completada para garantizar el estímulo muscular sin saltarse bloques por calendario, con títulos de ejercicios legibles en 2 líneas, iconos 100% circulares `rounded-full` y botón directo de **"Cambiar día"** integrado para adelantar, repetir o elegir cualquier sesión sin salir de la vista), gráfica de actividad (`7d` / `30d` / `90d`) e hitos recientes.
- **Mi Rutina (`/client/routines`)**:
  - **Tarjetas Horizontales Compactas**: Cada ejercicio se organiza en una fila horizontal con miniatura GIF a la izquierda, datos y series/repeticiones al centro y acciones de cambio/guía a la derecha, reduciendo la altura vertical en más del **55%** y eliminando el scroll excesivo.
  - **Desglose Pedagógico "Qué trabaja esta sesión"**: Mapa anatómico SVG interactivo frontal y dorsal con **porcentajes numéricos de carga relativa (`100%`, `87%`, `83%`...)**, distinción entre series primarias (100%) vs. secundarias de soporte (40%), leyenda clara para el atleta y etiquetas sin truncamiento (`Foco: Hombros`).
  - Instrucciones paso a paso con GIF, **intercambio inteligente de ejercicio** (`ExerciseSwapDrawer`) con selector anatómico y **cambio temporal del día a entrenar hoy** (`ScheduleOverrideDialog`).
- **Sesión de Entrenamiento Activa (`/client/workout/start`)**:
  - **Arranque Instantáneo (~375ms)**: Carga paralela de rutina, última sesión y PRs en una sola ola concurrente en servidor.
  - **Temporizador de Descanso Minimizable**: Modal interactivo que puede minimizarse en una barra flotante fija inferior (`⏱ Descanso activo: 1:45 restantes | +30s | Saltar`) para navegar por la rutina o revisar la técnica mientras continúa la cuenta regresiva.
  - Soporte de **Series de Aproximación (W)** vs. Series Efectivas de trabajo con un clic.
  - Registro serie por serie con historial previo del ejercicio, controles táctiles de `44x44px`, soporte para biseries/superseries, alerta Web Audio API + vibración háptica y autoguardado en `localStorage`.
  - **Cierre con Sensación Post-Entreno (`1–5`)** y nota directa para el coach (excluyendo automáticamente las series de aproximación del tonelaje total y actualizando estadísticas con bypass RLS seguro).
- **Resumen Post-Entrenamiento y Auto-Progresión (`/client/workout/summary`)**:
  - **Resumen Anatómico de la Sesión**: Mapa corporal SVG reactivo que muestra los músculos estimulados hoy.
  - Desglose de series, XP obtenido, **Nuevos Récords Personales (PRs)** (calculados solo sobre series efectivas) y modales de desbloqueo de medallas con opción de compartir (`navigator.share`).
  - **Motor de Auto-Progresión (`lib/auto-progression.ts`)**: Incrementa de forma inteligente las cargas sugeridas cuando el atleta cumple el tope de repeticiones con RPE controlado, incorporando una **barrera de seguridad clínica** que congela incrementos en tren superior o inferior si existe un reporte de dolor activo (`severity >= 4`).
- **Progreso, Biomecánica, Medidas, Fotos, Calendario y Logros**:
  - **Analítica Biomecánica (`/client/progress`)**: Balance de grupos musculares, índice de fatiga y recuperación estimada, y gráfica de retención de 1RM junto al heatmap de 52 semanas.
  - Gráficas de fuerza/volumen (`/client/progress`), radar antropométrico de 7 métricas (`/client/measurements`), comparador interactivo **Antes / Después** (`/client/photos`), calendario mensual (`/client/calendar`) y vitrina de 16 medallas (`/client/achievements`).

### 3. Portal de Recepción (`/receptionist/*`)
- **Control de Acceso y Caja (`/receptionist/dashboard`, `/check-in`, `/clients`, `/payments`)**: Verificación inmediata de estatus de membresía, check-in diario de asistencia y consulta de pagos.

---

## Stack Tecnológico

| Capa | Tecnología |
| :--- | :--- |
| **Framework & Runtime** | Next.js `16.2` (`App Router`, React Server Components, Server Actions, `proxy.ts`) |
| **Frontend & UI** | React `19.2`, TypeScript `5`, Tailwind CSS `v4` (`@tailwindcss/postcss`), Radix UI / `shadcn/ui`, Lucide Icons |
| **Base de Datos & Auth** | Supabase (`@supabase/ssr`, PostgreSQL 17, Row Level Security con `InitPlan`, Triggers, Realtime, Storage) |
| **Almacenamiento S3 / CDN** | Cloudflare R2 (`@aws-sdk/client-s3` + Presigned URLs con validación RBAC) |
| **Visualización de Datos** | Recharts + `@tanstack/charts` |
| **PWA & Notificaciones** | `@serwist/next` (`app/sw.ts`) + Web Push Protocol (`web-push` VAPID) |
| **Correos Transaccionales** | Resend API + `@react-email/components` + Plantillas HTML de Supabase Auth |
| **Calidad & Testing** | Vitest (`vitest run`), TypeScript (`tsc --noEmit`), ESLint 9 (`pnpm lint`) |

---

## Estructura del Proyecto

```text
rucoach/
├── app/
│   ├── actions/          # 16 módulos de Server Actions (Auth, Workouts, Rutinas, R2, Push, Pagos)
│   ├── admin/            # Portal del Coach / Administrador (Dashboard, Clientes, Builder, Pagos)
│   ├── api/              # Route Handlers (Validación de invitaciones)
│   ├── auth/             # Flujos de autenticación (Login, Sign-up, OTP, Callback PKCE, Recovery)
│   ├── client/           # Portal del Asesorado (Dashboard, Rutina, Entreno Activo, Progreso, Fotos)
│   ├── onboarding/       # Onboarding clínico e interactivo del asesorado (4 pasos)
│   ├── receptionist/     # Portal operativo de recepción y check-in
│   ├── globals.css       # Sistema de tokens OKLCH (Claro/Oscuro AAA) y utilidades Tailwind v4
│   ├── layout.tsx        # Root Layout, metadatos SEO, JSON-LD y configuración PWA
│   └── sw.ts             # Service Worker (Serwist + Web Push Notifications)
├── components/           # Componentes UI modulares (admin, client, chat, charts, photos, routines, ui)
├── docs/                 # Documentación técnica, operativa y guías de migración a producción
├── emails/               # Plantillas React Email (Resend) y plantillas HTML para Supabase Auth
├── hooks/                # Custom React Hooks
├── lib/                  # Motores de negocio (auto-progression, gamification, email, push, r2, types)
├── public/               # Manifiesto PWA, iconos maskable/Apple Touch y recursos estáticos optimizados
├── scripts/              # Scripts de mantenimiento y migración (migrate-exercises.ts, translate, upload-r2)
├── supabase/             # Esquema SQL maestro replicable (supabase_schema_dump.sql) y datos semilla (seed.sql)
└── proxy.ts              # Middleware/Proxy SSR de sesión Supabase y control de acceso por rol
```

---

## Inicio Rápido y Replicación en Supabase

### 1. Clonar e instalar dependencias
```bash
git clone https://github.com/herwingx/rucoach.git
cd rucoach
pnpm install
```

### 2. Configurar variables de entorno
Copia la plantilla [`.env.example`](./.env.example) a `.env.local`:
```bash
cp .env.example .env.local
```

Variables requeridas:
- **App**: `NEXT_PUBLIC_APP_URL` (`https://rucoach.app` en producción o `http://localhost:3000` en local) y `ADMIN_SETUP_CODE`.
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (o `NEXT_PUBLIC_SUPABASE_ANON_KEY`) y `SUPABASE_SERVICE_ROLE_KEY`.
- **Cloudflare R2**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `NEXT_PUBLIC_R2_PUBLIC_URL`.
- **Resend**: `RESEND_API_KEY` y `EMAIL_FROM` (`RU Coach <noreply@rucoach.app>`).
- **Web Push (VAPID)**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`.

### 3. Replicar la Base de Datos al 100% en Supabase (3 pasos nativos)
El proyecto utiliza SQL nativo de PostgreSQL 17 para soportar **Row Level Security (RLS)**, triggers sobre `auth.users`, buckets de Storage y publicaciones Realtime:

1. **Esquema Maestro**: Ejecuta [`supabase/supabase_schema_dump.sql`](./supabase/supabase_schema_dump.sql) en el **SQL Editor** de tu proyecto Supabase (crea las 17 tablas, 2 vistas, funciones RPC, triggers, índices, políticas RLS, buckets `avatars`/`progress-photos` y Realtime).
2. **Datos Semilla**: Ejecuta [`supabase/seed.sql`](./supabase/seed.sql) en el **SQL Editor** (inserta las 16 medallas de gamificación y los planes de membresía base).
3. **Catálogo de 1,324 Ejercicios**: Si estás migrando desde otra instancia de Supabase, ejecuta [`scripts/migrate-exercises.ts`](./scripts/migrate-exercises.ts):
   ```bash
   OLD_SUPABASE_URL="https://proyecto-anterior.supabase.co" \
   OLD_SUPABASE_KEY="anon_key_anterior" \
   NEW_SUPABASE_URL="https://proyecto-nuevo.supabase.co" \
   NEW_SUPABASE_SERVICE_ROLE_KEY="service_role_key_nueva" \
   npx tsx scripts/migrate-exercises.ts
   ```

### 4. Ejecutar en desarrollo
```bash
pnpm dev
```

---

## Scripts de Calidad y Construcción

| Comando | Descripción |
| :--- | :--- |
| `pnpm dev` | Inicia el servidor de desarrollo en `http://localhost:3000` |
| `pnpm build` | Compila la aplicación y genera el Service Worker de producción (`next build --webpack`) |
| `pnpm start` | Inicia el servidor de producción |
| `pnpm lint` | Ejecuta análisis estático con ESLint 9 (`0 warnings`, `0 errors`) |
| `pnpm exec tsc --noEmit` | Verifica el tipado estricto de TypeScript en toda la aplicación y `scripts/` |
| `pnpm test` | Ejecuta la suite de pruebas unitarias con Vitest (`vitest run`) |
| `pnpm verify` | Ejecuta pruebas unitarias + validación TypeScript + compilación de producción |

---

## Documentación del Proyecto

Toda la documentación técnica se encuentra actualizada en el directorio [`docs/`](./docs/INDEX.md):

- [**Índice Maestro de Documentación (`docs/INDEX.md`)**](./docs/INDEX.md)
- [**Motor Anatómico y Fusión Biomecánica (`docs/ANATOMIA_Y_FUSION_OPEN_GYM.md`)**](./docs/ANATOMIA_Y_FUSION_OPEN_GYM.md)
- [**Guía Paso a Paso de Migración a Producción y Dominio `rucoach.app` (`docs/MIGRACION_PRODUCCION_RUCOACH_APP.md`)**](./docs/MIGRACION_PRODUCCION_RUCOACH_APP.md)
- [**Resumen General del Sistema (`docs/README.md`)**](./docs/README.md)
- [**Arquitectura e Ingeniería (`docs/ARCHITECTURE.md`)**](./docs/ARCHITECTURE.md)
- [**Guía de Base de Datos, RLS y Diccionario de 17 Tablas (`docs/DATABASE_GUIDE.md`)**](./docs/DATABASE_GUIDE.md)
- [**Manual de Despliegue y Operación (`docs/DEPLOYMENT.md`)**](./docs/DEPLOYMENT.md)
- [**Configuración de Cloudflare R2 (`docs/R2_MIGRATION_GUIDE.md`)**](./docs/R2_MIGRATION_GUIDE.md)
- [**Manual del Sistema de Rutinas (`docs/ROUTINES.md`)**](./docs/ROUTINES.md)
- [**Motor de Progresión, PRs y Gamificación (`docs/PROGRESSION.md`)**](./docs/PROGRESSION.md)

---

<div align="center">
  <sub>Desarrollado para <b>RU Coach — Rodrigo Urbina Personal Coaching</b> · <a href="https://rucoach.app">rucoach.app</a></sub>
</div>
