"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presetAddressChoices = exports.LocationSign_2 = exports.LocationSign = void 0;
const api_1 = require("../configs/api");
const helper_1 = require("../utils/helper");
const request_1 = require("../utils/request");
const LocationSign = async (args) => {
    let msg = '';
    if ('address' in args) {
        // 单个位置直接签
        const { name, address, activeId, lat, lon, fid, ...cookies } = args;
        const url = `${api_1.PPTSIGN.URL}?name=${name}&address=${address}&activeId=${activeId}&uid=${cookies._uid}&clientip=&latitude=${lat}&longitude=${lon}&fid=${fid}&appType=15&ifTiJiao=1`;
        const result = await (0, request_1.request)(url, {
            headers: {
                Cookie: (0, request_1.cookieSerialize)(cookies),
            },
        });
        msg = result.data === 'success' ? '[位置]签到成功' : `[位置]${result.data}`;
    }
    else {
        // 多个位置尝试
        const { name, activeId, presetAddress, fid, ...cookies } = args;
        for (let i = 0; i < presetAddress.length; i++) {
            const url = `${api_1.PPTSIGN.URL}?name=${name}&address=${presetAddress[i].address}&activeId=${activeId}&uid=${cookies._uid}&clientip=&latitude=${presetAddress[i].lat}&longitude=${presetAddress[i].lon}&fid=${fid}&appType=15&ifTiJiao=1`;
            const result = await (0, request_1.request)(url, {
                headers: {
                    Cookie: (0, request_1.cookieSerialize)(cookies),
                },
            });
            if (result.data === 'success') {
                msg = '[位置]签到成功';
                break;
            }
            else {
                msg = `[位置]${result.data}`;
                await (0, helper_1.delay)(1);
            }
        }
    }
    console.log(msg);
    return msg;
};
exports.LocationSign = LocationSign;
/**
 * 位置签到，无课程群聊版本
 */
const LocationSign_2 = async (args) => {
    let msg = '';
    if ('address' in args) {
        // 单个位置直接签
        const { address, activeId, lat, lon, ...cookies } = args;
        const formdata = `address=${encodeURIComponent(address)}&activeId=${activeId}&uid=${cookies._uid}&clientip=&useragent=&latitude=${lat}&longitude=${lon}&fid=&ifTiJiao=1`;
        const result = await (0, request_1.request)(api_1.CHAT_GROUP.SIGN.URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                Cookie: (0, request_1.cookieSerialize)(cookies),
            },
        }, formdata);
        msg = result.data === 'success' ? '[位置]签到成功' : `[位置]${result.data}`;
    }
    else {
        // 多个位置尝试
        const { activeId, presetAddress, ...cookies } = args;
        for (let i = 0; i < presetAddress.length; i++) {
            const formdata = `address=${encodeURIComponent(presetAddress[i].address)}&activeId=${activeId}&uid=${cookies._uid}&clientip=&useragent=&latitude=${presetAddress[i].lat}&longitude=${presetAddress[i].lon}&fid=&ifTiJiao=1`;
            const result = await (0, request_1.request)(api_1.CHAT_GROUP.SIGN.URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    Cookie: (0, request_1.cookieSerialize)(cookies),
                },
            }, formdata);
            if (result.data === 'success') {
                msg = '[位置]签到成功';
                break;
            }
            else {
                msg = `[位置]${result.data}`;
                await (0, helper_1.delay)(1);
            }
        }
    }
    console.log(msg);
    return msg;
};
exports.LocationSign_2 = LocationSign_2;
const presetAddressChoices = (presetAddress = []) => {
    const arr = [];
    for (let i = 0; i < presetAddress.length; i++) {
        arr.push({
            title: `${presetAddress[i].lon},${presetAddress[i].lat}/${presetAddress[i].address}`,
            value: i,
        });
    }
    arr.push({ title: '手动添加', value: -1 });
    return [...arr];
};
exports.presetAddressChoices = presetAddressChoices;
