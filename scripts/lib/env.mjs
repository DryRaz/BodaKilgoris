// Tiny .env.local loader so the scripts work on any Node >= 18 (no --env-file needed).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const p = path.resolve(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      }
    }
  }
}

export function requireEnv(...names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    console.error(`Missing environment variable(s): ${missing.join(', ')}\nCopy .env.example to .env.local and fill it in.`);
    process.exit(1);
  }
}

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Keep in sync with src/lib/server/auth.ts
export const emailForPhone = (phone) => `${phone.replace(/\D/g, '')}@users.bodakilgoris.app`;
export const bodaPassword = (phone, pin) =>
  crypto.createHmac('sha256', process.env.AUTH_PEPPER).update(`boda:${phone}:${pin}`).digest('hex');
export const clientPassword = (phone) =>
  crypto.createHmac('sha256', process.env.AUTH_PEPPER).update(`client:${phone}`).digest('hex');
