"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const kolorist_1 = require("kolorist");
const file_1 = require("../utils/file");
const qrcode_1 = require("../functions/qrcode");
const user_1 = require("../functions/user");
/**
 * 独立二维码签到脚本
 *
 * 用法: node build/scripts/sign-with-enc.js --enc=ENCVALUE --activeId=ACTIVEID [--user=N]
 *
 * 从 storage.json 读取已登录用户的 session 完成签到
 */
(async () => {
    const args = process.argv.slice(2);
    const parseArg = (prefix) => {
        const arg = args.find(a => a.startsWith(prefix));
        return arg ? arg.split('=')[1] : undefined;
    };
    const enc = parseArg('--enc');
    const activeId = parseArg('--activeId') || parseArg('--aid');
    const userIndex = parseInt(parseArg('--user') || '0', 10);
    if (!enc) {
        console.log((0, kolorist_1.red)('错误: 缺少 --enc 参数'));
        console.log('用法: node build/scripts/sign-with-enc.js --enc=ENCVALUE --activeId=ACTIVEID');
        process.exit(1);
    }
    if (!activeId) {
        console.log((0, kolorist_1.red)('错误: 缺少 --activeId (或 --aid) 参数'));
        process.exit(1);
    }
    const envJson = (0, file_1.getJsonObject)('env.json');
    const envAccounts = envJson.accounts;
    const account = envAccounts?.[userIndex];
    const phone = account?.phone;
    if (!phone) {
        console.log((0, kolorist_1.red)(`错误: env.json accounts[${userIndex}] 未配置`));
        process.exit(1);
    }
    const storage = (0, file_1.getJsonObject)('configs/storage.json');
    const users = storage.users;
    const user = users.find((u) => u.phone === phone);
    if (!user || !user.params) {
        console.log((0, kolorist_1.red)('错误: 未找到用户凭证，请先通过 pnpm monitory 或 pnpm start 登录'));
        process.exit(1);
    }
    const params = user.params;
    let name = '';
    try {
        name = await (0, user_1.getAccountInfo)(params);
    }
    catch {
        name = 'unknown';
    }
    const displayName = account?.remark || user.remark || phone;
    console.log((0, kolorist_1.blue)(`[签到] ${displayName} enc=${enc.substring(0, 8)}... activeId=${activeId}`));
    console.log((0, kolorist_1.blue)(`[签到] 姓名: ${name}`));
    const result = await (0, qrcode_1.QRCodeSign)({
        enc,
        name,
        fid: params.fid,
        activeId,
        address: '',
        lat: '-1',
        lon: '-1',
        altitude: '0',
        ...params,
    });
    console.log((0, kolorist_1.green)(`[结果] ${result}`));
    process.exit(0);
})();
