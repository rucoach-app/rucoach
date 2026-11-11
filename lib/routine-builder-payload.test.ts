import { describe, expect, it } from "vitest";
import {
  computeTrainingDaysCount,
  extractAllExerciseIds,
  formatRoutineBuilderDbError,
  normalizeBuilderPayload,
  validateBuilderPayload,
  type BuilderRoutinePayload,
} from "./routine-builder-payload";

const samplePayload: BuilderRoutinePayload = {
  name: "  Hipertrofia Push/Pull  ",
  description: "   Plan semanal completo  ",
  duration_weeks: 6.8,
  goal: " muscle_gain ",
  level: "intermedio",
  days: [
    {
      day_number: 2,
      day_name: " Martes ",
      focus: "  Espalda  ",
      is_rest_day: false,
      exercises: [
        {
          exercise_id: " ex-2 ",
          order_index: 1,
          sets: 4,
          reps: " 8-10 ",
          rest_seconds: 0,
          superset_group: " A ",
          notes: "  Controlar excéntrica  ",
          warmup_sets: " 1x12 al 50% ",
        },
        {
          exercise_id: "ex-1",
          order_index: 0,
          sets: 0,
          reps: "12",
          rest_seconds: -5,
          superset_group: null,
          notes: "   ",
          warmup_sets: "",
        },
      ],
    },
    {
      day_number: 1,
      day_name: "Lunes",
      focus: "",
      is_rest_day: true,
      exercises: [
        {
          exercise_id: "should-strip",
          order_index: 0,
          sets: 3,
          reps: "10",
          rest_seconds: 60,
          superset_group: null,
        },
      ],
    },
  ],
};

describe("routine-builder-payload helpers", () => {
  it("normalizes payload fields, clears exercises on rest days, sorts days, and clamps numeric inputs", () => {
    const normalized = normalizeBuilderPayload(samplePayload);

    expect(normalized.name).toBe("Hipertrofia Push/Pull");
    expect(normalized.description).toBe("Plan semanal completo");
    expect(normalized.duration_weeks).toBe(6);
    expect(normalized.goal).toBe("muscle_gain");
    expect(normalized.level).toBe("intermediate");
    expect(normalized.days_per_week).toBe(1);

    // Day 1 sorted first and exercises stripped because it is a rest day
    expect(normalized.days[0].day_number).toBe(1);
    expect(normalized.days[0].is_rest_day).toBe(true);
    expect(normalized.days[0].exercises).toEqual([]);
    expect(normalized.days[0].focus).toBeNull();

    // Day 2 preserves 0s rest (timed/circuit/drop), trims notes/warmup, falls back invalid sets/rest cleanly
    expect(normalized.days[1].day_number).toBe(2);
    expect(normalized.days[1].exercises[0]).toMatchObject({
      exercise_id: "ex-2",
      sets: 4,
      reps: "8-10",
      rest_seconds: 0,
      superset_group: "A",
      notes: "Controlar excéntrica",
      warmup_sets: "1x12 al 50%",
    });
    expect(normalized.days[1].exercises[1]).toMatchObject({
      exercise_id: "ex-1",
      sets: 3,
      rest_seconds: 60,
      notes: null,
      warmup_sets: null,
    });
  });

  it("extracts unique exercise IDs strictly from non-rest days", () => {
    const normalized = normalizeBuilderPayload(samplePayload);
    expect(extractAllExerciseIds(normalized)).toEqual(["ex-2", "ex-1"]);
  });

  it("computes training days count favoring days with exercises and defaulting to 1", () => {
    expect(
      computeTrainingDaysCount([
        { is_rest_day: true, exercises: [] },
        { is_rest_day: false, exercises: [] },
      ]),
    ).toBe(1);

    expect(
      computeTrainingDaysCount([
        { is_rest_day: true, exercises: [] },
        { is_rest_day: true, exercises: [] },
      ]),
    ).toBe(1);
  });

  it("validates missing names, empty exercises, empty reps, and duplicate day numbers", () => {
    expect(
      validateBuilderPayload({ ...samplePayload, name: "   " }),
    ).toContain("nombre");

    const emptyDaysErr = validateBuilderPayload({
      ...samplePayload,
      days: [
        {
          day_number: 1,
          day_name: "Lunes",
          is_rest_day: true,
          exercises: [],
        },
      ],
    });
    expect(emptyDaysErr).not.toBeNull();
    expect(emptyDaysErr!.toLowerCase()).toContain("ejercicio");

    expect(
      validateBuilderPayload({
        ...samplePayload,
        days: [
          {
            day_number: 1,
            day_name: "Lunes",
            is_rest_day: false,
            exercises: [
              {
                exercise_id: "ex-1",
                order_index: 0,
                sets: 3,
                reps: "  ",
                rest_seconds: 60,
                superset_group: null,
              },
            ],
          },
        ],
      }),
    ).toContain("repeticiones");

    expect(
      validateBuilderPayload(
        {
          ...samplePayload,
          days: [
            { day_number: 1, day_name: "Lunes", is_rest_day: true, exercises: [] },
            { day_number: 1, day_name: "Martes", is_rest_day: true, exercises: [] },
          ],
        },
        { allowEmptyExercises: true },
      ),
    ).toContain("duplicados");
  });

  it("translates database error codes into user-facing Spanish messages", () => {
    expect(
      formatRoutineBuilderDbError({
        code: "23505",
        message: 'duplicate key value violates unique constraint "routine_exercises_pkey"',
      }),
    ).toContain("secuencia");

    expect(
      formatRoutineBuilderDbError({
        code: "23503",
        message: 'insert or update on table "routine_exercises" violates foreign key constraint',
      }),
    ).toContain("catálogo");

    expect(
      formatRoutineBuilderDbError({
        code: "P0002",
        message: "La rutina especificada no existe.",
      }),
    ).toContain("no existe");
  });
});
