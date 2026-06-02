import { red } from 'kolorist';
import { PPTSIGN } from '../configs/api';
import { cookieSerialize, request } from '../utils/request';
import { getPPTActiveInfo } from './activity';
import { decodeQRFromUrl, extractEnc } from '../utils/qrdecoder';

export const QRCodeSign = async (args: BasicCookie & { enc: string; name: string; fid: string; activeId: string; address: string; lat: string; lon: string; altitude: string; }) => {
  const { enc, name, fid, activeId, lat, lon, address, altitude, ...cookies } = args;
  const urlParams = `${PPTSIGN.URL}?enc=${enc}&name=${name}&activeId=${activeId}&uid=${cookies._uid}&clientip=&location={"result":"1","address":"${address}","latitude":${lat},"longitude":${lon},"altitude":${altitude}}&latitude=-1&longitude=-1&fid=${fid}&appType=15`;
  const result = await request(encodeURI(urlParams), {
    headers: {
      Cookie: cookieSerialize({ ...cookies, fid }),
    },
  });
  console.log(`[调试] 签到API响应: status=${result.statusCode}, data=${result.data}`);

  const msg = result.data === 'success' ? '[二维码]签到成功' : `[二维码]${result.data}`;
  console.log(msg);

  return msg;
};

const QR_FIELDS = ['viewPicPath', 'qrCodeUrl', 'qrCode', 'qrPic', 'twoDimensionCode', 'qrImageUrl', 'qrcodeUrl'];

/**
 * 从活动信息中自动获取二维码图片并解码签到
 */
export const autoQRCodeSign = async (args: BasicCookie & {
  name: string; fid: string; activeId: string; courseId: string; classId: string;
  address?: string; lat?: string; lon?: string; altitude?: string;
}): Promise<string> => {
  const { name, fid, activeId, courseId, classId, address = '', lat = '-1', lon = '-1', altitude = '0', ...cookies } = args;

  const activeInfo = await getPPTActiveInfo({ activeId, ...cookies });
  console.log('[二维码]活动信息:', JSON.stringify(activeInfo));

  // 检查活动信息中是否直接包含 enc
  if (typeof activeInfo === 'object' && activeInfo !== null && (activeInfo as any).enc) {
    console.log('[二维码]直接从活动信息获取到 enc');
    return await QRCodeSign({ enc: (activeInfo as any).enc, name, fid, activeId, address, lat, lon, altitude, ...cookies });
  }

  // viewPicPath 等字段返回的是占位图，不包含真实二维码，跳过图片下载
  console.log('[二维码]活动信息中未找到 enc，跳过占位图解码');
  throw new Error('NoQRUrl');
};