"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const ws_1 = __importDefault(require("ws"));
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const qrdecoder_1 = require("../utils/qrdecoder");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const WS_URL = 'ws://127.0.0.1:3001';
const SCRIPT_PATH = path_1.default.resolve(__dirname, 'sign-with-enc.js');
const BUILD_DIR = path_1.default.resolve(__dirname, '..');
const PROJECT_DIR = path_1.default.resolve(BUILD_DIR, '../../..');
const CACHE_DIR = BUILD_DIR;
const ENV_PATH = path_1.default.resolve(PROJECT_DIR, 'env.json');
const STORAGE_PATH = path_1.default.resolve(PROJECT_DIR, 'configs/storage.json');
function getUserDisplayName(userIndex) {
    // 优先从 env.json 读取
    try {
        const env = JSON.parse(fs_1.default.readFileSync(ENV_PATH, 'utf8'));
        const account = env.accounts?.[userIndex];
        if (account?.remark)
            return account.remark;
        if (account?.phone)
            return account.phone;
    }
    catch { }
    // 回退到 storage.json
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
/** 扫描所有 temp-qr-cache-{N}.json 文件，返回未过期的缓存列表 */
function getAllCaches() {
    const results = [];
    try {
        const files = fs_1.default.readdirSync(CACHE_DIR);
        for (const file of files) {
            const match = file.match(/^temp-qr-cache-(\d+)\.json$/);
            if (!match)
                continue;
            const userIndex = parseInt(match[1], 10);
            try {
                const data = JSON.parse(fs_1.default.readFileSync(path_1.default.join(CACHE_DIR, file), 'utf8'));
                if (Date.now() - data.timestamp < 600000) {
                    results.push({ userIndex, activeId: data.activeId, timestamp: data.timestamp });
                }
            }
            catch { /* skip corrupt files */ }
        }
    }
    catch { /* skip readdir errors */ }
    return results;
}
/** 通过 activeId 匹配所有对应的用户索引 */
function findAllUsersByActiveId(activeId) {
    const caches = getAllCaches();
    return caches.filter(c => c.activeId === activeId).map(c => c.userIndex);
}
/** 清除指定用户的 QR 缓存 */
function clearQrCache(userIndex) {
    try {
        fs_1.default.unlinkSync(path_1.default.join(CACHE_DIR, `temp-qr-cache-${userIndex}.json`));
    }
    catch { }
}
const ws = new ws_1.default(WS_URL);
function getPlainText(msg) {
    if (typeof msg.message === 'string')
        return msg.message;
    if (Array.isArray(msg.message)) {
        return msg.message
            .filter((s) => s.type === 'text')
            .map((s) => s.data.text)
            .join('')
            .trim();
    }
    return msg.raw_message || '';
}
function getImages(msg) {
    if (Array.isArray(msg.message)) {
        return msg.message.filter((s) => s.type === 'image').map((s) => s.data);
    }
    return [];
}
function sendReply(originalMsg, text) {
    const params = { message: text };
    if (originalMsg.message_type === 'group') {
        params.group_id = originalMsg.group_id;
        params.message_type = 'group';
    }
    else {
        params.user_id = originalMsg.user_id;
        params.message_type = 'private';
    }
    ws.send(JSON.stringify({ action: 'send_msg', params }));
}
function extractParam(url, name) {
    const match = url.match(new RegExp(`[?&]${name}=([^&]+)`));
    return match ? match[1] : null;
}
/** 从文本中提取 --user=N 参数 */
function extractUserIndex(text) {
    const match = text.match(/--user[=:](\d+)/);
    return match ? parseInt(match[1], 10) : null;
}
/** 读取 env.json 中配置的账号总数 */
function getTotalAccountCount() {
    try {
        const env = JSON.parse(fs_1.default.readFileSync(ENV_PATH, 'utf8'));
        return (env.accounts || []).length;
    }
    catch {
        return 0;
    }
}
async function handleImageMessage(msg, images, text) {
    for (const img of images) {
        const url = img.url;
        if (!url) {
            sendReply(msg, '无法获取图片链接');
            continue;
        }
        sendReply(msg, '正在解码二维码...');
        try {
            const decodedUrl = await (0, qrdecoder_1.decodeQRFromUrl)(url);
            const directEnc = (0, qrdecoder_1.extractEnc)(decodedUrl);
            const activeIdFromUrl = (0, qrdecoder_1.extractActiveId)(decodedUrl) || '';
            console.log(`[QQ Bot] 二维码解码成功: ${decodedUrl.substring(0, 60)}...`);
            // 为 env.json 中所有已登录的账号签到，不限于有缓存的用户
            const totalAccounts = getTotalAccountCount();
            if (totalAccounts === 0) {
                sendReply(msg, 'env.json 未配置账号');
                return;
            }
            const caches = getAllCaches();
            sendReply(msg, `解码成功！开始为 ${totalAccounts} 个用户签到...`);
            const results = [];
            for (let i = 0; i < totalAccounts; i++) {
                try {
                    const activeId = activeIdFromUrl || caches.find(c => c.userIndex === i)?.activeId || '';
                    const argsArr = directEnc
                        ? [`--enc=${directEnc}`, `--activeId=${activeId}`, `--user=${i}`]
                        : [`--activeId=${activeId}`, `--user=${i}`];
                    const { stdout } = await execFileAsync('node', [SCRIPT_PATH, ...argsArr], { cwd: CACHE_DIR });
                    clearQrCache(i);
                    const ok = stdout.includes('成功');
                    results.push(`${getUserDisplayName(i)}: ${ok ? '✓' : stdout.trim() || '失败'}`);
                }
                catch (e) {
                    const output = e.stdout?.trim() || e.message;
                    results.push(`${getUserDisplayName(i)}: ✗ ${output}`);
                }
            }
            sendReply(msg, results.join('\n'));
        }
        catch (e) {
            sendReply(msg, `二维码解码失败: ${e.message}`);
        }
    }
}
async function handleEncMessage(msg, text) {
    const encMatch = text.match(/enc=(\S+)/);
    const userIndex = extractUserIndex(text);
    if (!encMatch) {
        sendReply(msg, '未找到 enc 参数，格式：签到 enc=xxx [--user=N]');
        return;
    }
    const enc = encMatch[1];
    const activeIdMatch = text.match(/activeId[=:](\S+)/) || text.match(/aid[=:](\S+)/);
    const activeIdFromText = activeIdMatch ? activeIdMatch[1] : '';
    const totalAccounts = getTotalAccountCount();
    if (totalAccounts === 0) {
        sendReply(msg, 'env.json 未配置账号');
        return;
    }
    const caches = getAllCaches();
    // 确定要签到的用户列表
    const indices = [];
    if (userIndex !== null) {
        indices.push(userIndex);
    }
    else {
        for (let i = 0; i < totalAccounts; i++)
            indices.push(i);
    }
    sendReply(msg, `开始为 ${indices.length} 个用户签到...`);
    const results = [];
    for (const i of indices) {
        try {
            const activeId = activeIdFromText || caches.find(c => c.userIndex === i)?.activeId || '';
            const { stdout } = await execFileAsync('node', [SCRIPT_PATH, `--enc=${enc}`, `--activeId=${activeId}`, `--user=${i}`], { cwd: CACHE_DIR });
            clearQrCache(i);
            const ok = stdout.includes('成功');
            results.push(`${getUserDisplayName(i)}: ${ok ? '✓' : stdout.trim() || '失败'}`);
        }
        catch (e) {
            results.push(`${getUserDisplayName(i)}: ✗ ${e.message}`);
        }
    }
    sendReply(msg, results.join('\n'));
}
ws.on('open', () => {
    console.log('[QQ Bot] 已连接到 NapCat WebSocket');
});
ws.on('message', async (data) => {
    let msg;
    try {
        msg = JSON.parse(data.toString());
        if (msg.post_type !== 'message')
            return;
        const text = getPlainText(msg);
        const images = getImages(msg);
        if (images.length > 0) {
            await handleImageMessage(msg, images, text);
        }
        else if (text.includes('enc=') || text.includes('签到')) {
            await handleEncMessage(msg, text);
        }
    }
    catch (e) {
        console.error('[QQ Bot] 错误:', e.message);
        if (msg)
            sendReply(msg, `处理失败: ${e.message}`);
    }
});
ws.on('error', (err) => {
    console.error('[QQ Bot] WebSocket 错误:', err.message);
    process.exit(1);
});
ws.on('close', () => {
    console.log('[QQ Bot] 连接已关闭');
    process.exit(0);
});
