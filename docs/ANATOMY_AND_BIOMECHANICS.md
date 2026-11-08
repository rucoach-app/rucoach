# Biomechanics, Anatomical Engine & Load Analytics — RU Coach

This document details the scientific and technical implementation of the anatomical mapping engine, volume balancing algorithms, neuromuscular fatigue estimation, and 1RM progression formulas embedded in **RU Coach**.

---

## 1. The 18 Canonical Muscle Groups

RU Coach structures its biomechanical calculations around **18 canonical muscle groups** split across anterior (frontal) and posterior (dorsal) projections:

| Code | Anatomical Name (ES) | English Name | Region | Primary Exercises |
|:---|:---|:---|:---:|:---|
| `chest` | Pectorales | Chest / Pectorals | Torso Frontal | Bench press, dips, cable flyes |
| `upper_chest` | Pectoral Superior | Clavicular Pectoral | Torso Frontal | Incline dumbbell press, low-to-high cable |
| `lats` | Dorsales | Latissimus Dorsi | Torso Dorsal | Pull-ups, lat pulldowns, barbell rows |
| `upper_back` | Espalda Alta / Romboides | Upper Back / Rhomboids | Torso Dorsal | Face pulls, chest-supported rows |
| `traps` | Trapecios | Trapezius | Cuello / Hombro | Shrugs, deadlifts, upright rows |
| `shoulders_front`| Deltoides Anterior | Anterior Deltoid | Hombro | Overhead press, front raises |
| `shoulders_side` | Deltoides Lateral | Lateral Deltoid | Hombro | Lateral raises, cable upright raises |
| `shoulders_rear` | Deltoides Posterior | Posterior Deltoid | Hombro | Reverse flyes, face pulls |
| `biceps` | Bíceps Braquial | Biceps Brachii | Brazo | Barbell curls, hammer curls |
| `triceps` | Tríceps Braquial | Triceps Brachii | Brazo | Skull crushers, tricep pushdowns |
| `forearms` | Antebrazos | Forearms | Brazo | Wrist curls, farmer's walks |
| `abs` | Abdominales | Rectus Abdominis | Core | Cable crunches, hanging leg raises |
| `obliques` | Oblicuos | Obliques | Core | Woodchoppers, side planks |
| `lower_back` | Lumbares | Erector Spinae | Espalda Baja | Deadlifts, hyperextensions |
| `quads` | Cuádriceps | Quadriceps | Pierna Frontal | Squats, leg extensions, leg press |
| `hamstrings` | Isquiotibiales | Hamstrings | Pierna Dorsal | Romanian deadlifts, leg curls |
| `glutes` | Glúteos | Gluteus Maximus / Medius | Cadera / Dorsal | Hip thrusts, Bulgarian split squats |
| `calves` | Gemelos / Sóleo | Gastrocnemius & Soleus | Pierna Baja | Standing calf raises, seated calf raises |

---

## 2. 2D Vector BodyMap Architecture (`components/anatomy/body-map.tsx`)

The visual anatomical representations in RU Coach are rendered using pure mathematical SVG vector paths with dynamic color interpolation based on normalized weekly stimulation volume.

```mermaid
flowchart LR
    Routine["Prescribed or Logged Sets"] --> Aggregator["Anatomy Engine (lib/anatomy/aggregator.ts)"]
    Aggregator --> Weights["Volume Splitter\nPrimary: 1.0x\nSecondary: 0.4x"]
    Weights --> Normalizer["Normalize (0.0 to 1.0)\nAgainst Weekly Targets"]
    Normalizer --> SvgRenderer["Vector BodyMap Component (SVG)\nFrontal & Dorsal Canvas"]
    SvgRenderer --> UI["Dynamic Color Coding\nGray (0%) -> Gold/Amber (100%) -> Crimson (+130%)"]
```

### Path Activation Mechanics:
Each SVG polygon carries an `id` mapped to one of the 18 canonical muscle codes. The renderer computes an activation coefficient $\alpha \in [0, 1]$ and dynamically maps it to CSS HSL color stops matching the RU Coach branding palette:
- **Inactive ($\alpha = 0$)**: Subtle zinc outline (`hsl(240, 5%, 26%)`).
- **Optimal Volume ($0.7 \le \alpha \le 1.0$)**: Vibrant athletic amber / gold (`hsl(45, 93%, 47%)`).
- **Overreaching ($\alpha > 1.2$)**: Warning red/orange highlight denoting excessive weekly volume.

---

## 3. Volume Balancing Algorithm

RU Coach differentiates between **direct (primary)** muscle stimulation and **indirect (secondary / synergistic)** muscular recruitment.

$$\text{Effective Weekly Sets}(M) = \sum_{e \in E_p(M)} \text{Sets}(e) \cdot 1.0 + \sum_{e \in E_s(M)} \text{Sets}(e) \cdot 0.4$$

Where:
- $E_p(M)$ is the set of exercises where muscle $M$ is the primary prime mover.
- $E_s(M)$ is the set of exercises where muscle $M$ functions as a secondary stabilizer or synergist.
- **Example**: In a standard *Barbell Bench Press* with 4 working sets:
  - Pectorals receive **4.0 effective sets** ($\times 1.0$).
  - Anterior Deltoids and Triceps receive **1.6 effective sets** ($\times 0.4$).

---

## 4. Neuromuscular Fatigue & Recovery Time Estimation

To assist the coach in preventing athlete overtraining, RU Coach calculates an estimated neuromuscular fatigue index based on movement complexity, external load, and the athlete's reported RPE (Rate of Perceived Exertion).

### Recovery Timeline Calculation:
$$\text{Recovery Hours}(M) = \text{BaseHours}(M) \cdot \left(1 + \frac{\text{LoggedVolume} - \text{TargetVolume}}{\text{TargetVolume}} \cdot 0.5\right) \cdot \text{RPE\_Factor}$$

Where:
- Compound movements involving high systemic load (e.g. Squat, Deadlift) assign higher baseline CNS recovery periods (48–72h).
- Isolation movements (e.g. Bicep Curls, Lateral Raises) assign faster local recovery windows (24–36h).
- Physiological decay is calculated in real time: as hours elapse since `last_workout_at`, the fatigue score decays logarithmically until returning to the baseline ready state.

---

## 5. One-Repetition Maximum (1RM) Formulas

RU Coach automatically tracks personal strength records without requiring athletes to perform dangerous true 1RM maximum attempts. When an athlete logs $w$ kilograms for $r$ repetitions ($1 < r \le 12$), the platform calculates the theoretical 1RM using the hybrid **Epley / Brzycki** standard:

### Epley Formula ($r > 5$):
$$\text{1RM}_{\text{Epley}} = w \cdot \left(1 + \frac{r}{30}\right)$$

### Brzycki Formula ($2 \le r \le 5$):
$$\text{1RM}_{\text{Brzycki}} = w \cdot \frac{36}{37 - r}$$

When a calculated 1RM exceeds the athlete's previous threshold in `public.personal_records`, the engine:
1. Updates the historical high in `public.personal_records`.
2. Inserts an immutable milestone event into `public.pr_events`.
3. Flags `exercise_logs.is_personal_record = true`.
4. Triggers celebratory haptic feedback and sound on the athlete's mobile device.
