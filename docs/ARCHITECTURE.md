# Arquitectura Técnica — RU Coach

## Resumen

**RU Coach (Rodrigo Urbina Personal Coaching)** es una aplicación web progresiva (**PWA**) de entrenamiento personalizado construida sobre **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, **Supabase (PostgreSQL + Auth + Realtime + Storage)**, **Cloudflare R2**, **Resend** y **Web Push (VAPID)**.

---

## Stack Tecnológico

```text
FRONTEND & UI
├── Next.js 16.2.1 (App Router, Server Components, Server Actions, proxy.ts)
├── React 19.2.4 + TypeScript 5.9 (target ES2022)
├── Tailwind CSS v4.2 (@tailwindcss/postcss) + variables OKLCH semánticas (Dark / Light)
├── Motor Anatómico Reactivo (SVG BodyMap, Balance Muscular, Fatiga Neuromuscular, Retención 1RM)
├── shadcn/ui + Radix UI Primitives + Lucide React Icons
├── @dnd-kit (Drag & Drop en el Constructor de Rutinas)
├── Recharts + @tanstack/charts (Analítica de Fuerza, Volumen y Medidas)
└── @img-comparison-slider/react (Comparador Antes / Después de Fotos)

BACKEND & DATOS
├── Supabase Auth (PKCE, Token Hash, OTP de 6-8 dígitos, Roles en metadata y profiles)
├── Supabase PostgreSQL (19 tablas con RLS optimizado mediante InitPlan `(select auth.uid())`)
├── Supabase Realtime (Canal en vivo para `public.messages` con INSERT y UPDATE de lectura)
├── Cloudflare R2 (@aws-sdk/client-s3 + URLs pre-firmadas con control de acceso por rol/propietario)
├── Resend + @react-email/components (Correos transaccionales de invitación, bienvenida, rutina y pago)
└── Web Push & PWA (VAPID con `web-push` en `lib/push.ts` + `@serwist/next` en `app/sw.ts`)
```

---

## Estructura de Directorios

```text
gym-coaching/
├── proxy.ts                            # Proxy de Next.js 16 (refresco de sesión Supabase y cabeceras x-pathname)
├── next.config.mjs                     # Configuración Next.js 16 + Serwist PWA + Security Headers
├── app/
│   ├── layout.tsx                      # Root Layout (Geist Sans/Mono, ThemeProvider, Toaster, PWAInstallCTA)
│   ├── globals.css                     # Tokens de diseño OKLCH, motor CSS del mapa anatómico (.bodymap, .bm-*) y safe-areas
│   ├── sw.ts                           # Service Worker (caché offline Serwist + eventos push y notificationclick)
│   ├── manifest.ts                     # Web App Manifest para instalación PWA en iOS/Android/Desktop
│   ├── robots.ts / sitemap.ts          # SEO técnico dinámico
│   ├── error.tsx / not-found.tsx       # Páginas globales de error y 404
│   ├── offline/page.tsx                # Fallback sin conexión
│   ├── suspended/page.tsx              # Pantalla de cuenta pausada/vencida con contacto directo al Coach
│   ├── auth/                           # Flujos de autenticación (Login, Sign-up, OTP, PKCE, Recovery, Admin Setup)
│   ├── onboarding/                     # Flujo guiado de 4 pasos para nuevos asesorados
│   ├── admin/                          # Portal del Coach / Administrador
│   │   ├── dashboard/                  # Vista ejecutiva de asesorados, alertas, KPIs y gráfica semanal
│   │   ├── clients/                    # Directorio, creación, asignaciones y Hub 360° con analítica biomecánica
│   │   ├── routines/                   # Catálogo de rutinas, clonación, asignación rápida y Constructor Visual con cobertura muscular
│   │   ├── exercises/                  # Catálogo bilingüe de 1,330+ ejercicios con filtro interactivo por mapa corporal
│   │   ├── payments/                   # Gestión de cobros, vigencia efectiva, cobro libre y renovación en 1 clic
│   │   ├── invitations/                # Generación y administración de códigos de invitación
│   │   ├── messages/                   # Inbox de chat en tiempo real con todos los asesorados
│   │   └── settings/                   # Configuración de marca, Planes y Tarifas, perfil del coach y Web Push
│   ├── client/                         # Portal del Asesorado
│   │   ├── dashboard/                  # Nivel/XP, racha, próximo entrenamiento, estado de membresía, gráfica e hitos
│   │   ├── routines/                   # Rutina activa, "Qué trabaja esta sesión" con mapa corporal bare, técnica y swap
│   │   ├── workout/start/              # Sesión en vivo con series de aproximación separadas, cronómetro y sensación post-entreno
│   │   ├── workout/summary/            # Resumen de sesión con mapa de activación muscular, PRs, series, logros y auto-progresión
│   │   ├── workouts/                   # Historial filtrable por rango de fechas
│   │   ├── progress/                   # Balance muscular 3-en-1, fatiga, retención de 1RM, heatmap anual y gráficas
│   │   ├── measurements/               # Registro y gráficas de 7 medidas corporales
│   │   ├── photos/                     # Galería en R2 y comparador interactivo Antes / Después
│   │   ├── calendar/                   # Calendario mensual de entrenamientos
│   │   ├── achievements/               # Vitrina de logros, medallas y rachas
│   │   ├── messages/                   # Chat directo en tiempo real con el Coach (VisualViewport mobile-safe)
│   │   └── profile/                    # Perfil físico/médico, membresía, reporte de dolor y Web Push
│   └── receptionist/                   # Portal de Recepción (dashboard, check-in, clientes, pagos)
├── components/
│   ├── anatomy/                        # Componentes del motor anatómico (BodyMap, MuscleBalanceCard, ActivityHeatmap, WeeklyMuscleCoverage)
│   ├── admin/                          # Componentes del portal coach (exercises, clients, routines)
│   ├── client/                         # Componentes del portal cliente (workout, routines, photos)
│   └── ui/                             # Primitivas Radix UI / shadcn/ui con soporte mobile-safe
├── lib/
│   ├── anatomy/                        # Lógica biomecánica: músculos canónicos (muscles.ts), fatiga y retención 1RM (recovery.ts)
│   ├── local-cache.ts                  # Caché en memoria + localStorage con TTL para respuesta inmediata
│   ├── auto-progression.ts             # Motor de sobrecarga progresiva con barrera clínica de dolor
│   ├── progression.ts                  # Fórmulas de 1RM (Epley/Brzycki) y evaluación de PRs en series efectivas
│   ├── push.ts                         # Envío seguro de notificaciones Web Push VAPID
│   └── r2.ts                           # Clientes S3 y generación de URLs firmadas para Cloudflare R2
│   ├── sw.ts                           # Service Worker (caché offline Serwist + eventos push y notificationclick)
│   ├── manifest.ts                     # Web App Manifest para instalación PWA en iOS/Android/Desktop
│   ├── robots.ts / sitemap.ts          # SEO técnico dinámico
│   ├── error.tsx / not-found.tsx       # Páginas globales de error y 404
│   ├── offline/page.tsx                # Fallback sin conexión
│   ├── suspended/page.tsx              # Pantalla de cuenta pausada/vencida con contacto directo al Coach
│   ├── auth/
│   │   ├── login/page.tsx              # Inicio de sesión
│   │   ├── sign-up/page.tsx            # Registro con validación de código de invitación
│   │   ├── verify-otp/page.tsx         # Verificación de código OTP (registro y recuperación)
│   │   ├── forgot-password/page.tsx    # Solicitud de recuperación de contraseña
│   │   ├── reset-password/page.tsx     # Cambio de contraseña (soporta PKCE, token_hash y OTP)
│   │   ├── callback/route.ts           # Route Handler unificado para intercambiar código/token por sesión
│   │   └── admin-setup/page.tsx        # Creación del primer administrador protegido por ADMIN_SETUP_CODE
│   ├── onboarding/                     # Flujo guiado de 4 pasos para nuevos asesorados
│   ├── admin/                          # Portal del Coach / Administrador
│   │   ├── layout.tsx                  # Verificación de rol admin + redirección a /admin/onboarding si aplica
│   │   ├── onboarding/                 # Configuración inicial del gimnasio/marca en 2 pasos
│   │   ├── dashboard/                  # Vista ejecutiva de asesorados, alertas, KPIs y gráfica semanal
│   │   ├── clients/                    # Directorio, creación, asignaciones y Hub 360° (/admin/clients/[clientId])
│   │   ├── routines/                   # Catálogo de rutinas, clonación, asignación rápida y Constructor Visual (/admin/routines/builder)
│   │   ├── exercises/                  # Catálogo bilingüe de 1,330+ ejercicios, creación y edición paso a paso con GIF en R2
│   │   ├── payments/                   # Gestión de cobros, estados efectivos por vigencia, descuentos y renovación en 1 clic
│   │   ├── invitations/                # Generación y administración de códigos de invitación
│   │   ├── messages/                   # Inbox de chat en tiempo real con todos los asesorados
│   │   └── settings/                   # Configuración de marca, Planes y Tarifas, perfil del coach y Web Push
│   ├── client/                         # Portal del Asesorado
│   │   ├── layout.tsx                  # Verificación de rol client, vigencia efectiva de membresía y onboarding
│   │   ├── dashboard/                  # Nivel/XP, racha, próximo entrenamiento, estado de membresía, gráfica e hitos
│   │   ├── routines/                   # Rutina activa, visor de técnica, cambio de ejercicio y cambio de día
│   │   ├── workout/start/              # Sesión de entrenamiento en vivo con cronómetro y sensación post-entreno (1–5)
│   │   ├── workout/summary/            # Resumen de sesión, PRs, desglose de series, logros y auto-progresión
│   │   ├── workouts/                   # Historial filtrable por rango de fechas
│   │   ├── progress/                   # Analítica de fuerza y volumen por ejercicio + insights
│   │   ├── measurements/               # Registro y gráficas de 7 medidas corporales
│   │   ├── photos/                     # Galería en R2 y comparador interactivo Antes / Después
│   │   ├── calendar/                   # Calendario mensual de entrenamientos
│   │   ├── achievements/               # Vitrina de logros, medallas y rachas
│   │   ├── messages/                   # Chat directo en tiempo real con el Coach (VisualViewport mobile-safe)
│   │   └── profile/                    # Perfil físico/médico, membresía e historial de pagos, reporte de dolor y Web Push
│   ├── receptionist/                   # Portal de Recepción (dashboard, check-in, clientes, pagos)
│   └── actions/                        # Server Actions protegidas en servidor
│       ├── clients.ts                  # Creación/edición/suspensión de clientes
│       ├── exercises.ts                # Creación y edición de ejercicios (`createAdminExercise`, `updateAdminExercise`) con pasos numerados y GIF en R2
│       ├── gym-settings.ts             # Configuración del gym, perfil del coach y CRUD de membership_plans
│       ├── invitations.ts              # Generación y revocación de invitaciones
│       ├── measurements.ts             # Registro de medidas antropométricas y chequeo de logros
│       ├── messages.ts                 # Envío de mensajes, marcado de lectura y notificación Push con ServiceRole
│       ├── onboarding.ts               # Finalización de onboarding (cliente/admin), email de bienvenida y Push
│       ├── payments.ts                 # Registro/actualización de pagos, sincronización inteligente de membresía, email y Push
│       ├── profile.ts                  # Actualización de perfil y avatar del cliente
│       ├── r2-storage.ts               # Generación de Presigned URLs (PUT/GET) y borrado seguro en Cloudflare R2 (incluye `exercises/`)
│       ├── routine-assignment.ts       # Asignación de rutinas (`assignRoutineToClient`) y cálculo de `getNextWorkoutDay`
│       ├── routine-builder.ts          # Guardado, edición no destructiva (`updateRoutineFromBuilder`) y clonación (`cloneRoutine`)
│       ├── routine-overrides.ts        # Sustitución de ejercicios, reportes de dolor y resolución clínica
│       ├── schedule-override.ts        # Cambio temporal del próximo día de entrenamiento (`override_next_day_id`)
│       ├── web-push.ts                 # Suscripción y baja de endpoints Web Push del usuario autenticado
│       └── workout.ts                  # Guardado de sesiones, series, PRs, XP/rachas y resumen de sesión
```

---

## Modelo de Base de Datos (19 Tablas en `public`)

Definido íntegramente en [`supabase/supabase_schema_dump.sql`](../supabase/supabase_schema_dump.sql):

### 1. Identidad, Administración y Pagos
- **`profiles`**: Extiende `auth.users` (`id`, `email`, `full_name`, `role` [`admin` | `client` | `receptionist`], `avatar_url`, `phone`, `birth_date`, `gender`, `bio`, `specialties`, `certifications`, `onboarding_completed`).
- **`clients`**: Ficha integral del asesorado (`user_id`, `coach_id`, `full_name`, `email`, `status`, `membership_plan_id`, `membership_status`, `membership_start_date`, `membership_end_date`, `assigned_routine_id`, `weight`, `height_cm`, `fitness_goal`, `experience_level`, `injuries`, `medical_conditions`, `notes`, `xp`, `level`, `current_streak`, `longest_streak`, `last_workout_date`, `last_session_at`).
- **`membership_plans`**: Planes y tarifas configurables por el coach (`name`, `description`, `price`, `duration_days`, `features`, `is_active`).
- **`payments`**: Historial financiero (`client_id`, `membership_plan_id`, `amount`, `payment_method`, `status`, `paid_at`, `period_start`, `period_end`, `notes`, `registered_by`).
- **`invitation_codes`**: Códigos de acceso para nuevos clientes o coaches (`code`, `coach_id`, `client_id`, `for_role`, `email`, `client_name`, `plan_id`, `status`, `expires_at`, `used_by`).
- **`gym_settings`**: Configuración del gimnasio/marca por coach (`coach_id`, `gym_name`, `phone`, `address`, `business_hours`, `currency`, `timezone`, `logo_url`).
- **`admin_setup`**: Registro de auditoría de activación del administrador inicial.

### 2. Rutinas, Ejercicios y Personalización Dinámica
- **`exercises`**: Catálogo de 1,330+ ejercicios con columnas bilingües (`name` / `name_es`, `body_parts` / `body_parts_es`, `target_muscles` / `target_muscles_es`, `secondary_muscles` / `secondary_muscles_es`, `equipments` / `equipments_es`, `instructions` / `instructions_es`, `gif_url`, `exercise_type`, `uses_external_load`).
- **`routines`**: Programas de entrenamiento (`coach_id`, `name`, `description`, `duration_weeks`, `days_per_week`, `goal`, `level`, `is_template`, `is_active`).
- **`routine_days`**: Días dentro de una rutina (`routine_id`, `day_number`, `name`, `description`, `is_rest_day`).
- **`routine_exercises`**: Ejercicios prescritos en cada día (`routine_day_id`, `exercise_id`, `order_index`, `sets`, `reps`, `base_weight`, `rest_seconds`, `superset_group`, `notes`).
- **`client_routines`**: Asignación activa o histórica de una rutina a un cliente (`client_id`, `routine_id`, `assigned_by`, `start_date`, `end_date`, `current_week`, `status`, `notes`, `override_next_day_id`).
- **`client_exercise_overrides`**: Sustituciones individuales de ejercicios realizadas por el asesorado o el coach (`client_routine_id`, `original_routine_exercise_id`, `replacement_exercise_id`, `reason`, `changed_by`, `notified_coach`).
- **`routine_week_progress`**: Seguimiento semanal de adherencia y progresión de la rutina asignada.

### 3. Entrenamiento, Progresión Clínica y Gamificación
- **`workout_sessions`**: Sesiones de entrenamiento (`client_id`, `routine_id`, `routine_day_id`, `started_at`, `completed_at`, `duration_minutes`, `total_volume`, `exercises_completed`, `status`, `feeling_score` [1–5], `feeling_note`, `xp_earned`, `prs_count`).
- **`exercise_logs`**: Series registradas (`workout_session_id`, `routine_exercise_id`, `exercise_id`, `set_number`, `weight_kg`, `reps`, `duration_seconds`, `rpe`, `is_warmup`, `completed`, `is_pr`, `notes`).
- **`personal_records`**: Récord personal vigente por cliente y ejercicio (`client_id`, `exercise_id`, `max_weight`, `max_reps_at_weight`, `estimated_1rm`, `achieved_at`, `previous_max_weight`).
- **`pr_events`**: Historial cronológico de cada récord batido para gráficas de progreso.
- **`client_pain_reports`**: Reportes clínicos de dolor o molestia física (`client_id`, `body_part`, `severity` [1–10], `notes`, `active`, `reported_at`, `resolved_at`).
- **`achievements`** y **`user_achievements`**: Catálogo de medallas y logros desbloqueados por usuario.

### 4. Antropometría, Fotos, Chat y Notificaciones Push
- **`body_measurements`**: Historial de 7 medidas corporales (`weight`, `body_fat_pct`, `waist_cm`, `hip_cm`, `chest_cm`, `arm_cm`, `thigh_cm`, `recorded_at`).
  - **Arquitectura de Fechas Timezone-Safe**: Las fechas de registro se persisten a mediodía UTC (`${date}T12:00:00Z`) y se parsean mediante `parseRecordedDate` (`lib/calendar-date.ts`) extrayendo `YYYY-MM-DD` a las 12:00 locales. Esto previene que husos horarios occidentales (ej. UTC-6 Ciudad de México) desplacen la fecha al día anterior.
  - **Selector UI**: Utiliza el `DatePicker` de shadcn en lugar de inputs nativos heterogéneos.
  - **Gráficas y Paginación**: Selector horizontal de métricas en pastillas deslizables (`overflow-x-auto no-scrollbar`), radar corporal sin hueco interior (`radialArea` con `domain([0, domainMax])`), y paginación client-side de 8 registros por página en el historial para evitar bloat del DOM.
- **`progress_photos`**: Metadatos de fotos de progreso (`client_id`, `photo_url`, `category` [`front` | `side` | `back`], `weight_kg`, `notes`, `taken_at`).
- **`messages`**: Mensajería directa en tiempo real (`from_user_id`, `to_user_id`, `content`, `is_read`, `created_at`).
- **`push_subscriptions`**: Suscripciones Web Push VAPID por dispositivo (`user_id`, `endpoint`, `p256dh`, `auth`).

---

## Flujos Clave de Ingeniería

### 1. Ciclo Cerrado Coach $\leftrightarrow$ Asesorado
1. **Prescripción**: El coach diseña la rutina en `/admin/routines/builder` (con soporte de biseries A–E) y la asigna al cliente (`assignRoutineToClient`). El cliente recibe correo por Resend y notificación Web Push (`notifyUser`).
2. **Adaptación en Piso**: Si una máquina está ocupada o el cliente siente molestia, puede intercambiar el ejercicio (`swapExerciseForClient`) o cambiar el día a entrenar hoy (`setNextRoutineDayOverride`). El coach recibe una notificación Push inmediata y ve las sustituciones activas en la pestaña **Rutina** del perfil del cliente, pudiendo revertirlas en cualquier momento (`revertExerciseOverride`).
3. **Ejecución y Feedback**: Al terminar su sesión en `/client/workout/start`, el cliente califica su sensación de esfuerzo (`1–5`) y deja una nota opcional. `completeWorkoutSession` guarda las series en lote, detecta PRs, otorga XP/racha, limpia `override_next_day_id`, avisa al coach por Push y muestra el resumen en `/client/workout/summary`.
4. **Protección Clínica por Dolor**: Si el cliente registra una molestia en `/client/profile` (`reportClientPain`), el motor de auto-progresión (`lib/auto-progression.ts`) bloquea aumentos automáticos de peso en los grupos musculares afectados cuando `severity >= 4`, y el coach visualiza una alerta roja en la parte superior de `/admin/clients/[clientId]` hasta marcarla como resuelta (`resolveClientPainReport`).

### 2. Seguridad y Almacenamiento en Cloudflare R2
- Todas las operaciones sobre Cloudflare R2 pasan por [`app/actions/r2-storage.ts`](../app/actions/r2-storage.ts).
- Antes de firmar una URL de subida/lectura (`getR2PresignedUrl`) o eliminar un objeto (`deleteR2Object`), el servidor verifica que el usuario sea `admin` o que el prefijo del archivo (`clients/{clientId}/`, `progress-photos/{clientId}/` o `avatars/{userId}/`) pertenezca estrictamente al usuario autenticado, bloqueando cualquier intento de *path traversal* (`..`).

### 3. Notificaciones Web Push (`lib/push.ts` + `app/sw.ts`)
- [`lib/push.ts`](../lib/push.ts) está protegido con `import "server-only"` y expone `notifyUser(userId, payload)` para ser invocado exclusivamente desde Server Actions autenticadas.
- Si un endpoint devuelve HTTP `404` o `410` (suscripción expirada o revocada en el navegador), se elimina automáticamente de `public.push_subscriptions`.
- **Apilamiento Inteligente Tipo WhatsApp (`app/sw.ts`)**: El Service Worker agrupa notificaciones consecutivas del mismo remitente (por ejemplo, `"Dileri (3 mensajes)"`), concatenando las líneas más recientes y utilizando la etiqueta (`tag`) del usuario para no saturar la bandeja del sistema operativo.
- **Nombre Real del Remitente**: Las alertas push de mensajería utilizan el nombre real del coach o cliente remitente (`profile.full_name`) en lugar de textos genéricos o fijos.

### 4. Motor Biomecánico y Modelos Fisiológicos (`lib/anatomy/*`)
- **Taxonomía Canónica (18 Músculos)**: Basada en la arquitectura de `open-gym`, traduce las nomenclaturas heterogéneas de la base de datos a un conjunto ortogonal de 18 grupos musculares primarios y secundarios.
- **Ponderación de Volumen**: Cada serie efectiva asigna 1.0 (100%) al músculo objetivo primario (`target_muscle`) y 0.4 (40%) a cada músculo secundario sinergista (`secondary_muscles`). Las series de calentamiento/aproximación (`is_warmup`) se excluyen estrictamente del volumen de fatiga acumulada.
- **Modelo de Fatiga Neuromuscular (Half-Life Decay)**: Decaimiento exponencial $R(t) = e^{-\lambda \cdot t}$, donde $\lambda = \frac{\ln(2)}{t_{1/2}}$ con semividas fisiológicas diferenciadas por grupo (pecho/espalda/cuádriceps 48h, brazos 36h, core/pantorrillas 24h).
- **Modelo de Retención de 1RM (Fitness-Fatigue Decay)**: Meseta de mantenimiento de 14 días sin pérdidas, seguida de decaimiento con semivida de 28 días acotado por un suelo fisiológico del 50% ($0.5$).
- **Renderizado SVG Reactivo**: El componente [`BodyMap`](../components/anatomy/body-map.tsx) aísla silueta inerte (`.bm-sil`) de músculos activos (`.bm-m.l0..l4`), utilizando la paleta dorada/ámbar de RU Coach con trazado de juntas nítidas (`stroke: var(--card)`).
- Documentación completa en [`docs/ANATOMY_AND_BIOMECHANICS.md`](./ANATOMY_AND_BIOMECHANICS.md).

### 5. Arquitectura SPA de Cero Latencia y Rendimiento Nativo Móvil
- **Caché Progresivo con Serwist (`app/sw.ts`)**: Estrategia Stale-While-Revalidate para catálogos y llamadas estáticas, Cache-First para fuentes y recursos visuales (GIFs y avatares), y Network-First con fallback offline para rutas de navegación.
- **Eliminación de Skeletons Parpadeantes**: Eliminación de sub-archivos `loading.tsx` en rutas hijas de clientes (`dashboard`, `routines`, `workouts`, `messages`, `progress`) para evitar parpadeos grises durante el cambio de pestañas, manteniendo una navegación SPA instantánea.
- **Temporizador de Descanso Flotante Minimizable (`workout-active-session.tsx`)**: Modal de descanso con opción de minimizar a una barra flotante fija inferior (`⏱ Descanso activo: 1:45 restantes | +30s | Saltar`), permitiendo al atleta explorar la técnica o revisar ejercicios mientras continúa la cuenta regresiva.
- **Reseteo Automático de Scroll (`hooks/use-scroll-reset-on-navigate.ts`)**: Garantiza que al cambiar de pestaña o pantalla móvil, el contenedor principal `#main-content` siempre inicie en la posición superior (`scrollTop = 0`).
- **Compensación de Notch Móvil**: Encabezados sticky con `-mt-[env(safe-area-inset-top)]` para evitar saltos de altura de 47px en dispositivos con Dynamic Island o Notch al hacer scroll.
- **Caché en Memoria y LocalStorage (`lib/local-cache.ts`)**: Búsqueda instantánea de ejercicios y rutinas sin esperar latencia de red, con invalidación por TTL.
- **Transiciones Nativas y Micro-interacciones**: Soporte de CSS View Transitions en Next.js 16, respuesta háptica y táctil inmediata (`active:scale-95`), campos de selección adaptados a dedos (`py-3 text-base`) y respeto estricto de `env(safe-area-inset-bottom)` en la barra de navegación inferior móvil.
