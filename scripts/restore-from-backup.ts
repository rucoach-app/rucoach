#!/usr/bin/env npx tsx
/**
 * restore-from-backup.ts
 * ───────────────────────
 * Restaura o migra los datos de un respaldo (JSON) hacia una nueva cuenta o proyecto de Supabase.
 *
 * USO:
 *   TARGET_SUPABASE_URL="https://xxx.supabase.co" TARGET_SERVICE_ROLE_KEY="sb_secret_..." npx tsx scripts/restore-from-backup.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { readFile } from "fs/promises";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

const TARGET_URL = process.env.TARGET_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const TARGET_KEY =
  process.env.TARGET_SERVICE_ROLE_KEY ||
  process.env.TARGET_SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TARGET_URL || !TARGET_KEY) {
  console.error("❌ Error: Faltan las variables TARGET_SUPABASE_URL o TARGET_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const TABLES_IN_ORDER = [
  "profiles",
  "gym_settings",
  "membership_plans",
  "achievements",
  "exercises",
  "routines",
  "routine_days",
  "routine_exercises",
  "clients",
  "invitation_codes",
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
  const backupFile = process.argv[2] || join(process.cwd(), "supabase", "backups", "backup_latest.json");
  console.log(`📂 Leyendo archivo de respaldo: ${backupFile}`);

  const rawJson = await readFile(backupFile, "utf8");
  const parsed = JSON.parse(rawJson);
  const tables = parsed.tables as Record<string, unknown[]>;

  const targetSupabase = createClient(TARGET_URL!, TARGET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`🎯 Restaurando en proyecto destino: ${TARGET_URL}`);
  console.log("");

  const BATCH_SIZE = 200;

  for (const tableName of TABLES_IN_ORDER) {
    const rows = tables[tableName] || [];
    if (rows.length === 0) {
      console.log(`⚪ Tabla ${tableName}: 0 registros (omitida).`);
      continue;
    }

    process.stdout.write(`⏳ Restaurando ${tableName} (${rows.length} filas)... `);
    let uploaded = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await targetSupabase.from(tableName).upsert(batch, {
        onConflict: "id",
        ignoreDuplicates: false,
      });

      if (error) {
        console.log(`\n❌ Error en tabla ${tableName}: ${error.message}`);
        break;
      }
      uploaded += batch.length;
    }

    console.log(`✅ ${uploaded}/${rows.length} importadas.`);
  }

  console.log("");
  console.log("🎉 ¡Restauración completada con éxito!");
}

main().catch((err) => {
  console.error("💥 Error fatal en la restauración:", err);
  process.exit(1);
})
