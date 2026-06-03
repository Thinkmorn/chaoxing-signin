"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const child_process_1 = require("child_process");
const BUILD_DIR = path_1.default.resolve(__dirname, '..');
const PROJECT_DIR = path_1.default.resolve(BUILD_DIR, '../../..');
const NAPCAT_DIR = path_1.default.resolve(PROJECT_DIR, 'napcat');
// NapCat Shell 读取 napcat/napcat/config/ 下的 per-QQ 配置文件
const CONFIG_DIR = path_1.default.join(NAPCAT_DIR, 'napcat', 'config');
const ZIP_NAME = process.platform === 'win32' ? 'NapCat.Shell.Windows.Node.zip' : 'NapCat.Shell.zip';
const ZIP_PATH = path_1.default.join(NAPCAT_DIR, ZIP_NAME);
const QQ_PATH = path_1.default.join(NAPCAT_DIR, '.qq');
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https_1.default.get(url, { headers: { 'User-Agent': 'chaoxing-signin' } }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 302 || (res.statusCode === 301 && res.headers.location)) {
                    fetchJson(res.headers.location).then(resolve).catch(reject);
                }
                else if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    }
                    catch {
                        reject(new Error('JSON parse error'));
                    }
                }
                else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                }
            });
        }).on('error', reject);
    });
}
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs_1.default.createWriteStream(dest);
        https_1.default.get(url, { headers: { 'User-Agent': 'chaoxing-signin' } }, (res) => {
            if (res.statusCode === 302 || (res.statusCode === 301 && res.headers.location)) {
                file.close();
                fs_1.default.unlinkSync(dest);
                downloadFile(res.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                file.close();
                fs_1.default.unlinkSync(dest);
                reject(new Error(`Download failed: HTTP ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', (err) => {
            file.close();
            try {
                fs_1.default.unlinkSync(dest);
            }
            catch { }
            reject(err);
        });
    });
}
function extractZip(zipPath, dest) {
    console.log('正在解压...');
    if (process.platform === 'win32') {
        (0, child_process_1.execSync)(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${dest}' -Force"`, { stdio: 'pipe' });
    }
    else {
        (0, child_process_1.execSync)(`unzip -o '${zipPath}' -d '${dest}'`, { stdio: 'pipe' });
    }
    try {
        fs_1.default.unlinkSync(zipPath);
    }
    catch { }
}
function generateConfig(qq) {
    if (!fs_1.default.existsSync(CONFIG_DIR))
        fs_1.default.mkdirSync(CONFIG_DIR, { recursive: true });
    const configPath = path_1.default.join(CONFIG_DIR, `onebot11_${qq}.json`);
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
    fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log(`配置已生成: ${configPath}`);
}
async function main() {
    const NON_INTERACTIVE = process.argv.includes('--non-interactive');
    // 检查是否已安装
    // 检查是否已安装：napcat/napcat/napcat.mjs 是 NapCat Shell 的核心入口
    if (fs_1.default.existsSync(NAPCAT_DIR) && fs_1.default.existsSync(path_1.default.join(NAPCAT_DIR, 'napcat', 'napcat.mjs'))) {
        console.log('NapCat 已安装');
        const qq = fs_1.default.existsSync(QQ_PATH) ? fs_1.default.readFileSync(QQ_PATH, 'utf8').trim() : '';
        if (qq) {
            console.log(`已保存 QQ 号: ${qq}`);
            // 确保 per-QQ 配置存在
            if (!fs_1.default.existsSync(path_1.default.join(CONFIG_DIR, `onebot11_${qq}.json`)))
                generateConfig(qq);
        }
        console.log('如需重新下载请删除 napcat/ 目录后重试');
        return;
    }
    console.log('正在获取 NapCat 最新版本...');
    const release = await fetchJson('https://api.github.com/repos/NapNeko/NapCatQQ/releases/latest');
    const tag = release.tag_name;
    const asset = release.assets.find((a) => a.name === ZIP_NAME);
    if (!asset)
        throw new Error(`未找到 ${ZIP_NAME} 发布包`);
    console.log(`发现版本: ${tag}`);
    const ext = process.platform === 'win32' ? 'exe' : 'sh';
    const startScript = `napcat.${ext}`;
    if (!fs_1.default.existsSync(NAPCAT_DIR))
        fs_1.default.mkdirSync(NAPCAT_DIR, { recursive: true });
    console.log(`正在下载 ${ZIP_NAME}...`);
    await downloadFile(asset.browser_download_url, ZIP_PATH);
    console.log('下载完成');
    extractZip(ZIP_PATH, NAPCAT_DIR);
    console.log('解压完成');
    // 询问 QQ 号
    let qq = '';
    if (NON_INTERACTIVE) {
        qq = '000000000';
    }
    else {
        const readline = (await Promise.resolve().then(() => __importStar(require('readline')))).createInterface({ input: process.stdin, output: process.stdout });
        qq = await new Promise((resolve) => {
            readline.question('请输入你的 QQ 号: ', (answer) => {
                readline.close();
                resolve(answer.trim());
            });
        });
    }
    fs_1.default.writeFileSync(QQ_PATH, qq, 'utf8');
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
