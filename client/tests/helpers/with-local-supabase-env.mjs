import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDirectory = fileURLToPath(new URL('../..', import.meta.url));
const repositoryDirectory = path.resolve(clientDirectory, '..');
const localBinaryDirectory = path.join(clientDirectory, 'node_modules', '.bin');
const environment = {
  ...process.env,
  PATH: [localBinaryDirectory, process.env.PATH].filter(Boolean).join(path.delimiter),
};
const args = process.argv.slice(2);

if (args[0] !== '--' || !args[1]) {
  console.error('Usage: node tests/helpers/with-local-supabase-env.mjs -- <command> [args...]');
  process.exit(2);
}

const status = spawnSync(
  'supabase',
  ['--workdir', repositoryDirectory, 'status', '--output', 'env'],
  {
    cwd: repositoryDirectory,
    encoding: 'utf8',
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);

if (status.error || status.status !== 0) {
  console.error('The local Supabase stack is unavailable. Start it with `npm run supabase:start` from client/.');
  if (status.stderr?.trim()) console.error(status.stderr.trim());
  process.exit(status.status || 1);
}

const local = {};
for (const line of status.stdout.split(/\r?\n/)) {
  const match = line.trim().match(/^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/);
  if (!match) continue;

  const rawValue = match[2].trim();
  let value = rawValue;
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    try {
      value = JSON.parse(rawValue);
    } catch {
      value = rawValue.slice(1, -1);
    }
  } else if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
    value = rawValue.slice(1, -1);
  }
  local[match[1]] = value;
}

const required = ['API_URL', 'DB_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY'];
const missing = required.filter((key) => !local[key]);
if (missing.length > 0) {
  console.error(`Supabase status did not provide required local values: ${missing.join(', ')}`);
  process.exit(1);
}

const command = spawnSync(args[1], args.slice(2), {
  cwd: clientDirectory,
  env: {
    ...environment,
    NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
    DATABASE_URL: local.DB_URL,
  },
  stdio: 'inherit',
});

if (command.error) {
  console.error(command.error.message);
  process.exit(1);
}
process.exit(command.status ?? 1);
