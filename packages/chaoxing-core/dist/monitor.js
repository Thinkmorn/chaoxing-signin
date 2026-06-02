"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const jsdom_1 = __importDefault(require("jsdom"));
const kolorist_1 = require("kolorist");
const path_1 = __importDefault(require("path"));
function getQrCachePath(userIndex) {
    return path_1.default.join(__dirname, `temp-qr-cache-${userIndex}.json`);
}
function getUserDisplayName(userIndex) {
    // 优先从 env.json 读取
    try {
        const env = (0, file_1.getJsonObject)('env.json');
        const account = env.accounts?.[userIndex];
        if (account?.remark)
            return account.remark;
        if (account?.phone)
            return account.phone;
    }
    catch { }
    // 回退到 storage.json
    try {
        const data = (0, file_1.getJsonObject)('configs/storage.json');
        const user = data.users[userIndex];
        if (user?.remark)
            return user.remark;
        if (user?.phone)
            return user.phone;
    }
    catch { }
    return `用户 ${userIndex}`;
}
let userIndex = 0;
const prompts_1 = __importDefault(require("prompts"));
const ws_1 = __importDefault(require("ws"));
const activity_1 = require("./functions/activity");
const general_1 = require("./functions/general");
const location_1 = require("./functions/location");
const qrcode_1 = require("./functions/qrcode");
const user_1 = require("./functions/user");
const file_1 = require("./utils/file");
const helper_1 = require("./utils/helper");
const mailer_1 = require("./utils/mailer");
const prompts_2 = require("./configs/prompts");
const JSDOM = new jsdom_1.default.JSDOM('', { url: 'https://im.chaoxing.com/webim/me' });
globalThis.window = JSDOM.window;
globalThis.WebSocket = ws_1.default;
globalThis.navigator = JSDOM.window.navigator;
globalThis.location = JSDOM.window.location;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const webIM = require('./utils/websdk3.1.4.js').default;
const WebIMConfig = {
    xmppURL: 'https://im-api-vip6-v2.easecdn.com/ws',
    apiURL: 'https://a1-vip6.easecdn.com',
    appkey: 'cx-dev#cxstudy',
    Host: 'easemob.com',
    https: true,
    isHttpDNS: false,
    isMultiLoginSessions: true,
    isAutoLogin: true,
    isWindowSDK: false,
    isSandBox: false,
    isDebug: false,
    autoReconnectNumMax: 2,
    autoReconnectInterval: 2,
    isWebRTC: false,
    heartBeatWait: 4500,
    delivery: false,
};
const conn = new webIM.connection({
    isMultiLoginSessions: WebIMConfig.isMultiLoginSessions,
    https: WebIMConfig.https,
    url: WebIMConfig.xmppURL,
    apiUrl: WebIMConfig.apiURL,
    isAutoLogin: WebIMConfig.isAutoLogin,
    heartBeatWait: WebIMConfig.heartBeatWait,
    autoReconnectNumMax: WebIMConfig.autoReconnectNumMax,
    autoReconnectInterval: WebIMConfig.autoReconnectInterval,
    appKey: WebIMConfig.appkey,
    isHttpDNS: WebIMConfig.isHttpDNS,
});
async function configure(phone) {
    const config = (0, file_1.getStoredUser)(phone);
    // 从 env.json 读取预设配置
    let envPresetAddress;
    try {
        const env = (0, file_1.getJsonObject)('env.json');
        const envAccount = process.argv.includes('--user')
            ? env.accounts?.[userIndex]
            : env.accounts?.find((a) => a.phone === phone);
        if (envAccount?.presetAddress?.length > 0)
            envPresetAddress = envAccount.presetAddress;
    }
    catch { }
    // 被 start-all 启动时（有 --user 参数），自动使用缓存或默认值，不交互
    if (process.argv.includes('--user')) {
        if (config?.monitor) {
            // env.json 的 presetAddress 优先级高于缓存
            if (envPresetAddress)
                config.monitor.presetAddress = envPresetAddress;
            console.log((0, kolorist_1.blue)(`[${getUserDisplayName(userIndex)}] 自动使用本地缓存的签到配置`));
            return JSON.parse(JSON.stringify({ mailing: config.mailing, monitor: config.monitor }));
        }
        console.log((0, kolorist_1.blue)(`[${getUserDisplayName(userIndex)}] 无缓存配置，使用默认值`));
        return JSON.parse(JSON.stringify({
            mailing: { enabled: false },
            monitor: { delay: 3, lon: '-1', lat: '-1', presetAddress: envPresetAddress || [] },
        }));
    }
    console.log((0, kolorist_1.blue)('自动签到支持 [普通/拍照/位置/二维码]'));
    if (config?.monitor) {
        const local = (await (0, prompts_1.default)({
            type: 'confirm',
            name: 'local',
            message: '是否用本地缓存的签到信息?',
            initial: true,
        }, prompts_2.PromptsOptions)).local;
        if (local) {
            return JSON.parse(JSON.stringify({ mailing: config.mailing, monitor: config.monitor }));
        }
    }
    // 如果已有预设地址，跳过输入（优先级: env.json > storage.json > 手动输入）
    const presetAddress = (envPresetAddress && envPresetAddress.length > 0)
        ? envPresetAddress
        : (config?.monitor?.presetAddress && config.monitor.presetAddress.length > 0)
            ? config.monitor.presetAddress
            : await (0, prompts_2.addressPrompts)();
    const response = await (0, prompts_1.default)(prompts_2.monitorPromptsQuestions, prompts_2.PromptsOptions);
    const monitor = {};
    const mailing = {};
    monitor.delay = response.delay;
    monitor.lon = response.lon;
    monitor.lat = response.lat;
    monitor.presetAddress = presetAddress;
    mailing.enabled = response.mail;
    mailing.host = response.host;
    mailing.ssl = response.ssl;
    mailing.port = response.port;
    mailing.user = response.user;
    mailing.pass = response.pass;
    mailing.to = response.to;
    config.monitor = monitor;
    config.mailing = mailing;
    const data = (0, file_1.getJsonObject)('configs/storage.json');
    for (let i = 0; i < data.users.length; i++) {
        if (data.users[i].phone === phone) {
            data.users[i].monitor = monitor;
            data.users[i].mailing = mailing;
            break;
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    fs_1.default.writeFile(path_1.default.join(__dirname, './configs/storage.json'), JSON.stringify(data), 'utf8', () => { });
    return JSON.parse(JSON.stringify({ mailing: config.mailing, monitor: config.monitor }));
}
async function Sign(realname, params, config, activity) {
    let result = null;
    // 群聊签到，无课程
    if (!activity.courseId) {
        const page = await (0, activity_1.preSign2)({ ...activity, ...params, chatId: activity.chatId });
        const activityType = (0, activity_1.speculateType)(page);
        switch (activityType) {
            case 'general': {
                result = await (0, general_1.GeneralSign_2)({ activeId: activity.activeId, ...params });
                break;
            }
            case 'location': {
                result = await (0, location_1.LocationSign_2)({
                    name: realname,
                    presetAddress: config.presetAddress,
                    activeId: activity.activeId,
                    ...params,
                });
                break;
            }
            case 'qr': {
                try {
                    result = await (0, qrcode_1.autoQRCodeSign)({ ...params, ...activity, name: realname });
                }
                catch (e) {
                    if (e.message === 'NoQRUrl' || e.message === 'QRDecodeFailed') {
                        try {
                            fs_1.default.writeFileSync(getQrCachePath(userIndex), JSON.stringify({ activeId: activity.activeId, timestamp: Date.now() }));
                        }
                        catch { }
                        result = '[二维码]请发送二维码照片';
                        console.log((0, kolorist_1.red)(`[${getUserDisplayName(userIndex)}] 二维码签到，activeId 已缓存，请发送二维码照片给 QQ 机器人`));
                    }
                    else {
                        result = `[二维码]${e.message}`;
                    }
                }
                break;
            }
        }
        return result;
    }
    // 课程签到
    await (0, activity_1.preSign)({ ...activity, ...params });
    switch (activity.otherId) {
        case 2: {
            try {
                result = await (0, qrcode_1.autoQRCodeSign)({ ...params, ...activity, name: realname });
            }
            catch (e) {
                if (e.message === 'NoQRUrl' || e.message === 'QRDecodeFailed') {
                    try {
                        fs_1.default.writeFileSync(getQrCachePath(userIndex), JSON.stringify({ activeId: activity.activeId, timestamp: Date.now() }));
                    }
                    catch { }
                    result = '[二维码]自动解码失败，请将二维码截图发送给 QQ 机器人';
                    console.log((0, kolorist_1.red)(`[${getUserDisplayName(userIndex)}] 二维码签到，activeId 已缓存，请将二维码截图发送给 QQ 机器人`));
                }
                else {
                    result = `[二维码]${e.message}`;
                }
            }
            break;
        }
        case 4: {
            result = await (0, location_1.LocationSign)({
                name: realname,
                presetAddress: config.presetAddress,
                activeId: activity.activeId,
                ...params,
            });
            break;
        }
        case 0: {
            result = await (0, general_1.GeneralSign)({ name: realname, activeId: activity.activeId, ...params });
            break;
        }
    }
    return result;
}
process.on('SIGINT', () => {
    process.exit(0);
});
// 开始运行
(async () => {
    // 解析 --user=N 参数
    const userArgIdx = process.argv.findIndex(a => a === '--user');
    if (userArgIdx !== -1 && process.argv[userArgIdx + 1]) {
        userIndex = parseInt(process.argv[userArgIdx + 1], 10);
    }
    let params = {};
    let config = {};
    if (process.argv[2] === '--auth') {
        const auth_config = JSON.parse(Buffer.from(process.argv[4], 'base64').toString('utf8'));
        params.phone = auth_config.credentials.phone;
        params.uf = auth_config.credentials.uf;
        params._d = auth_config.credentials._d;
        params.vc3 = auth_config.credentials.vc3;
        params._uid = auth_config.credentials.uid;
        params.lv = auth_config.credentials.lv;
        params.fid = auth_config.credentials.fid;
        config.monitor = { ...auth_config.config.monitor };
        config.mailing = { ...auth_config.config.mailing };
    }
    else {
        // 检查 env.json 是否有预设账号
        const envAccounts = (0, file_1.getJsonObject)('env.json').accounts;
        if (envAccounts && envAccounts.length > userIndex && envAccounts[userIndex]?.phone) {
            const account = envAccounts[userIndex];
            console.log((0, kolorist_1.blue)(`[${getUserDisplayName(userIndex)}] 使用预设账号: ${account.phone}`));
            params = await (0, user_1.userLogin)(account.phone, account.password);
            if (params === 'AuthFailed')
                process.exit(0);
            (0, file_1.storeUser)(account.phone, { phone: account.phone, params });
            params.phone = account.phone;
        }
        else {
            const userItem = (await (0, prompts_1.default)({ type: 'select', name: 'userItem', message: '选择用户', choices: (0, user_1.getLocalUsers)(), initial: 0 }, prompts_2.PromptsOptions)).userItem;
            if (userItem === -1) {
                const phone = (await (0, prompts_1.default)({ type: 'text', name: 'phone', message: '手机号' }, prompts_2.PromptsOptions)).phone;
                const password = (await (0, prompts_1.default)({ type: 'password', name: 'password', message: '密码' }, prompts_2.PromptsOptions)).password;
                params = await (0, user_1.userLogin)(phone, password);
                if (params === 'AuthFailed')
                    process.exit(0);
                (0, file_1.storeUser)(phone, { phone, params });
                params.phone = phone;
            }
            else {
                const user = (0, file_1.getJsonObject)('configs/storage.json').users[userItem];
                params = user.params;
                params.phone = user.phone;
            }
        }
        config = await configure(params.phone);
    }
    const IM_Params = await (0, user_1.getIMParams)(params);
    if (IM_Params === 'AuthFailed') {
        if (process.send)
            process.send('authfail');
        process.exit(0);
    }
    params.tuid = IM_Params.myTuid;
    params.name = IM_Params.myName;
    conn.open({
        apiUrl: WebIMConfig.apiURL,
        user: IM_Params.myTuid,
        accessToken: IM_Params.myToken,
        appKey: WebIMConfig.appkey,
    });
    conn.listen({
        onOpened: () => {
            if (process.send)
                process.send('success');
        },
        onClosed: () => {
            console.log('[监听停止]');
            process.exit(0);
        },
        onTextMessage: async (message) => {
            if (message?.ext?.attachment?.att_chat_course?.url.includes('sign')) {
                const IM_CourseInfo = {
                    aid: message.ext.attachment.att_chat_course.aid,
                    classId: message.ext.attachment.att_chat_course?.courseInfo?.classid,
                    courseId: message.ext.attachment.att_chat_course?.courseInfo?.courseid,
                };
                const PPTActiveInfo = await (0, activity_1.getPPTActiveInfo)({ activeId: IM_CourseInfo.aid, ...params });
                // 跳过已删除/过期的活动
                if (PPTActiveInfo.isdelete === 1 || PPTActiveInfo.endTime < PPTActiveInfo.nowTime) {
                    console.log((0, kolorist_1.blue)(`[${getUserDisplayName(userIndex)}] [跳过]${(0, activity_1.getSignType)(PPTActiveInfo)}已过期或已删除`));
                    return;
                }
                console.log((0, kolorist_1.blue)(`[${getUserDisplayName(userIndex)}] 检测到${(0, activity_1.getSignType)(PPTActiveInfo)}，将在${config.monitor.delay}秒后处理`));
                await (0, helper_1.delay)(config.monitor.delay);
                const result = await Sign(IM_Params.myName, params, config.monitor, {
                    classId: IM_CourseInfo.classId,
                    courseId: IM_CourseInfo.courseId,
                    activeId: IM_CourseInfo.aid,
                    otherId: PPTActiveInfo.otherId,
                    ifphoto: PPTActiveInfo.ifphoto,
                    chatId: message?.to,
                });
                if (config.mailing?.enabled) {
                    (0, mailer_1.sendEmail)({
                        aid: IM_CourseInfo.aid,
                        uid: params._uid,
                        realname: IM_Params.myName,
                        status: result,
                        mailing: config.mailing,
                    });
                }
            }
        },
        onError: (msg) => {
            console.log((0, kolorist_1.red)('[发生异常]'), msg);
            process.exit(0);
        },
    });
    console.log((0, kolorist_1.blue)(`[监听中]${config.mailing?.enabled ? ' 邮件推送已开启' : ''}...`));
})();
