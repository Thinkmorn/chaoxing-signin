"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitorPromptsQuestions = exports.addressPrompts = exports.PromptsOptions = void 0;
const kolorist_1 = require("kolorist");
const prompts_1 = __importDefault(require("prompts"));
exports.PromptsOptions = {
    onCancel: () => {
        console.log((0, kolorist_1.red)('✖') + ' 操作取消');
        process.exit(0);
    },
};
// 最多保存10个位置，签到失败则轮流尝试
const addressPrompts = async () => {
    const presetAddress = [];
    for (let i = 0; i < 10; i++) {
        let { lon_lat_address } = await (0, prompts_1.default)({
            type: 'text',
            name: 'lon_lat_address',
            message: `位置参数预设#${i + 1}（经纬度/地址）`,
            initial: '113.516288,34.817038/河南省郑州市万科城大学软件楼',
        }, exports.PromptsOptions);
        lon_lat_address = lon_lat_address.match(/([\d.]*),([\d.]*)\/(\S*)/);
        console.log(`#${i + 1}  经度: ${lon_lat_address?.[1]}  纬度: ${lon_lat_address?.[2]}  地址: ${lon_lat_address?.[3]}`);
        presetAddress.push({
            lon: lon_lat_address?.[1],
            lat: lon_lat_address?.[2],
            address: lon_lat_address?.[3]
        });
        // 到10个就不再询问继续
        if (i < 9) {
            const { next } = await (0, prompts_1.default)({
                type: () => i === 9 ? null : 'confirm',
                name: 'next',
                message: '是否继续添加',
                initial: true,
            }, exports.PromptsOptions);
            if (!next)
                break;
        }
    }
    return presetAddress;
};
exports.addressPrompts = addressPrompts;
/**
 * 监听模式问题数组
 */
exports.monitorPromptsQuestions = [
    {
        type: 'number',
        name: 'delay',
        message: '签到延时（单位：秒）',
        initial: 0,
    },
    {
        type: 'confirm',
        name: 'mail',
        message: '是否启用邮件通知?',
        initial: false,
    },
    {
        type: (prev) => (prev ? 'text' : null),
        name: 'host',
        message: 'SMTP服务器',
        initial: 'smtp.qq.com',
    },
    {
        type: (prev) => (prev ? 'confirm' : null),
        name: 'ssl',
        message: '是否启用SSL',
        initial: true,
    },
    {
        type: (prev) => (prev ? 'number' : null),
        name: 'port',
        message: '端口号',
        initial: 465,
    },
    {
        type: (prev) => (prev ? 'text' : null),
        name: 'user',
        message: '邮件账号',
        initial: 'xxxxxxxxx@qq.com',
    },
    {
        type: (prev) => (prev ? 'text' : null),
        name: 'pass',
        message: '授权码(密码)',
    },
    {
        type: (prev) => (prev ? 'text' : null),
        name: 'to',
        message: '接收邮箱',
    },
];
