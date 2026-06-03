"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const net_1 = __importDefault(require("net"));
const BUILD_DIR = path_1.default.resolve(__dirname, '..');
const PROJECT_DIR = path_1.default.resolve(BUILD_DIR, '../../..');
const ENV_PATH = path_1.default.resolve(PROJECT_DIR, 'env.json');
const STORAGE_PATH = path_1.default.resolve(PROJECT_DIR, 'configs/storage.json');
// NapCat 路径
const NAPCAT_DIR = path_1.default.resolve(PROJECT_DIR, 'napcat');
const NAPCAT_NODE = path_1.default.resolve(NAPCAT_DIR, process.platform === 'win32' ? 'node.exe' : 'node');
const NAPCAT_ENTRY = path_1.default.resolve(NAPCAT_DIR, 'index.js');
function getUserDisplayName(userIndex) {
    try {
        const env = JSON.parse(fs_1.default.readFileSync(ENV_PATH, 'utf8'));
        const account = env.accounts?.[userIndex];
        if (account?.remark)
            return account.remark;
        if (account?.phone)
            return account.phone;
    }
    catch { }
    try {
        const data = JSON.parse(fs_1.default.readFileSync(STORAGE_PATH, 'utf8'));
        const user = data.users[userIndex];
        if (user?.remark)
            return user.remark;
        if (user?.phone)
            return user.phone;
    }
    catch { }
    return `用户 ${userIndex}`;
}
const children = [];
function start(name, command, args, options = {}) {
    const fatal = options.fatal !== false;
    delete options.fatal;
    const proc = (0, child_process_1.spawn)(command, args, { stdio: 'inherit', ...options });
    children.push(proc);
    proc.on('close', (code) => {
        if (fatal) {
            console.log(`[${name}] 进程退出 (code: ${code})`);
            killAll();
            process.exit(code ?? 0);
        }
        else {
            console.log(`[${name}] 进程退出 (code: ${code}) — 其他进程继续运行`);
        }
    });
    return proc;
}
function killAll() {
    [...children].forEach(p => { try {
        p.kill();
    }
    catch { } });
}
async function waitForPort(port, timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            await new Promise((resolve, reject) => {
                const socket = net_1.default.createConnection(port, '127.0.0.1');
                socket.on('connect', () => { socket.destroy(); resolve(); });
                socket.on('error', reject);
                socket.setTimeout(2000);
                socket.on('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
            });
            return true;
        }
        catch {
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return false;
}
function startNapCat() {
    if (!fs_1.default.existsSync(NAPCAT_NODE) || !fs_1.default.existsSync(NAPCAT_ENTRY)) {
        console.error(`[启动] 未找到 NapCat，请确认 napcat/ 目录完整 (napcat/${process.platform === 'win32' ? 'node.exe' : 'node'} + napcat/index.js)`);
        process.exit(1);
    }
    // 从 env.json 读取 NapCat 密码
    let napcatPwd = '';
    try {
        const env = JSON.parse(fs_1.default.readFileSync(ENV_PATH, 'utf8'));
        napcatPwd = env.napcat?.password || '';
    }
    catch { }
    console.log('[启动] 启动 NapCat Shell...');
    const envOpts = napcatPwd ? { NAPCAT_QUICK_PASSWORD: napcatPwd } : {};
    let napcatQQ = '';
    try {
        const env = JSON.parse(fs_1.default.readFileSync(ENV_PATH, 'utf8'));
        napcatQQ = env.napcat?.qq || '';
    }
    catch { }
    return start('napcat', NAPCAT_NODE, [NAPCAT_ENTRY, '-q', napcatQQ], { cwd: NAPCAT_DIR, env: { ...process.env, ...envOpts } });
}
async function main() {
    startNapCat();
    console.log('[启动] 等待 WebSocket 端口 3001...');
    const ready = await waitForPort(3001, 120000);
    if (!ready) {
        console.error('[启动] WebSocket 端口未就绪，请检查 NapCat 是否正常启动');
        process.exit(1);
    }
    console.log('[启动] NapCat 已就绪');
    if (fs_1.default.existsSync(ENV_PATH)) {
        const envJson = JSON.parse(fs_1.default.readFileSync(ENV_PATH, 'utf8'));
        const accounts = envJson.accounts || [];
        let started = 0;
        accounts.forEach((account, index) => {
            if (account.phone) {
                const name = getUserDisplayName(index);
                start(`monitor-${name}`, 'node', [path_1.default.join(BUILD_DIR, 'monitor.js'), '--user', String(index)], { fatal: false });
                started++;
            }
        });
        console.log(`[启动] 已启动 ${started} 个 monitor 进程`);
    }
    else {
        console.log('[启动] env.json 未找到，启动默认 monitor');
        start('monitor', 'node', [path_1.default.join(BUILD_DIR, 'monitor.js')]);
    }
    start('qqbot', 'node', [path_1.default.join(BUILD_DIR, 'scripts/qq-bot.js')], { fatal: false });
    console.log('[启动] 全部启动完成');
}
process.on('SIGINT', () => {
    console.log('\n[启动] 正在关闭所有进程...');
    killAll();
    process.exit(0);
});
process.on('SIGTERM', () => {
    killAll();
    process.exit(0);
});
main().catch((err) => {
    console.error('[启动] 错误:', err.message);
    killAll();
    process.exit(1);
});
