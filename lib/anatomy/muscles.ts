/**
 * Muscle taxonomy, canonical aliases, and load calculation for Anatomical Maps
 */


export const MUSCLES = [
  'trapezius',
  'deltoids',
  'chest',
  'upper-back',
  'serratus',
  'biceps',
  'triceps',
  'forearm',
  'abs',
  'obliques',
  'lower-back',
  'gluteal',
  'quadriceps',
  'hamstring',
  'adductors',
  'hip-flexors',
  'calves',
  'tibialis',
] as const

export type MuscleSlug = (typeof MUSCLES)[number]

export const INERT = [
  'head',
  'hair',
  'neck',
  'hands',
  'feet',
  'knees',
  'ankles',
] as const

export type InertPart = (typeof INERT)[number]

export const MUSCLE_NAMES_ES: Record<MuscleSlug, string> = {
  trapezius: 'Trapecios',
  deltoids: 'Hombros / Deltoides',
  chest: 'Pecho / Pectorales',
  'upper-back': 'Espalda alta / Dorsales',
  serratus: 'Serratos',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearm: 'Antebrazos',
  abs: 'Abdomen / Core',
  obliques: 'Oblicuos',
  'lower-back': 'Lumbar / Espalda baja',
  gluteal: 'Glúteos',
  quadriceps: 'Cuádriceps',
  hamstring: 'Femorales / Isquiotibiales',
  adductors: 'Aductores',
  'hip-flexors': 'Flexores de cadera',
  calves: 'Pantorrillas / Gemelos',
  tibialis: 'Tibial anterior',
}

const ALIASES: Record<string, MuscleSlug | null> = {
  // Primaries & common aliases
  abs: 'abs',
  abdominals: 'abs',
  core: 'abs',
  abdomen: 'abs',
  abdominales: 'abs',
  'lower abs': 'abs',
  obliques: 'obliques',
  oblicuos: 'obliques',
  oblicuo: 'obliques',
  pectorals: 'chest',
  pectoral: 'chest',
  pecho: 'chest',
  pectorales: 'chest',
  chest: 'chest',
  'upper chest': 'chest',
  biceps: 'biceps',
  bicep: 'biceps',
  brazos: 'biceps',
  brazo: 'biceps',
  brachialis: 'biceps',
  glutes: 'gluteal',
  glute: 'gluteal',
  gluteal: 'gluteal',
  gluteus: 'gluteal',
  gluteos: 'gluteal',
  gluteo: 'gluteal',
  abductors: 'gluteal',
  abductores: 'gluteal',
  abductor: 'gluteal',
  delts: 'deltoids',
  deltoids: 'deltoids',
  deltoid: 'deltoids',
  deltoides: 'deltoids',
  deltoide: 'deltoids',
  shoulders: 'deltoids',
  shoulder: 'deltoids',
  hombros: 'deltoids',
  hombro: 'deltoids',
  'rear deltoids': 'deltoids',
  'rotator cuff': 'deltoids',
  triceps: 'triceps',
  tricep: 'triceps',
  'upper back': 'upper-back',
  'upper-back': 'upper-back',
  lats: 'upper-back',
  latissimus: 'upper-back',
  'latissimus dorsi': 'upper-back',
  rhomboids: 'upper-back',
  espalda: 'upper-back',
  dorsales: 'upper-back',
  dorsal: 'upper-back',
  'espalda alta': 'upper-back',
  calves: 'calves',
  calf: 'calves',
  soleus: 'calves',
  pantorrillas: 'calves',
  pantorrilla: 'calves',
  gemelos: 'calves',
  gemelo: 'calves',
  quads: 'quadriceps',
  quadriceps: 'quadriceps',
  cuadriceps: 'quadriceps',
  muslo: 'quadriceps',
  muslos: 'quadriceps',
  forearms: 'forearm',
  forearm: 'forearm',
  antebrazos: 'forearm',
  antebrazo: 'forearm',
  wrists: 'forearm',
  hamstrings: 'hamstring',
  hamstring: 'hamstring',
  isquios: 'hamstring',
  isquiotibiales: 'hamstring',
  isquiotibial: 'hamstring',
  femorales: 'hamstring',
  femoral: 'hamstring',
  spine: 'lower-back',
  'lower back': 'lower-back',
  'lower-back': 'lower-back',
  lumbar: 'lower-back',
  lumbares: 'lower-back',
  'espalda baja': 'lower-back',
  traps: 'trapezius',
  trapezius: 'trapezius',
  trapecios: 'trapezius',
  trapecio: 'trapezius',
  'levator scapulae': 'trapezius',
  adductors: 'adductors',
  adductor: 'adductors',
  aductor: 'adductors',
  aductores: 'adductors',
  'inner thighs': 'adductors',
  groin: 'adductors',
  serratus: 'serratus',
  'serratus anterior': 'serratus',
  serratos: 'serratus',
  serrato: 'serratus',
  'hip flexors': 'hip-flexors',
  'hip-flexors': 'hip-flexors',
  'flexores de cadera': 'hip-flexors',
  flexores: 'hip-flexors',
  shins: 'tibialis',
  tibialis: 'tibialis',
  tibial: 'tibialis',
  tibiales: 'tibialis',

  // Inert/undrawables
  hands: null,
  feet: null,
  ankles: null,
  knees: null,
  neck: null,
  'cardiovascular system': null,
}

export function canonicalMuscle(name?: string | null): MuscleSlug | null {
  if (!name) return null
  const cleaned = name.toLowerCase().trim()
  if (MUSCLES.includes(cleaned as MuscleSlug)) return cleaned as MuscleSlug
  if (ALIASES[cleaned] !== undefined) return ALIASES[cleaned]

  // Normalizar acentos y diacríticos (ej. cuádriceps -> cuadriceps, bíceps -> biceps)
  const normalized = cleaned.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  if (MUSCLES.includes(normalized as MuscleSlug)) return normalized as MuscleSlug
  if (ALIASES[normalized] !== undefined) return ALIASES[normalized]

  return null
}

const BY_BODYPART: Record<string, Partial<Record<MuscleSlug, number>>> = {
  chest: { chest: 1 },
  back: { 'upper-back': 0.75, 'lower-back': 0.25 },
  shoulders: { deltoids: 1 },
  'upper arms': { biceps: 0.5, triceps: 0.5 },
  'lower arms': { forearm: 1 },
  waist: { abs: 0.7, obliques: 0.3 },
  'upper legs': { quadriceps: 0.4, hamstring: 0.35, gluteal: 0.25 },
  'lower legs': { calves: 0.8, tibialis: 0.2 },
  neck: { trapezius: 1 },
  'full body': {
    chest: 0.2,
    'upper-back': 0.2,
    gluteal: 0.2,
    quadriceps: 0.2,
    hamstring: 0.1,
    abs: 0.1,
  },
}

export interface ExerciseAnatomyInput {
  id?: string | null
  name?: string | null
  name_es?: string | null
  primary_muscle?: string | null
  secondary_muscles?: string[] | null
  secondary_muscles_es?: string[] | null
  target_muscles_es?: string[] | null
  secondary_muscle?: string | null
  muscle_weights?: Record<string, number> | null
  body_part?: string | null
  body_parts?: string[] | null
  [key: string]: any
}

export function getExerciseMuscleWeights(
  ex: ExerciseAnatomyInput,
): Record<MuscleSlug, number> {
  const result: Partial<Record<MuscleSlug, number>> = {}

  // 1. If explicit muscle_weights jsonb is present
  if (ex.muscle_weights && typeof ex.muscle_weights === 'object') {
    for (const [k, v] of Object.entries(ex.muscle_weights)) {
      const slug = canonicalMuscle(k)
      if (slug && typeof v === 'number' && v > 0) {
        result[slug] = Math.max(result[slug] || 0, v)
      }
    }
    if (Object.keys(result).length > 0) {
      return result as Record<MuscleSlug, number>
    }
  }

  // 2. Primary muscle
  const primarySlug = canonicalMuscle(ex.primary_muscle)
  if (primarySlug) {
    result[primarySlug] = 1.0
  }

  // 3. Secondary muscles from all possible columns (array EN, array ES, string comma-separated)
  const secondaries: string[] = []
  if (Array.isArray(ex.secondary_muscles)) {
    secondaries.push(...ex.secondary_muscles)
  }
  if (Array.isArray(ex.secondary_muscles_es)) {
    secondaries.push(...ex.secondary_muscles_es)
  }
  if (Array.isArray(ex.target_muscles_es)) {
    secondaries.push(...ex.target_muscles_es)
  }
  if (typeof ex.secondary_muscle === 'string') {
    secondaries.push(...ex.secondary_muscle.split(','))
  }

  for (const s of secondaries) {
    const slug = canonicalMuscle(s)
    if (slug && !result[slug]) {
      result[slug] = 0.4
    }
  }

  // 4. Fallback to body_part
  const bp = ex.body_part || ex.body_parts?.[0]
  if (Object.keys(result).length === 0 && bp) {
    const normBp = bp.toLowerCase().trim()
    const mapped = BY_BODYPART[normBp]
    if (mapped) {
      Object.assign(result, mapped)
    }
  }

  return result as Record<MuscleSlug, number>
}

export interface ExerciseLoadItem {
  exercise: ExerciseAnatomyInput
  sets: number
}

/**
 * Calculates effective set volume per muscle
 */
export function calculateMuscleLoad(
  items: ExerciseLoadItem[],
): Record<MuscleSlug, number> {
  const load: Partial<Record<MuscleSlug, number>> = {}

  for (const m of MUSCLES) {
    load[m] = 0
  }

  for (const item of items) {
    if (!item.sets || item.sets <= 0) continue
    const weights = getExerciseMuscleWeights(item.exercise)
    for (const [slug, weight] of Object.entries(weights)) {
      const s = slug as MuscleSlug
      const raw = (load[s] || 0) + (weight || 0) * item.sets
      load[s] = Math.round(raw * 100) / 100
    }
  }

  return load as Record<MuscleSlug, number>
}

export interface ThresholdRule {
  at: number
  level: number
  exclusive?: boolean
}

/**
 * Shade buckets 0–4 per muscle.
 * With no `thresholds`, levels remain relative to the hardest-worked muscle in the same window.
 * When `thresholds` is supplied, levels use an absolute scale (ordered `{ at, level, exclusive? }` rules).
 */
export function levelsOf(
  load: Partial<Record<MuscleSlug, number>>,
  thresholds?: ThresholdRule[],
): Record<MuscleSlug, number> {
  if (thresholds && thresholds.length > 0) {
    const lv: Partial<Record<MuscleSlug, number>> = {}
    for (const m of MUSCLES) {
      const value = Number(load[m] || 0)
      let level = 0
      for (const rule of thresholds) {
        const matches = rule.exclusive ? value > rule.at : value >= rule.at
        if (matches) level = Math.max(0, Math.min(4, rule.level))
      }
      lv[m] = level
    }
    return lv as Record<MuscleSlug, number>
  }

  const max = Math.max(0, ...MUSCLES.map((m) => load[m] || 0))
  const levels: Partial<Record<MuscleSlug, number>> = {}
  for (const m of MUSCLES) {
    const v = load[m] || 0
    if (!v || max <= 0) {
      levels[m] = 0
    } else {
      levels[m] = Math.max(1, Math.min(4, Math.ceil((v / max) * 4)))
    }
  }

  return levels as Record<MuscleSlug, number>
}

/**
 * Muscles sorted hardest-worked first; untrained ones last, in body order.
 */
export function rankOf(load: Partial<Record<MuscleSlug, number>>): {
  worked: MuscleSlug[]
  missed: MuscleSlug[]
} {
  const worked = MUSCLES.filter((m) => (load[m] || 0) > 0).sort(
    (a, b) =>
      (load[b] || 0) - (load[a] || 0) || MUSCLES.indexOf(a) - MUSCLES.indexOf(b),
  )
  const missed = MUSCLES.filter((m) => !((load[m] || 0) > 0))
  return { worked, missed }
}

export function inMuscleOrder(list: MuscleSlug[]): MuscleSlug[] {
  const at = (m: MuscleSlug) => {
    const i = MUSCLES.indexOf(m)
    return i < 0 ? MUSCLES.length : i
  }
  return [...(list || [])].sort((a, b) => at(a) - at(b))
}

export const MUSCLE_LABELS = MUSCLE_NAMES_ES
export const exerciseMuscleWeights = getExerciseMuscleWeights
export const computeRoutineMuscleVolume = calculateMuscleLoad

/**
 * Returns all database primary_muscle / target_muscles strings that map to a canonical MuscleSlug.
 */
export function canonicalMuscleDbTerms(slug: MuscleSlug): string[] {
  const terms = new Set<string>([slug])
  for (const [legacy, target] of Object.entries(ALIASES)) {
    if (target === slug) {
      terms.add(legacy)
    }
  }
  return Array.from(terms)
}



