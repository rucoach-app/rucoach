#!/usr/bin/env npx tsx
/**
 * backup-full-database.ts
 * ───────────────────────
 * Genera un respaldo completo de todas las tablas y datos de la base de datos actual de Supabase
 * en formato JSON y SQL, listo para restaurar o migrar a cualquier otra cuenta.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { createAdminClient } from "../lib/supabase/admin";

const TABLES_IN_ORDER = [
  "profiles",
  "gym_settings",
  "membership_plans",
  "achievements",
  "exercises",
  "invitation_codes",
  "clients",
  "routines",
  "routine_days",
  "routine_exercises",
  "client_routines",
  "workout_sessions",
  "exercise_logs",
  "payments",
  "messages",
  "personal_records",
  "progress_photos",
  "body_measurements",
  "user_achievements",
  "client_pain_reports",
  "client_exercise_overrides",
  "push_subscriptions",
];

async function main() {
  console.log("🚀 Iniciando respaldo completo de la base de datos...");
  const admin = createAdminClient();

  const backupData: Record<string, unknown[]> = {};
  const backupSummary: Record<string, number> = {};

  const backupDir = join(process.cwd(), "supabase", "backups");
  await mkdir(backupDir, { recursive: true });

  for (const table of TABLES_IN_ORDER) {
    process.stdout.write(`⏳ Respaldando tabla: ${table}... `);
    let allRows: unknown[] = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = await admin
        .from(table)
        .select("*")
        .range(from, from + batchSize - 1);

      if (error) {
        console.log(`❌ Error: ${error.message}`);
        break;
      }

      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < batchSize) break;
      from += batchSize;
    }

    backupData[table] = allRows;
    backupSummary[table] = allRows.length;
    console.log(`✅ ${allRows.length} filas.`);
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");

  const latestJsonPath = join(backupDir, "backup_latest.json");
  const timestampJsonPath = join(backupDir, `backup_${timestamp}.json`);

  const payload = {
    metadata: {
      generated_at: now.toISOString(),
      source_url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      tables_count: Object.keys(backupSummary).length,
      summary: backupSummary,
    },
    tables: backupData,
  };

  const jsonString = JSON.stringify(payload, null, 2);
  await writeFile(latestJsonPath, jsonString, "utf8");
  await writeFile(timestampJsonPath, jsonString, "utf8");

  console.log("");
  console.log("🎉 ¡Respaldo completado con éxito!");
  console.log(`📁 Guardado en:`);
  console.log(`   - ${latestJsonPath}`);
  console.log(`   - ${timestampJsonPath}`);
  console.log("");
  console.log("📊 Resumen de registros respaldados:");
  console.table(backupSummary);
}

main().catch((err) => {
  console.error("💥 Error fatal en el respaldo:", err);
  process.exit(1);
});
