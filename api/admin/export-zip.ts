import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const BOOTSTRAPPED_ADMIN_EMAILS = [
  'meranamasimkhan@gmail.com',
  'shahzainandwalli@gmail.com',
  'fbisemcqtest@gmail.com',
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
  if (!adminDocRes.ok) return false;
  try {
    const adminDocData = (await adminDocRes.json()) as {
      fields?: { status?: { stringValue?: string } };
    };
    if (adminDocData.fields?.status?.stringValue === 'paused') {
      return false;
    }
  } catch {
    return false;
  }
  return true;
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

interface EditionZipConfig {
  grade: '9th' | '10th' | '1st A' | '2nd Year' | 'All';
  titleLabel: string;
  zipFilename: string;
}

function resolveEditionZipConfig(raw: unknown): EditionZipConfig {
  const val = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (val === '9th' || val === '9') {
    return { grade: '9th', titleLabel: '9th Class (SSC-I)', zipFilename: 'meritexam-9th-class.zip' };
  }
  if (val === '10th' || val === '10') {
    return { grade: '10th', titleLabel: '10th Class (SSC-II)', zipFilename: 'meritexam-10th-class.zip' };
  }
  if (val === '1st-a' || val === '1st a' || val === '1st-year' || val === '11th') {
    return { grade: '1st A', titleLabel: '1st Year / 11th (HSSC-I)', zipFilename: 'meritexam-1st-year.zip' };
  }
  if (val === '2nd-year' || val === '2nd year' || val === '12th') {
    return { grade: '2nd Year', titleLabel: '2nd Year / 12th (HSSC-II)', zipFilename: 'meritexam-2nd-year.zip' };
  }
  return {
    grade: 'All',
    titleLabel: 'Complete All-Classes (9th, 10th, 1st A & 2nd Year)',
    zipFilename: 'meritexam-complete-all-classes.zip',
  };
}

async function applyEditionOverridesToZip(zip: JSZip, cfg: EditionZipConfig) {
  zip.file(
    'DEPLOYMENT_GUIDE_URDU_ENGLISH.txt',
    `MERITEXAM DEPLOYMENT GUIDE — ${cfg.titleLabel}\nLocked Class Mode: ${cfg.grade}\n\n1. Upload to a GitHub repository.\n2. Deploy on Vercel or Netlify (Build: npm run build, Output: dist, Env: GEMINI_API_KEY).\n3. For independent free Firebase quota, replace firebase-applet-config.json with a new Firebase project, enable Google Sign-In, add your domain to Authorized Domains, and deploy firestore.rules.\n`,
  );
  if (cfg.grade === 'All') return;

  const editionFile = zip.file('src/config/appEdition.ts');
  if (editionFile) {
    const content = await editionFile.async('string');
    zip.file(
      'src/config/appEdition.ts',
      content.replace(
        /export const BUILD_LOCKED_CLASS: EditionClass = ['"][^'"]+['"];/,
        `export const BUILD_LOCKED_CLASS: EditionClass = '${cfg.grade}';`,
      ),
    );
  }

  const indexFile = zip.file('index.html');
  if (indexFile) {
    const html = await indexFile.async('string');
    const title = `MeritExam — ${cfg.titleLabel} Examination Portal`;
    const desc = `${cfg.titleLabel} Federal Board (FBISE / NBF) & Punjab Board (PTB) online examination portal.`;
    zip.file(
      'index.html',
      html
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
        .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/i, `<meta name="description" content="${desc}" />`)
        .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/i, `<meta property="og:title" content="${title}" />`)
        .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/i, `<meta property="og:description" content="${desc}" />`),
    );
  }

  const metaFile = zip.file('metadata.json');
  if (metaFile) {
    try {
      const meta = JSON.parse(await metaFile.async('string')) as Record<string, unknown>;
      meta.name = `MeritExam — ${cfg.grade}`;
      meta.description = `${cfg.titleLabel} Federal Board (FBISE / NBF) & Punjab Board (PTB) examination portal.`;
      zip.file('metadata.json', JSON.stringify(meta, null, 2));
    } catch {
      // ignore invalid JSON
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

    const reqUrl = new URL(req.url || '/api/admin/export-zip', 'http://localhost');
    const cfg = resolveEditionZipConfig(reqUrl.searchParams.get('class'));

    const zip = new JSZip();
    addDirectoryToZip(zip, rootDir, rootDir);
    await applyEditionOverridesToZip(zip, cfg);

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${cfg.zipFilename}"`);
    res.status(200).send(buffer);
  } catch (err) {
    console.error('Export ZIP error:', err);
    res.status(500).json({ error: 'Failed to create project ZIP archive.' });
  }
}
