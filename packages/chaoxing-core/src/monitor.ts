import fs from 'fs';
import jsdom from 'jsdom';
import { blue, green, red } from 'kolorist';
import path from 'path';

function getQrCachePath(userIndex: number) {
  return path.join(__dirname, `temp-qr-cache-${userIndex}.json`);
}

function getUserDisplayName(userIndex: number): string {
  // 优先从 env.json 读取
  try {
    const env = getJsonObject('env.json');
    const account = env.accounts?.[userIndex];
    if (account?.remark) return account.remark;
    if (account?.phone) return account.phone;
  } catch {}
  // 回退到 storage.json
  try {
    const data = getJsonObject('configs/storage.json');
    const user = data.users[userIndex];
    if (user?.remark) return user.remark;
    if (user?.phone) return user.phone;
  } catch {}
  return `用户 ${userIndex}`;
}

let userIndex = 0;
import prompts from 'prompts';
import WebSocket from 'ws';
import { getPPTActiveInfo, getSignType, preSign, preSign2, speculateType } from './functions/activity';
import { GeneralSign, GeneralSign_2 } from './functions/general';
import { LocationSign, LocationSign_2 } from './functions/location';
import { QRCodeSign, autoQRCodeSign } from './functions/qrcode';
import { getIMParams, getLocalUsers, userLogin } from './functions/user';
import { getJsonObject, getStoredUser, storeUser } from './utils/file';
import { delay } from './utils/helper';
import { sendEmail } from './utils/mailer';
import { PromptsOptions, addressPrompts, monitorPromptsQuestions } from './configs/prompts';
const JSDOM = new jsdom.JSDOM('', { url: 'https://im.chaoxing.com/webim/me' });
(globalThis.window as any) = JSDOM.window;
(globalThis.WebSocket as any) = WebSocket;
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

async function configure(phone: string) {
  const config = getStoredUser(phone);

  // 从 env.json 读取预设配置
  let envPresetAddress: AddressItem[] | undefined;
  try {
    const env = getJsonObject('env.json');
    const envAccount = process.argv.includes('--user')
      ? env.accounts?.[userIndex]
      : env.accounts?.find((a: any) => a.phone === phone);
    if (envAccount?.presetAddress?.length > 0) envPresetAddress = envAccount.presetAddress;
  } catch {}

  // 被 start-all 启动时（有 --user 参数），自动使用缓存或默认值，不交互
  if (process.argv.includes('--user')) {
    if (config?.monitor) {
      // env.json 的 presetAddress 优先级高于缓存
      if (envPresetAddress) config.monitor.presetAddress = envPresetAddress;
      console.log(blue(`[${getUserDisplayName(userIndex)}] 自动使用本地缓存的签到配置`));
      return JSON.parse(JSON.stringify({ mailing: config!.mailing, monitor: config!.monitor }));
    }
    console.log(blue(`[${getUserDisplayName(userIndex)}] 无缓存配置，使用默认值`));
    return JSON.parse(JSON.stringify({
      mailing: { enabled: false },
      monitor: { delay: 3, lon: '-1', lat: '-1', presetAddress: envPresetAddress || [] },
    }));
  }

  console.log(blue('自动签到支持 [普通/拍照/位置/二维码]'));
  if (config?.monitor) {
    const local = (
      await prompts(
        {
          type: 'confirm',
          name: 'local',
          message: '是否用本地缓存的签到信息?',
          initial: true,
        },
        PromptsOptions
      )
    ).local;

    if (local) {
      return JSON.parse(JSON.stringify({ mailing: config!.mailing, monitor: config!.monitor }));
    }
  }

  // 如果已有预设地址，跳过输入（优先级: env.json > storage.json > 手动输入）
  const presetAddress = (envPresetAddress && envPresetAddress.length > 0)
    ? envPresetAddress
    : (config?.monitor?.presetAddress && config.monitor.presetAddress.length > 0)
      ? config.monitor.presetAddress
      : await addressPrompts();
  const response = await prompts(monitorPromptsQuestions, PromptsOptions);
  const monitor: any = {};
  const mailing: any = {};
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
  config!.monitor = monitor;
  config!.mailing = mailing;

  const data = getJsonObject('configs/storage.json');
  for (let i = 0; i < data.users.length; i++) {
    if (data.users[i].phone === phone) {
      data.users[i].monitor = monitor;
      data.users[i].mailing = mailing;
      break;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  fs.writeFile(path.join(__dirname, './configs/storage.json'), JSON.stringify(data), 'utf8', () => { });

  return JSON.parse(JSON.stringify({ mailing: config!.mailing, monitor: config!.monitor }));
}

async function Sign(realname: string, params: UserCookieType & { tuid: string; }, config: any, activity: Activity) {
  let result = null;
  // 群聊签到，无课程
  if (!activity.courseId) {
    const page = await preSign2({ ...activity, ...params, chatId: activity.chatId as string });
    const activityType = speculateType(page);
    switch (activityType) {
      case 'general': {
        result = await GeneralSign_2({ activeId: activity.activeId, ...params });
        break;
      }
      case 'location': {
        result = await LocationSign_2({
          name: realname,
          presetAddress: config.presetAddress,
          activeId: activity.activeId,
          ...params,
        });
        break;
      }
      case 'qr': {
        try {
          result = await autoQRCodeSign({ ...params, ...activity, name: realname });
        } catch (e: any) {
          if (e.message === 'NoQRUrl' || e.message === 'QRDecodeFailed') {
            try { fs.writeFileSync(getQrCachePath(userIndex), JSON.stringify({ activeId: activity.activeId, timestamp: Date.now() })); } catch {}
            result = '[二维码]请发送二维码照片';
            console.log(red(`[${getUserDisplayName(userIndex)}] 二维码签到，activeId 已缓存，请发送二维码照片给 QQ 机器人`));
          } else {
            result = `[二维码]${e.message}`;
          }
        }
        break;
      }
    }
    return result;
  }

  // 课程签到
  await preSign({ ...activity, ...params });
  switch (activity.otherId) {
    case 2: {
      try {
        result = await autoQRCodeSign({ ...params, ...activity, name: realname });
      } catch (e: any) {
        if (e.message === 'NoQRUrl' || e.message === 'QRDecodeFailed') {
          try { fs.writeFileSync(getQrCachePath(userIndex), JSON.stringify({ activeId: activity.activeId, timestamp: Date.now() })); } catch {}
          result = '[二维码]自动解码失败，请将二维码截图发送给 QQ 机器人';
          console.log(red(`[${getUserDisplayName(userIndex)}] 二维码签到，activeId 已缓存，请将二维码截图发送给 QQ 机器人`));
        } else {
          result = `[二维码]${e.message}`;
        }
      }
      break;
    }
    case 4: {
      result = await LocationSign({
        name: realname,
        presetAddress: config.presetAddress,
        activeId: activity.activeId,
        ...params,
      });
      break;
    }
    case 0: {
      result = await GeneralSign({ name: realname, activeId: activity.activeId, ...params });
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
  let params: any = {};
  let config: any = {};
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
  } else {
    // 检查 env.json 是否有预设账号
    const envAccounts = getJsonObject('env.json').accounts as Array<{ phone: string; password: string; }> | undefined;
    if (envAccounts && envAccounts.length > userIndex && envAccounts[userIndex]?.phone) {
      const account = envAccounts[userIndex];
      console.log(blue(`[${getUserDisplayName(userIndex)}] 使用预设账号: ${account.phone}`));
      params = await userLogin(account.phone, account.password);
      if (params === 'AuthFailed') process.exit(0);
      storeUser(account.phone, { phone: account.phone, params });
      params.phone = account.phone;
    } else {
      const userItem = (
        await prompts(
          { type: 'select', name: 'userItem', message: '选择用户', choices: getLocalUsers(), initial: 0 },
          PromptsOptions
        )
      ).userItem;
      if (userItem === -1) {
        const phone = (await prompts({ type: 'text', name: 'phone', message: '手机号' }, PromptsOptions)).phone;
        const password = (await prompts({ type: 'password', name: 'password', message: '密码' }, PromptsOptions)).password;
        params = await userLogin(phone, password);
        if (params === 'AuthFailed') process.exit(0);
        storeUser(phone, { phone, params });
        params.phone = phone;
      } else {
        const user = getJsonObject('configs/storage.json').users[userItem];
        params = user.params;
        params.phone = user.phone;
      }
    }
    config = await configure(params.phone);
  }

  const IM_Params = await getIMParams(params as UserCookieType);
  if (IM_Params === 'AuthFailed') {
    if (process.send) process.send('authfail');
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
      if (process.send) process.send('success');
    },
    onClosed: () => {
      console.log('[监听停止]');
      process.exit(0);
    },
    onTextMessage: async (message: any) => {
      if (message?.ext?.attachment?.att_chat_course?.url.includes('sign')) {
        const IM_CourseInfo = {
          aid: message.ext.attachment.att_chat_course.aid,
          classId: message.ext.attachment.att_chat_course?.courseInfo?.classid,
          courseId: message.ext.attachment.att_chat_course?.courseInfo?.courseid,
        };
        const PPTActiveInfo = await getPPTActiveInfo({ activeId: IM_CourseInfo.aid, ...(params as UserCookieType) });

        // 跳过已删除/过期的活动
        if (PPTActiveInfo.isdelete === 1 || PPTActiveInfo.endTime < PPTActiveInfo.nowTime) {
          console.log(blue(`[${getUserDisplayName(userIndex)}] [跳过]${getSignType(PPTActiveInfo)}已过期或已删除`));
          return;
        }

        console.log(blue(`[${getUserDisplayName(userIndex)}] 检测到${getSignType(PPTActiveInfo)}，将在${config.monitor.delay}秒后处理`));

        await delay(config.monitor.delay);
        const result = await Sign(IM_Params.myName, params, config.monitor, {
          classId: IM_CourseInfo.classId,
          courseId: IM_CourseInfo.courseId,
          activeId: IM_CourseInfo.aid,
          otherId: PPTActiveInfo.otherId,
          ifphoto: PPTActiveInfo.ifphoto,
          chatId: message?.to,
        });
        if (config.mailing?.enabled) {
          sendEmail({
            aid: IM_CourseInfo.aid,
            uid: params._uid,
            realname: IM_Params.myName,
            status: result,
            mailing: config.mailing,
          });
        }
      }
    },
    onError: (msg: string) => {
      console.log(red('[发生异常]'), msg);
      process.exit(0);
    },
  });

  console.log(blue(`[监听中]${config.mailing?.enabled ? ' 邮件推送已开启' : ''}...`));
})();
