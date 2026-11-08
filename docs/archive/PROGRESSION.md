# Sistema de Progresión, PRs y Seguridad Clínica — RU Coach

## Índice
- [El Ciclo de Progresión en RU Coach](#el-ciclo-de-progresión-en-ru-coach)
- [Registro en Vivo durante el Entrenamiento (`/client/workout/start`)](#registro-en-vivo-durante-el-entrenamiento-clientworkoutstart)
- [Sensación Post-Entreno (`feeling_score` 1–5) y Feedback al Coach](#sensación-post-entreno-feeling_score-15-y-feedback-al-coach)
- [Detección Automática de Récords Personales (PRs)](#detección-automática-de-récords-personales-prs)
- [Motor de Auto-Progresión (`lib/auto-progression.ts`)](#motor-de-auto-progresión-libauto-progressionts)
- [Barrera de Seguridad Clínica por Reporte de Dolor](#barrera-de-seguridad-clínica-por-reporte-de-dolor)

---

## El Ciclo de Progresión en RU Coach

```text
1. ENTRENAR EN VIVO (/client/workout/start)
   ├─ Referencia inmediata de los sets de la última sesión en ese ejercicio
   ├─ Registro táctil de Peso (kg), Repeticiones / Segundos y RPE (1-10)
   └─ Temporizador de descanso automático con alerta sonora y vibración
        │
        ▼
2. FINALIZAR CON SENSACIÓN POST-ENTRENO (1–5)
   ├─ Calificación de esfuerzo percibido global (Ligero → Al límite)
   └─ Nota opcional para el Coach
        │
        ▼
3. PROCESAMIENTO EN SERVIDOR (completeWorkoutSession)
   ├─ Cálculo de volumen total, XP ganado y racha en días calendario
   ├─ Detección y persistencia en lote de Personal Records (personal_records + pr_events)
   ├─ Evaluación de logros desbloqueados (achievements)
   └─ Notificación Web Push inmediata al Coach
        │
        ▼
4. AUTO-PROGRESIÓN INTELIGENTE (/client/workout/summary)
   ├─ Evalúa si el atleta alcanzó el tope del rango prescrito con RPE controlado
   ├─ Verifica que NO exista un reporte de dolor activo (severity >= 4) en esa región corporal
   └─ Actualiza base_weight (+2.5 kg) para la próxima sesión si es seguro progresar
```

---

## Registro en Vivo durante el Entrenamiento (`/client/workout/start`)

La pantalla de sesión activa ([`workout-active-session.tsx`](../app/client/workout/start/workout-active-session.tsx)) está optimizada para uso con una sola mano en el gimnasio:
- **Historial del Ejercicio en Pantalla**: Consulta los `exercise_logs` de la última sesión completada donde se realizó ese mismo ejercicio (incluso si fue hace varios días) para mostrar qué peso y repeticiones se usaron en cada serie.
- **Adaptación según Tipo de Ejercicio**:
  - **Con carga externa (`uses_external_load = true`)**: Muestra controles `+` / `-` para Peso (`kg`) y Repeticiones, además de selector rápido de RPE (`6`, `7`, `8`, `9`, `10`).
  - **Peso corporal (`bodyweight`)**: Oculta el campo de peso externo innecesario y centra el registro en repeticiones y RPE.
  - **Por tiempo (`timed`)**: Registra la duración en segundos (`duration_seconds`).
- **Soporte para Series de Calentamiento y Aproximación (`is_warmup`)**:
  - En la tarjeta del ejercicio se despliega el bloque de aproximaciones prescrito por el coach.
  - Cada serie cuenta con un botón/indicador de calentamiento (`W` o `is_warmup: true`).
  - **Exclusión Analítica**: Las series de aproximación no se computan dentro del volumen total de trabajo (`total_volume_kg`), no alteran las curvas de fatiga ni computan para Récords Personales (PRs).
- **Persistencia Resiliente (`localStorage`)**: Cada cambio de serie, peso o cronómetro se guarda localmente en el dispositivo (`workout_draft_{clientId}_{dayId}`). Si el navegador móvil se suspende al bloquear la pantalla, el estado se restaura intacto al volver.
- **Edición Flexible**: Una serie marcada como completada puede desmarcarse con un toque para corregir peso o repeticiones antes de finalizar la sesión.
- **Arranque Instantáneo (~375ms)**: La vista `/client/workout/start` carga la rutina, última sesión y marcas personales en una única ola concurrente en servidor (`Promise.all`), eliminando pantallas de carga en blanco o demoras de más de 2.5 segundos.
- **Temporizador de Descanso Minimizable**:
  - Al completar una serie de trabajo se dispara el temporizador con sonido y vibración háptica.
  - El atleta puede **Minimizar** el descanso en una barra flotante inferior persistente (`⏱ Descanso activo: 1:45 restantes | +30s | Saltar`), permitiéndole explorar la rutina, revisar notas o consultar la guía técnica del ejercicio sin interrumpir la cuenta regresiva.
  - El cronómetro de cabecera se etiqueta de forma transparente como `⏱ SESIÓN` para evitar confundirlo con el descanso entre series.
  - La tarjeta muestra un pill informativo secundario `Descanso: 180s` en vez de botones amarillos distractores.

---

## Sensación Post-Entreno (`feeling_score` 1–5), Resumen y Músculos Trabajados

Al pulsar **"Finalizar entrenamiento"**, se abre un diálogo de confirmación que resume las series completadas, el volumen total acumulado y el tiempo transcurrido (advirtiendo si quedaron series sin marcar).

El asesorado selecciona cómo sintió la sesión en una escala de **1 a 5**:
1. **1 — Ligero**: Sesión muy cómoda o de recuperación.
2. **2 — Bien**: Esfuerzo controlado, buena energía.
3. **3 — Exigente**: Trabajo sólido dentro del rango esperado.
4. **4 — Intenso**: Alta demanda física y muscular.
5. **5 — Al límite**: Fatiga máxima al terminar.

Tanto `feeling_score` como `feeling_note` se guardan en `public.workout_sessions` y se muestran con badges semafóricos en la pestaña **Historial** del Hub del Cliente (`/admin/clients/[clientId]`).

### Pantalla de Resumen Post-Entrenamiento (`/client/workout/summary`)
Al confirmar el cierre de sesión:
1. **Músculos Trabajados Hoy (`WeeklyMuscleCoverage`)**: Proyección inmediata del mapa anatómico SVG con las series efectivas completadas por grupo muscular (100% primario / 40% secundario).
2. **Desglose de Series y Récords**: Tarjetas de rendimiento por ejercicio con insignias de PR batido.
3. **Optimización Automática de Cargas**: Cálculo de nuevas sugerencias de peso para el siguiente microciclo.

---

## Detección Automática de Récords Personales (PRs)

Al finalizar la sesión (`completeWorkoutSession` en [`app/actions/workout.ts`](../app/actions/workout.ts)):
- Se filtran las series efectivas completadas (`completed = true`, `is_warmup = false`) en ejercicios que utilizan carga externa (`exerciseUsesExternalLoad`).
- Se calcula el **1RM estimado** mediante la fórmula de Epley:
  $$\text{1RM Estimado} = \text{Peso} \times \left(1 + \frac{\text{Reps}}{30}\right)$$
- Si el peso máximo levantado en el ejercicio supera el `max_weight` histórico registrado en `public.personal_records`:
  1. Se marca la serie con `is_pr = true`.
  2. Se actualiza `public.personal_records` en lote (`upsert` por `client_id, exercise_id`) conservando `previous_max_weight`.
  3. Se inserta el evento en `public.pr_events` para alimentar las gráficas históricas de `/client/progress` y `/admin/clients/[clientId]`.
  4. Se otorgan **+100 XP adicionales** por cada récord personal batido.

---

## Motor de Auto-Progresión (`lib/auto-progression.ts`)

Cuando el asesorado concluye su entrenamiento y llega a `/client/workout/summary`, se ejecuta `evaluateAndApplyAutoProgression(clientId, sessionId)` (solo para sesiones recién finalizadas en los últimos 30 minutos):

1. **Lectura del Rango Prescrito**: Si el ejercicio indica `8-12` repeticiones, el tope del rango (`maxTargetReps`) es `12`.
2. **Criterio de Progresión**:
   - **Subir carga (`increase_weight`, `+2.5 kg`)**: Todas las series de trabajo alcanzaron o superaron `maxTargetReps` con un RPE promedio $\le 8.5$. El sistema actualiza automáticamente `routine_exercises.base_weight` para la siguiente sesión.
   - **Mantener carga (`maintain`)**: Las repeticiones están dentro del rango objetivo con RPE $7–9$.
   - **Sugerencia de descarga (`decrease_weight`)**: El RPE promedio fue $\ge 9.5$ o no se logró el mínimo de repeticiones prescritas.

---

## Barrera de Seguridad Clínica por Reporte de Dolor

La salud articular y muscular del asesorado tiene prioridad sobre cualquier algoritmo de carga:

1. **Reporte por el Asesorado (`/client/profile`)**:
   - El cliente puede registrar en cualquier momento una molestia o dolor físico (`reportClientPain` en [`app/actions/routine-overrides.ts`](../app/actions/routine-overrides.ts)) indicando la zona corporal (Hombro, Rodilla, Espalda baja, Codo, etc.), severidad del `1` al `10` y notas.
2. **Bloqueo Automático de Incremento de Peso**:
   - En [`lib/auto-progression.ts`](../lib/auto-progression.ts), si el cliente tiene un reporte activo en `public.client_pain_reports` con `severity >= 4`, el motor bloquea cualquier incremento automático de peso en el tren afectado (tren superior o tren inferior) y muestra la explicación clínica en el resumen de la sesión.
3. **Resolución por el Coach (`/admin/clients/[clientId]`)**:
   - El coach recibe una notificación Push en el momento del reporte y ve un **Banner Clínico Rojo** en la cabecera del expediente del cliente.
   - Una vez que el coach evalúa al cliente o ajusta su rutina, puede hacer clic en **"Resuelto"** (`resolveClientPainReport`), reactivando la progresión normal.

---

[Volver a Documentación Principal](./README.md)
