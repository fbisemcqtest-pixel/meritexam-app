import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const BOOTSTRAPPED_ADMIN_EMAILS = [
  'meranamasimkhan@gmail.com',
  'shahzainandwalli@gmail.com',
];

interface ApiResponse extends ServerResponse {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  send: (body: Buffer) => void;
}

function getProjectRoot() {
  return process.cwd();
}

function getFirebaseConfig(rootDir: string) {
  const cfgPath = path.resolve(rootDir, 'firebase-applet-config.json');
  if (!fs.existsSync(cfgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as {
      projectId?: string;
      apiKey?: string;
      firestoreDatabaseId?: string;
    };
  } catch {
    return null;
  }
}

async function verifyAdminBearerToken(
  authHeader: string | string[] | undefined,
  rootDir: string,
): Promise<boolean> {
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!headerValue || !headerValue.startsWith('Bearer ')) return false;
  const idToken = headerValue.slice(7).trim();
  if (!idToken) return false;

  const fbConfig = getFirebaseConfig(rootDir);
  if (!fbConfig?.apiKey || !fbConfig?.projectId) return false;

  const lookupRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(fbConfig.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!lookupRes.ok) return false;
  const lookupData = (await lookupRes.json()) as {
    users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
  };
  const user = lookupData.users?.[0];
  if (!user?.localId || !user?.email || !user.emailVerified) return false;

  if (BOOTSTRAPPED_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return true;
  }

  const dbId = fbConfig.firestoreDatabaseId || '(default)';
  const adminDocRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(fbConfig.projectId)}/databases/${encodeURIComponent(dbId)}/documents/admins/${encodeURIComponent(user.localId)}`,
    {
      headers: { Authorization: `Bearer ${idToken}` },
    },
  );
  return adminDocRes.ok;
}

function addDirectoryToZip(zip: JSZip, baseDir: string, currentDir: string) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === 'build' ||
      entry.name === '.git' ||
      entry.name === '.vercel' ||
      entry.name === '.DS_Store' ||
      entry.name.endsWith('.log')
    ) {
      continue;
    }

    if (entry.name.startsWith('.env') && entry.name !== '.env.example') {
      continue;
    }

    if (relPath === 'public/assets/aistudio' || relPath.startsWith('public/assets/aistudio/')) {
      continue;
    }

    if (entry.isDirectory()) {
      addDirectoryToZip(zip, baseDir, fullPath);
    } else if (entry.isFile()) {
      zip.file(relPath, fs.readFileSync(fullPath));
    }
  }
}

export default async function handler(req: IncomingMessage, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const rootDir = getProjectRoot();
    const isAdmin = await verifyAdminBearerToken(req.headers.authorization, rootDir);
    if (!isAdmin) {
      res.status(403).json({ error: 'Administrator authorization required.' });
      return;
    }

    const zip = new JSZip();
    addDirectoryToZip(zip, rootDir, rootDir);
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="meritexam-fbise-nbf.zip"');
    res.status(200).send(buffer);
  } catch (err) {
    console.error('Export ZIP error:', err);
    res.status(500).json({ error: 'Failed to create project ZIP archive.' });
  }
}
