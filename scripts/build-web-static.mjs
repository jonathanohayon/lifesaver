import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const sourceDir = path.join(repoRoot, 'apps', 'web', 'src');
const outputDir = path.join(repoRoot, 'apps', 'dist');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing web source directory: ${src}`);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, item.name);
    const destPath = path.join(dest, item.name);
    if (item.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (item.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

fs.rmSync(outputDir, { recursive: true, force: true });
copyDir(sourceDir, outputDir);

const requiredPages = ['index.html', 'login.html', 'settings.html', 'admin.html', 'onboarding.html', 'landing.html', 'surface-access.html', 'launch-readiness.html', 'actions.html', 'rules.html', 'notifications.html', 'support.html', 'memory.html', 'functional-audit.html'];
const missing = requiredPages.filter((page) => !fs.existsSync(path.join(outputDir, page)));
if (missing.length) {
  throw new Error(`Static web build missing required pages: ${missing.join(', ')}`);
}

console.log(`[LIFE.SAVER web] Static deployment build completed at ${outputDir}`);
console.log(`[LIFE.SAVER web] Pages: ${requiredPages.join(', ')}`);
