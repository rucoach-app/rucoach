#!/usr/bin/env npx tsx
/**
 * migrate-auth-users.ts
 * ─────────────────────
 * Migra los usuarios, contraseñas hasheadas (bcrypt) e identidades
 * desde auth.users y auth.identities de la base de datos anterior
 * hacia la nueva base de datos de producción de Supabase.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const OLD_PAT = process.env.OLD_SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_DEV_ACCESS_TOKEN;
const OLD_REF = process.env.OLD_SUPABASE_PROJECT_REF || "dldttdqpcpdtribtgzsa";

const NEW_PAT = process.env.SUPABASE_ACCESS_TOKEN;
const NEW_REF = process.env.TARGET_PROJECT_REF || "zhsreeimxiggjidgmvpo";

if (!OLD_PAT || !NEW_PAT) {
  console.error("❌ Error: Faltan las variables de entorno OLD_SUPABASE_ACCESS_TOKEN o SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

async function queryOld(sql: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${OLD_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${OLD_PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`Query failed on OLD DB: ${await res.text()}`);
  return res.json();
}

async function queryNew(sql: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${NEW_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${NEW_PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`Query failed on NEW DB: ${await res.text()}`);
  return res.json();
}

function escapeSql(val: any): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return val.toString();
  if (typeof val === "object") {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${val.toString().replace(/'/g, "''")}'`;
}

async function main() {
  console.log("🚀 Iniciando migración completa de usuarios y contraseñas (auth.users)...");

  // 1. Obtener usuarios e identidades del origen
  const [users, identities] = await Promise.all([
    queryOld("SELECT * FROM auth.users ORDER BY created_at ASC;"),
    queryOld("SELECT * FROM auth.identities ORDER BY created_at ASC;"),
  ]);

  console.log(`📥 Extraídos ${users.length} usuarios y ${identities.length} identidades de la BD anterior.`);

  // 2. Insertar usuarios (omitiendo la columna generada 'confirmed_at')
  console.log("⏳ Insertando usuarios en auth.users...");
  const userCols = [
    "instance_id", "id", "aud", "role", "email", "encrypted_password",
    "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at",
    "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change",
    "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data",
    "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at",
    "phone_change", "phone_change_token", "phone_change_sent_at",
    "email_change_token_current", "email_change_confirm_status", "banned_until",
    "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous"
  ];

  for (const u of users) {
    const values = userCols.map(c => escapeSql(u[c])).join(", ");
    const sql = `
      INSERT INTO auth.users (${userCols.join(", ")})
      VALUES (${values})
      ON CONFLICT (id) DO UPDATE SET
        encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = EXCLUDED.email_confirmed_at,
        raw_app_meta_data = EXCLUDED.raw_app_meta_data,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        last_sign_in_at = EXCLUDED.last_sign_in_at;
    `;
    await queryNew(sql);
    console.log(`  ✅ Usuario migrado con contraseña: ${u.email} (${u.id})`);
  }

  // 3. Insertar identidades (omitiendo la columna generada 'email')
  console.log("⏳ Insertando identidades en auth.identities...");
  const idCols = [
    "provider_id", "user_id", "identity_data", "provider",
    "last_sign_in_at", "created_at", "updated_at", "id"
  ];

  for (const id of identities) {
    const values = idCols.map(c => escapeSql(id[c])).join(", ");
    const sql = `
      INSERT INTO auth.identities (${idCols.join(", ")})
      VALUES (${values})
      ON CONFLICT (id) DO UPDATE SET
        identity_data = EXCLUDED.identity_data,
        last_sign_in_at = EXCLUDED.last_sign_in_at;
    `;
    await queryNew(sql);
    console.log(`  ✅ Identidad migrada: ${id.user_id} (${id.provider})`);
  }

  // 4. Verificación en la nueva base
  const verifiedUsers = await queryNew("SELECT id, email, created_at, (encrypted_password IS NOT NULL) as has_pass FROM auth.users ORDER BY created_at ASC;");
  const verifiedIds = await queryNew("SELECT id, user_id, provider FROM auth.identities;");

  console.log("\n🎉 ¡MIGRACIÓN DE AUTENTICACIÓN COMPLETADA!");
  console.log(`👥 Usuarios en nuevo auth.users: ${verifiedUsers.length}`);
  console.table(verifiedUsers);
  console.log(`🔑 Identidades en nuevo auth.identities: ${verifiedIds.length}`);
}

main().catch(err => {
  console.error("❌ Error en migración de auth:", err);
  process.exit(1);
});
