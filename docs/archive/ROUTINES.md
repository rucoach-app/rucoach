# Guía de Rutinas y Prescripción — RU Coach

## Índice
- [Constructor Visual de Rutinas (`/admin/routines/builder`)](#constructor-visual-de-rutinas-adminroutinesbuilder)
- [Biseries y Superseries (Grupos A–E)](#biseries-y-superseries-grupos-ae)
- [Asignar Rutinas a Asesorados](#asignar-rutinas-a-asesorados)
- [Flexibilidad en Piso: Cambio de Ejercicio y Cambio de Día](#flexibilidad-en-piso-cambio-de-ejercicio-y-cambio-de-día)
- [Estructuras Recomendadas](#estructuras-recomendadas)

---

## Constructor Visual de Rutinas (`/admin/routines/builder`)

### Paso a Paso para Crear o Editar una Rutina

1. Entra a **Panel del Coach → Rutinas** (`/admin/routines`) y haz clic en **"+ Nueva Rutina (Builder)"** (o **"Editar"** dentro de una rutina existente).
2. Define los metadatos principales del programa:
   - **Nombre de la rutina**: ej. *"Hipertrofia 12 Semanas — Upper/Lower"*
   - **Objetivo (`goal`)**: *Ganancia muscular*, *Pérdida de grasa*, *Fuerza / Tonificación*, *Resistencia* o *Mantenimiento*
   - **Nivel (`level`)**: *Principiante*, *Intermedio* o *Avanzado* (normalizado automáticamente entre claves en inglés y etiquetas en español mediante `lib/constants.ts`)
   - **Duración (`duration_weeks`)**: Número de semanas del bloque (ej. `8` o `12`), o bien **"Rutina continua (sin semanas fijas)"** (`duration_weeks = null`). En planes continuos, la vigencia depende directamente de la membresía activa del atleta, evitando desorientación por conteos de semanas artificiales.
   - **Descripción**: Indicaciones generales del bloque para el asesorado
3. **Configura cada Día de la Semana**:
   - Puedes alternar cada día entre **Día de Entrenamiento** o **Día de Descanso Activo / Total** (`is_rest_day`). El sistema calcula automáticamente `days_per_week` contando únicamente los días efectivos de entrenamiento.
   - Asigna un **Nombre del día** (ej. *"Día 1 — Torso A"*) y un **Enfoque del día (`focus`)** (ej. *"Empuje: Pecho, Hombros y Tríceps"*).
   - Visualiza en tiempo real el contador de volumen por día (`X ej. · Y series`) y el volumen semanal total (`Z series / sem`) en la cabecera del plan.
4. **Agrega, Inspecciona y Ordena Ejercicios**:
   - Abre el selector conectado al catálogo de **1,324+ ejercicios en español** con soporte de **"Mapa Muscular"** interactivo para filtrar visualmente tocando el grupo anatómico deseado.
   - **Vista previa técnica (`ExerciseDetailDrawer`)**: Haz clic en el ícono de ojo (`Eye`) o en la miniatura de cualquier ejercicio (tanto en el selector como dentro del día) para abrir su ficha técnica con GIF demostrativo, músculos trabajados e instrucciones paso a paso sin salir del Builder.
   - Reordena los ejercicios arrastrándolos desde el ícono lateral (`@dnd-kit`, compatible en desktop y pantallas táctiles móviles con layout responsivo de dos filas que evita truncar textos largos).
   - Para cada ejercicio configura:
     - **Series (`sets`)**: ej. `3` o `4` (series efectivas de trabajo)
     - **Series de aproximación (`warmup_sets`)**: Campo opcional y discreto (ej. `1x12 al 50%, 1x8 al 70%`) para prescribir calentamiento o series de aproximación (*feeder sets*) sin distorsionar el volumen efectivo ni los récords del atleta.
     - **Repeticiones (`reps`)**: por defecto `10-12` (admite rangos como `8-10`, `12-15` o `Fallo`)
     - **Descanso (`rest_seconds`)**: ej. `90` segundos
     - **Grupo de Biserie / Superserie (`superset_group`)**: `A`, `B`, `C`, `D`, `E` o sin agrupar
     - **Notas / Indicaciones del ejercicio (`notes`)**: Botón desplegable por ejercicio para agregar indicaciones específicas de ejecución (ej. *"Pausa de 2s en máximo estiramiento, RIR 1"*), visibles para el asesorado en su rutina.
5. **Cobertura Muscular en Vivo (`WeeklyMuscleCoverage`)**:
   - En la parte inferior del constructor se proyecta en tiempo real el mapa corporal anatómico de Open-Gym y el ranking de series efectivas ponderadas (100% primario / 40% secundario), alertando sobre músculos descuidados antes de guardar el programa.
6. **Guardar Rutina**:
   - **Edición No Destructiva (`updateRoutineFromBuilder`)**: Al editar una rutina existente, el servidor reutiliza los `routine_days.id` existentes por `day_number` y migra los reemplazos activos (`client_exercise_overrides`) a los nuevos IDs de `routine_exercises`. Esto garantiza que los asesorados que ya entrenan con esa rutina **no pierdan la secuencia de su próximo día (`workout_sessions.routine_day_id`) ni sus adaptaciones de ejercicios**.

---

## Biseries y Superseries (Grupos A–E)

El constructor soporta agrupación visual y funcional de ejercicios mediante la columna `superset_group` (`A` a `E`):
- Si asignas la misma letra (por ejemplo, **Grupo A**) a dos o más ejercicios del mismo día, tanto en `/client/routines` como durante la sesión activa en `/client/workout/start` aparecerán identificados con su insignia de color (**Biserie / Superserie A**).
- Esto indica al asesorado que debe alternar las series entre ambos ejercicios antes de tomar el descanso largo.

---

## Asignar y Duplicar Rutinas

### 1. Asignación Rápida a Asesorados (`AssignRoutineModal`)
Puedes asignar una rutina desde tres puntos:
- **El listado de rutinas (`/admin/routines`)** haciendo clic en **"Asignar"** en la barra de acciones rápidas de cualquier tarjeta.
- **La vista de detalle de la rutina (`/admin/routines/[routineId]`)** haciendo clic en **"Asignar"** en la cabecera (donde también puedes ver la lista de asesorados que entrenan actualmente con ese plan).
- **El perfil del asesorado (`/admin/clients/[clientId]`)** haciendo clic en **"Cambiar rutina"** (`/admin/clients/[clientId]/assign-routine`).

Al asignar una rutina (`assignRoutineToClient` en [`app/actions/routine-assignment.ts`](../app/actions/routine-assignment.ts)):
1. Cualquier rutina activa previa del cliente en `client_routines` pasa automáticamente a `is_active = false` (`status = 'completed'`).
2. Se crea el nuevo registro activo en `client_routines` y se sincroniza `clients.assigned_routine_id`.
3. Se revalidan inmediatamente `/admin/routines`, `/admin/routines/[routineId]`, `/admin/clients/[clientId]`, `/client/routines` y `/client/dashboard`.
4. Se envía automáticamente al asesorado:
   - Un **correo transaccional** (`NewRoutineEmail.tsx`) vía Resend.
   - Una **notificación Web Push** inmediata a su dispositivo (`lib/push.ts`).

### 2. Duplicar / Clonar Rutina (`cloneRoutine`)
- Desde `/admin/routines` o `/admin/routines/[routineId]`, haz clic en **"Duplicar"** (`Copy`).
- El servidor crea una copia exacta (`"[Nombre] (Copia)"`) con todos sus días, enfoque (`focus`), ejercicios, series, repeticiones, descansos, notas y biseries (`superset_group`), ideal para crear variaciones personalizadas por atleta a partir de una plantilla base.

---

## Flexibilidad en Piso: Cambio de Ejercicio y Cambio de Día

Para que el asesorado nunca pierda su entrenamiento por imprevistos en el gimnasio, **RU Coach** incluye dos herramientas controladas con trazabilidad completa para el coach:

### 1. Intercambio de Ejercicio (`ExerciseSwapDrawer` / `client_exercise_overrides`)
- Desde `/client/routines` o en pleno entrenamiento (`/client/workout/start`), el asesorado puede tocar el botón de **Intercambiar ejercicio**.
- El sistema sugiere ejercicios equivalentes del mismo grupo muscular primario (`getSwapSuggestions`).
- El asesorado elige el ejercicio sustituto y el motivo (*Equipo ocupado*, *Molestia/lesión*, *No disponible en mi gym* o *Preferencia*).
- **Impacto**:
  - Se guarda en `public.client_exercise_overrides` sin alterar la plantilla original de otros clientes.
  - Las series y récords personales se registran bajo el `exercise_id` del ejercicio sustituto para no contaminar la estadística del ejercicio original.
  - El coach recibe una **notificación Push** inmediata y visualiza todas las sustituciones activas en la pestaña **Rutina** de `/admin/clients/[clientId]`, con un botón **"Restaurar original"** (`revertExerciseOverride`) para volver al ejercicio base cuando lo considere oportuno.

### 2. Cambio del Día a Entrenar Hoy (`ScheduleOverrideDialog` / `override_next_day_id`)
- Si al asesorado le tocaba *"Día 1 — Pierna"* pero necesita hacer *"Día 2 — Torso"* hoy, puede cambiar el día activo:
  - **Desde el Dashboard (`NextWorkoutCard`)**: Con el botón **"Cambiar día"**, se abre directamente el diálogo sin salir de la pantalla principal y recarga el día seleccionado en tiempo real (`router.refresh()`).
  - **Desde `/client/routines`**: Mediante el botón superior de "Cambiar sesión".
- **Opciones disponibles**:
  1. *Adelantar sesión*: Salta al siguiente día del ciclo.
  2. *Repetir sesión anterior*: Vuelve a ejecutar la última sesión completada.
  3. *Elegir un día específico*: Permite seleccionar cualquier día entrenable de la rutina activa.
- Esto actualiza `client_routines.override_next_day_id` y notifica al coach.
- Una vez que el asesorado completa la sesión en `/client/workout/start`, `completeWorkoutSession` limpia automáticamente `override_next_day_id = null` para que el ciclo normal de días continúe en la siguiente sesión.

---

## Lógica de Microciclos y Periodización Óptima (`lib/next-routine-day.ts`)

En el entrenamiento de fuerza y sobrecarga progresiva basado en evidencia, **el plan de entrenamiento avanza sesión a sesión por rotación secuencial**, no como un candado rígido de calendario:

1. **¿Por qué NO se salta días por calendario automáticamente?**
   - Si un atleta tiene un plan de 4 días (Día 1 Torso, Día 2 Pierna, Día 3 Empuje, Día 4 Tirón) y el coach nombró al Día 1 como "Lunes"...
   - Si por trabajo o descanso el atleta asiste al gimnasio el **Viernes**, la app le sugiere el **Día 1 (Torso)**.
   - Si la app se saltara días según el día de la semana actual, el atleta se saltaría 3 entrenamientos completos, dejando grupos musculares clave sin estímulo durante semanas y rompiendo el equilibrio corporal.
   - Por ello, la app avanza con cada sesión completada (`getNextRoutineDay` evalúa la última sesión completada y entrega el siguiente bloque entrenable).
2. **Claridad en la Interfaz**:
   - Para evitar confusiones cuando un día asignado como "Lunes" se entrena en viernes, la cabecera muestra la fecha real del día (`VIERNES, 23 OCT`), el kicker `PRÓXIMA SESIÓN EN TU ROTACIÓN`, el número del día (`Día 1`) y una etiqueta sutil `Plantilla: Lunes`, explicando al alumno que el plan progresa en orden sesión a sesión.
   - Si el atleta desea deliberadamente entrenar otro bloque hoy, el botón **"Cambiar día"** le permite sobrescribirlo con 1 toque.

---

## Diseño Mobile-First de la Rutina (`app/client/routines/client-routines-content.tsx`)

Para garantizar una experiencia fluida tipo aplicación nativa en dispositivos móviles (375px–430px):

1. **Tarjetas Horizontales Compactas**:
   - Cada ejercicio se organiza en una fila horizontal:
     - **Miniatura izquierda (`size-16 sm:size-18`)**: GIF del ejercicio en Cloudflare R2 con carga progresiva y fallback de imagen estática.
     - **Columna central (`flex-1`)**: Título en hasta 2 líneas (`line-clamp-2`), badge de sustitución (`Cambiado`) y métricas de series y repeticiones (`3 series · 8-15 reps`).
     - **Acciones derecha**: Botón circular de cambio de ejercicio (`RefreshCw`) y botón de guía técnica (`Info`).
   - Reduce la altura vertical de la lista en más del **55%**, eliminando el scroll excesivo.
2. **Desglose de Cobertura Muscular (`WeeklyMuscleCoverage`)**:
   - **Proporción de estímulo relativo**: Muestra el porcentaje (`100%`, `87%`...) respecto al grupo muscular con mayor volumen de la sesión.
   - **Activación primaria vs secundaria**: Calcula series efectivas asignando 100% al músculo principal y 40% a los sinergistas/estabilizadores.
   - **Leyenda pedagógica**: Explica al atleta el cálculo de series fraccionadas (ej. 4.6 series) y evita cualquier corte de texto (`Foco: Hombros`).

---

---

## Estructuras Recomendadas

### Full Body (3 días / semana — Principiantes)
- **Día 1**: Cuerpo Completo A (énfasis sentadilla y empuje horizontal)
- **Día 2**: Descanso
- **Día 3**: Cuerpo Completo B (énfasis bisagra de cadera y tracción vertical)
- **Día 4**: Descanso
- **Día 5**: Cuerpo Completo C (énfasis unilateral e hipertrofia accesoria)

### Upper / Lower (4 días / semana — Intermedios)
- **Día 1**: Torso Fuerza (Press Banca, Remo con Barra, Press Militar, Dominadas)
- **Día 2**: Pierna Fuerza (Sentadilla, Peso Muerto Rumano, Prensa, Pantorrilla)
- **Día 3**: Descanso
- **Día 4**: Torso Hipertrofia (Press Inclinado Mancuernas, Jalón, Elevaciones Laterales, Brazos en Biserie A)
- **Día 5**: Pierna Hipertrofia (Hack Squat, Hip Thrust, Extensión de Cuádriceps + Curl Femoral en Biserie A)

### Push / Pull / Legs (6 días / semana — Avanzados)
- **Día 1**: Push (Pecho, Hombros, Tríceps)
- **Día 2**: Pull (Espalda, Trapecio, Bíceps)
- **Día 3**: Legs (Cuádriceps, Isquiosurales, Glúteo, Pantorrilla)
- **Día 4**: Descanso
- **Día 5**: Push Variación
- **Día 6**: Pull Variación
- **Día 7**: Legs Variación

---

[Volver a Documentación Principal](./README.md)
