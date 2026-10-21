import path from 'node:path';

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing environment variable ${name}. See .env.example.`);
    process.exit(1);
  }
  return v;
}

const dataDir = path.resolve(process.env.DATA_DIR ?? './data');

export const config = {
  port: Number(process.env.PORT ?? 3000),
  production: process.env.NODE_ENV === 'production',
  adminPasswordHash: required('ADMIN_PASSWORD_HASH'),
  sessionSecret: required('SESSION_SECRET'),
  dataDir,
  originalsDir: path.join(dataDir, 'originals'),
  thumbsDir: path.join(dataDir, 'thumbs'),
  backupsDir: path.join(dataDir, 'backups'),
  maxUploadBytes: 150 * 1024 * 1024,
};
