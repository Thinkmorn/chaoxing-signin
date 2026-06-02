const { rmSync, copyFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

const root = join(__dirname, '..');
const projectRoot = join(root, '../..');
const buildDir = join(root, 'dist');

if (existsSync(buildDir)) {
  rmSync(buildDir, { recursive: true, force: true });
}

const tscPath = require.resolve('typescript/bin/tsc');
execSync(`node "${tscPath}"`, { cwd: root, stdio: 'inherit', windowsHide: true });

// Copy websdk3.1.4.js
const src = join(root, 'src/utils/websdk3.1.4.js');
const dest = join(root, 'dist/utils/websdk3.1.4.js');
copyFileSync(src, dest);

// Copy env.json and configs from project root for runtime access (may not exist in Docker build)
const envPath = join(projectRoot, 'env.json');
if (existsSync(envPath)) copyFileSync(envPath, join(buildDir, 'env.json'));
mkdirSync(join(buildDir, 'configs'), { recursive: true });
const storagePath = join(projectRoot, 'configs/storage.json');
if (existsSync(storagePath)) copyFileSync(storagePath, join(buildDir, 'configs/storage.json'));

console.log('chaoxing-core build complete');
