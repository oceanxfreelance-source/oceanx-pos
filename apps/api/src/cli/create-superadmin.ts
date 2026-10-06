/**
 * Create a Super Admin account interactively. No default credentials exist in the codebase.
 *
 *   npm run superadmin:create -- --email admin@example.com --name "Platform Admin"
 *
 * The password is read from a hidden prompt (or SUPERADMIN_PASSWORD env for automation).
 */
import { createInterface } from 'node:readline';
import { sql } from 'drizzle-orm';
import { emailSchema, superAdminPasswordSchema } from '@oceanx/shared';
import { createDb } from '../db/client';
import { superAdmins } from '../db/schema';
import { hashPassword } from '../lib/password';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    out._writeToOutput = (s: string) => {
      if (s.includes(question)) out.output.write(s);
      else out.output.write('*');
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const email = emailSchema.parse(arg('email'));
  const name = arg('name') ?? 'Super Admin';
  const password = process.env.SUPERADMIN_PASSWORD ?? (await promptHidden('Password (min 12 chars): '));
  const parsed = superAdminPasswordSchema.safeParse(password);
  if (!parsed.success) throw new Error('Password must be 12-128 characters.');

  const { db, pool } = createDb(url, 1);
  try {
    const existing = await db.select({ id: superAdmins.id }).from(superAdmins).where(sql`lower(${superAdmins.email}) = ${email}`);
    if (existing.length) throw new Error('A Super Admin with that email already exists.');
    await db.insert(superAdmins).values({ email, name, passwordHash: await hashPassword(password), passwordChangedAt: new Date() });
    console.log(`Super Admin ${email} created. Sign in at /superadmin/login and enable 2FA under Security.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
