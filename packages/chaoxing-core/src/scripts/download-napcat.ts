import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';

const BUILD_DIR = path.resolve(__dirname, '..');
const PROJECT_DIR = path.resolve(BUILD_DIR, '../../..');
const NAPCAT_DIR = path.resolve(PROJECT_DIR, 'napcat');
// NapCat Shell 读取 napcat/napcat/config/ 下的 per-QQ 配置文件
const CONFIG_DIR = path.join(NAPCAT_DIR, 'napcat', 'config');
const ZIP_NAME = process.platform === 'win32' ? 'NapCat.Shell.Windows.Node.zip' : 'NapCat.Shell.zip';
const ZIP_PATH = path.join(NAPCAT_DIR, ZIP_NAME);
const QQ_PATH = path.join(NAPCAT_DIR, '.qq');

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'chaoxing-signin' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 302 || (res.statusCode === 301 && res.headers.location)) {
          fetchJson(res.headers.location as string).then(resolve).catch(reject);
        } else if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch { reject(new Error('JSON parse error')); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'chaoxing-signin' } }, (res) => {
      if (res.statusCode === 302 || (res.statusCode === 301 && res.headers.location)) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(res.headers.location as string, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      reject(err);
    });
  });
}

function extractZip(zipPath: string, dest: string) {
  console.log('正在解压...');
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${dest}' -Force"`, { stdio: 'pipe' });
  } else {
    execSync(`unzip -o '${zipPath}' -d '${dest}'`, { stdio: 'pipe' });
  }
  try { fs.unlinkSync(zipPath); } catch {}
}

function generateConfig(qq: string) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const configPath = path.join(CONFIG_DIR, `onebot11_${qq}.json`);
  const config = {
    network: {
      httpServers: [],
      httpSseServers: [],
      httpClients: [],
      websocketServers: [
        { name: 'ws-server', enable: true, port: 3001, heartInterval: 30000, token: '' },
      ],
      websocketClients: [],
      plugins: [],
    },
    musicSignUrl: '',
    enableLocalFile2Url: false,
    parseMultMsg: false,
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log(`配置已生成: ${configPath}`);
}

async function main() {
  const NON_INTERACTIVE = process.argv.includes('--non-interactive');

  // 检查是否已安装
  // 检查是否已安装：napcat/napcat/napcat.mjs 是 NapCat Shell 的核心入口
  if (fs.existsSync(NAPCAT_DIR) && fs.existsSync(path.join(NAPCAT_DIR, 'napcat', 'napcat.mjs'))) {
    console.log('NapCat 已安装');
    const qq = fs.existsSync(QQ_PATH) ? fs.readFileSync(QQ_PATH, 'utf8').trim() : '';
    if (qq) {
      console.log(`已保存 QQ 号: ${qq}`);
      // 确保 per-QQ 配置存在
      if (!fs.existsSync(path.join(CONFIG_DIR, `onebot11_${qq}.json`))) generateConfig(qq);
    }
    console.log('如需重新下载请删除 napcat/ 目录后重试');
    return;
  }

  console.log('正在获取 NapCat 最新版本...');
  const release = await fetchJson('https://api.github.com/repos/NapNeko/NapCatQQ/releases/latest');
  const tag = release.tag_name;
  const asset = release.assets.find((a: any) => a.name === ZIP_NAME);
  if (!asset) throw new Error(`未找到 ${ZIP_NAME} 发布包`);

  console.log(`发现版本: ${tag}`);
  const ext = process.platform === 'win32' ? 'exe' : 'sh';
  const startScript = `napcat.${ext}`;
  if (!fs.existsSync(NAPCAT_DIR)) fs.mkdirSync(NAPCAT_DIR, { recursive: true });

  console.log(`正在下载 ${ZIP_NAME}...`);
  await downloadFile(asset.browser_download_url, ZIP_PATH);
  console.log('下载完成');

  extractZip(ZIP_PATH, NAPCAT_DIR);
  console.log('解压完成');

  // 询问 QQ 号
  let qq = '';
  if (NON_INTERACTIVE) {
    qq = '000000000';
  } else {
    const readline = (await import('readline')).createInterface({ input: process.stdin, output: process.stdout });
    qq = await new Promise<string>((resolve) => {
      readline.question('请输入你的 QQ 号: ', (answer: string) => {
        readline.close();
        resolve(answer.trim());
      });
    });
  }
  fs.writeFileSync(QQ_PATH, qq, 'utf8');
  console.log(`QQ 号已保存: ${qq}`);

  // 生成 OneBot 配置（须在获取 QQ 号之后，写入 per-QQ 配置文件）
  generateConfig(qq);

  console.log(`NapCat 安装完成！`);
  console.log(`目录: ${NAPCAT_DIR}`);
  console.log('首次启动请先运行 pnpm start:all，扫码登录 QQ');
}

main().catch((err) => {
  console.error('安装失败:', err.message);
  process.exit(1);
});
