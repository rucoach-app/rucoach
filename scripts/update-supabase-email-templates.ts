#!/usr/bin/env npx tsx
/**
 * update-supabase-email-templates.ts
 * ──────────────────────────────────
 * Inyecta las plantillas HTML personalizadas de RU Coach en Supabase Auth
 * una vez que Custom SMTP (Resend) esté activo en el proyecto.
 */

import { readFile } from "fs/promises";
import { join } from "path";

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const PAT = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.TARGET_PROJECT_REF || "zhsreeimxiggjidgmvpo";

if (!PAT) {
  console.error("❌ Error: Falta la variable de entorno SUPABASE_ACCESS_TOKEN.");
  process.exit(1);
}

async function main() {
  console.log(`🚀 Inyectando plantillas de correo en Supabase (${PROJECT_REF})...`);

  const emailsDir = join(process.cwd(), "emails", "supabase");
  const confirmHtml = await readFile(join(emailsDir, "supabase-confirm-signup.html"), "utf8");
  const resetHtml = await readFile(join(emailsDir, "supabase-reset-password.html"), "utf8");
  const magicHtml = await readFile(join(emailsDir, "supabase-magic-link.html"), "utf8");
  const changeEmailHtml = await readFile(join(emailsDir, "supabase-change-email.html"), "utf8");
  const inviteHtml = await readFile(join(emailsDir, "supabase-invite-user.html"), "utf8");
  const reauthHtml = await readFile(join(emailsDir, "supabase-reauthentication.html"), "utf8");

  const payload = {
    site_url: "https://rucoach.app",
    uri_allow_list: "https://rucoach.app/**,https://www.rucoach.app/**,https://rucoach-development.vercel.app/**,http://localhost:3000/**",
    mailer_otp_length: 8,
    mailer_subjects_confirmation: "Confirma tu cuenta | RU Coach",
    mailer_templates_confirmation_content: confirmHtml,
    mailer_subjects_recovery: "Restablecer contraseña | RU Coach",
    mailer_templates_recovery_content: resetHtml,
    mailer_subjects_magic_link: "Acceso directo a RU Coach",
    mailer_templates_magic_link_content: magicHtml,
    mailer_subjects_email_change: "Confirma tu nuevo correo | RU Coach",
    mailer_templates_email_change_content: changeEmailHtml,
    mailer_subjects_invite: "Te han invitado a RU Coach VIP",
    mailer_templates_invite_content: inviteHtml,
    mailer_subjects_reauthentication: "{{ .Token }} es tu código de verificación | RU Coach",
    mailer_templates_reauthentication_content: reauthHtml,
  };

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${PAT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ Error (${res.status}):`, err);
    process.exit(1);
  }

  console.log("✅ ¡Plantillas de correo HTML inyectadas con éxito en Supabase Auth!");
}

main().catch(console.error);
