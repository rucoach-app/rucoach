import { describe, it, expect } from 'vitest'
import {
  calculateMuscleLoad,
  canonicalMuscle,
  levelsOf,
} from './muscles'
import {
  computeMuscleRecovery,
} from './recovery'
import { checkExerciseContraindications } from './pain-map'
import type { Exercise } from '@/lib/types'

describe('Anatomy, Recovery & Pain Map Engine', () => {
  it('maps muscle aliases correctly to canonical slugs', () => {
    expect(canonicalMuscle('pecho')).toBe('chest')
    expect(canonicalMuscle('cuadriceps')).toBe('quadriceps')
    expect(canonicalMuscle('cuádriceps')).toBe('quadriceps')
    expect(canonicalMuscle('isquiotibiales')).toBe('hamstring')
    expect(canonicalMuscle('aductores')).toBe('adductors')
    expect(canonicalMuscle('glúteos')).toBe('gluteal')
    expect(canonicalMuscle('isquios')).toBe('hamstring')
    expect(canonicalMuscle('lats')).toBe('upper-back')
    expect(canonicalMuscle('core')).toBe('abs')
    expect(canonicalMuscle('unknown_thing')).toBeNull()
  })

  it('binds loads for newly created custom exercises with Spanish secondary muscles', () => {
    const customExercise: Partial<Exercise> = {
      id: 'custom-sumo-belt-squat',
      name: 'Sentadilla Zumo en Belt Squat Machin',
      primary_muscle: 'glutes',
      secondary_muscles_es: ['cuádriceps', 'aductores', 'isquiotibiales'],
      target_muscles_es: ['glúteos'],
    }

    const load = calculateMuscleLoad([{ exercise: customExercise, sets: 5 }])
    expect(load.gluteal).toBe(5) // Primary: 5 * 1.0 = 5
    expect(load.quadriceps).toBe(2) // Secondary: 5 * 0.4 = 2
    expect(load.adductors).toBe(2) // Secondary: 5 * 0.4 = 2
    expect(load.hamstring).toBe(2) // Secondary: 5 * 0.4 = 2
  })

  it('calculates muscle load from exercises with sets', () => {
    const exercises: { exercise: Partial<Exercise>; sets: number }[] = [
      {
        exercise: {
          id: '0025',
          primary_muscle: 'chest',
          secondary_muscles: ['triceps', 'deltoids'],
        },
        sets: 4,
      },
      {
        exercise: {
          id: '0043',
          primary_muscle: 'quadriceps',
          secondary_muscles: ['gluteal'],
        },
        sets: 3,
      },
    ]

    const load = calculateMuscleLoad(exercises)
    expect(load.chest).toBe(4) // 4 sets * 1.0
    expect(load.triceps).toBe(1.6) // 4 sets * 0.4
    expect(load.deltoids).toBe(1.6) // 4 sets * 0.4
    expect(load.quadriceps).toBe(3) // 3 sets * 1.0
    expect(load.gluteal).toBe(1.2) // 3 sets * 0.4
  })

  it('maps continuous volume into 0..4 visual level tiers', () => {
    const load = {
      chest: 8,
      triceps: 4,
      biceps: 2,
    } as any

    const levels = levelsOf(load)
    expect(levels.chest).toBe(4) // max is 8, 8/8 * 4 = 4
    expect(levels.triceps).toBe(2) // 4/8 * 4 = 2
    expect(levels.biceps).toBe(1) // 2/8 * 4 = 1
    expect(levels.calves).toBe(0) // 0
  })

  it('computes exponential decay of muscle fatigue across time', () => {
    const now = Date.now()
    const fourtyEightHoursAgo = now - 48 * 60 * 60 * 1000

    const history = [
      {
        timestamp: fourtyEightHoursAgo,
        items: [
          {
            exercise: {
              id: '0043',
              primary_muscle: 'quadriceps',
            },
            sets: 8, // 8 sets = 1.0 initial fatigue unit
          },
        ],
      },
    ]

    const recovery = computeMuscleRecovery(history, now)
    const quadStatus = recovery.quadriceps

    // Quadriceps has a 48h half-life, so after exactly 48h, fatigue should be 0.5 (half of 1.0)
    expect(quadStatus.fatigueScore).toBeCloseTo(0.5, 1)
    expect(quadStatus.state).toBe('recovering')
  })

  it('checks clinical contraindications for exercises against pain zones', () => {
    const painEntries = [
      {
        zone: 'knees' as const,
        severity: 'severe' as const,
        notes: 'Molestia rotuliana',
      },
    ]

    const squatEx: Partial<Exercise> = {
      id: '0043',
      name: 'barbell full squat',
      primary_muscle: 'quadriceps',
      body_part: 'upper legs',
    }

    const check = checkExerciseContraindications(squatEx, painEntries)
    expect(check.hasContraindication).toBe(true)
    expect(check.highestSeverity).toBe('severe')
    expect(check.conflictingZones).toContain('knees')

    const benchEx: Partial<Exercise> = {
      id: '0025',
      name: 'barbell bench press',
      primary_muscle: 'chest',
      body_part: 'chest',
    }
    const checkBench = checkExerciseContraindications(benchEx, painEntries)
    expect(checkBench.hasContraindication).toBe(false)
  })
})

