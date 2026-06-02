"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoQRCodeSign = exports.QRCodeSign = void 0;
const api_1 = require("../configs/api");
const request_1 = require("../utils/request");
const activity_1 = require("./activity");
const QRCodeSign = async (args) => {
    const { enc, name, fid, activeId, lat, lon, address, altitude, ...cookies } = args;
    const urlParams = `${api_1.PPTSIGN.URL}?enc=${enc}&name=${name}&activeId=${activeId}&uid=${cookies._uid}&clientip=&location={"result":"1","address":"${address}","latitude":${lat},"longitude":${lon},"altitude":${altitude}}&latitude=-1&longitude=-1&fid=${fid}&appType=15`;
    const result = await (0, request_1.request)(encodeURI(urlParams), {
        headers: {
            Cookie: (0, request_1.cookieSerialize)({ ...cookies, fid }),
        },
    });
    console.log(`[调试] 签到API响应: status=${result.statusCode}, data=${result.data}`);
    const msg = result.data === 'success' ? '[二维码]签到成功' : `[二维码]${result.data}`;
    console.log(msg);
    return msg;
};
exports.QRCodeSign = QRCodeSign;
const QR_FIELDS = ['viewPicPath', 'qrCodeUrl', 'qrCode', 'qrPic', 'twoDimensionCode', 'qrImageUrl', 'qrcodeUrl'];
/**
 * 从活动信息中自动获取二维码图片并解码签到
 */
const autoQRCodeSign = async (args) => {
    const { name, fid, activeId, courseId, classId, address = '', lat = '-1', lon = '-1', altitude = '0', ...cookies } = args;
    const activeInfo = await (0, activity_1.getPPTActiveInfo)({ activeId, ...cookies });
    console.log('[二维码]活动信息:', JSON.stringify(activeInfo));
    // 检查活动信息中是否直接包含 enc
    if (typeof activeInfo === 'object' && activeInfo !== null && activeInfo.enc) {
        console.log('[二维码]直接从活动信息获取到 enc');
        return await (0, exports.QRCodeSign)({ enc: activeInfo.enc, name, fid, activeId, address, lat, lon, altitude, ...cookies });
    }
    // viewPicPath 等字段返回的是占位图，不包含真实二维码，跳过图片下载
    console.log('[二维码]活动信息中未找到 enc，跳过占位图解码');
    throw new Error('NoQRUrl');
};
exports.autoQRCodeSign = autoQRCodeSign;
