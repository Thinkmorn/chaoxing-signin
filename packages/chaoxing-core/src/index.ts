import prompts from 'prompts';
import { blue, red } from 'kolorist';
import { getPPTActiveInfo, preSign, traverseCourseActivity } from './functions/activity';
import { GeneralSign } from './functions/general';
import { LocationSign, presetAddressChoices } from './functions/location';
import { QRCodeSign, autoQRCodeSign } from './functions/qrcode';
import { getAccountInfo, getCourses, getLocalUsers, userLogin } from './functions/user';
import { getJsonObject, storeUser } from './utils/file';

const PromptsOptions = {
  onCancel: () => {
    console.log(red('✖') + ' 操作取消');
    process.exit(0);
  },
};

(async function () {
  let params: UserCookieType & { phone?: string; };
  const configs: any = {};
  // 本地与登录之间的抉择
  {
    // 检查 env.json 是否有预设账号
    const envAccounts = getJsonObject('env.json').accounts as Array<{ phone: string; password: string; }> | undefined;
    if (envAccounts && envAccounts.length > 0 && envAccounts[0].phone) {
      const account = envAccounts[0] as any;
      console.log(blue(`使用预设账号: ${account.remark || account.phone}`));
      const result = await userLogin(account.phone, account.password);
      if (typeof result === 'string') process.exit(0);
      else storeUser(account.phone, { phone: account.phone, params: result });
      params = { ...result, phone: account.phone };
      configs.monitor = { presetAddress: account.presetAddress || [] };
    } else {
      // 打印本地用户列表，并返回用户数量
      const { userItem } = await prompts({
        type: 'select',
        name: 'userItem',
        message: '选择用户',
        choices: getLocalUsers(),
        initial: 0,
      }, PromptsOptions);
      // 使用新用户登录
      if (userItem === -1) {
        const { phone } = await prompts({ type: 'text', name: 'phone', message: '手机号' }, PromptsOptions);
        const { password } = await prompts({ type: 'password', name: 'password', message: '密码' }, PromptsOptions);
        // 登录获取各参数
        const result = await userLogin(phone, password);
        if (typeof result === 'string') process.exit(0);
        else storeUser(phone, { phone, params: result }); // 储存到本地
        params = { ...result, phone };
      } else {
        // 使用本地储存的参数
        const jsonObject = getJsonObject('configs/storage.json').users[userItem];
        params = { ...jsonObject.params };
        params.phone = jsonObject.phone;
        configs.monitor = { ...jsonObject.monitor };
        configs.mailing = { ...jsonObject.mailing };
      }
    }
    if (typeof params === 'string') return;
  }

  // 获取用户名
  const name = await getAccountInfo(params);
  console.log(blue(`你好，${name}`));

  // 获取所有课程
  const courses = await getCourses(params._uid, params._d, params.vc3);
  if (typeof courses === 'string') process.exit(0);
  // 获取进行中的签到活动
  const activity = await traverseCourseActivity({ courses, ...params });
  if (typeof activity === 'string') process.exit(0);
  else await preSign({ ...activity, ...params });

  // 处理签到，先进行预签
  switch (activity.otherId) {
    case 2: {
      // 二维码签到 — 先尝试自动获取，失败后手动输入
      try {
        console.log(blue('[二维码]尝试自动获取二维码并解码...'));
        const result = await autoQRCodeSign({ ...params, ...activity, name });
        console.log(result);
        break;
      } catch (e: any) {
        if (e.message === 'NoQRUrl' || e.message === 'QRDecodeFailed') {
          console.log(red('自动获取二维码失败，请手动输入 enc'));
        } else {
          console.log(red(`自动签到失败: ${e.message}`));
        }
      }
      // 手动输入 enc 作为 fallback
      const encManual = (await prompts({ type: 'text', name: 'enc', message: 'enc(微信或其他识别二维码，可得enc参数)' }, PromptsOptions)).enc;
      const defaultLngLat = configs.monitor?.lon ? `${configs.monitor.lon},${configs.monitor.lat}` : '113.516288,34.817038';
      const defaultAddress = configs.monitor?.address ? configs.monitor.address : '';
      const { lnglat } = await prompts({ type: 'text', name: 'lnglat', message: '经纬度', initial: defaultLngLat }, PromptsOptions);
      const { address } = await prompts({ type: 'text', name: 'address', message: '详细地址', initial: defaultAddress });
      const { altitude } = await prompts({ type: 'text', name: 'altitude', message: '海拔', initial: '100' });
      const lat = lnglat.substring(lnglat.indexOf(',') + 1, lnglat.length);
      const lon = lnglat.substring(0, lnglat.indexOf(','));
      await QRCodeSign({ ...params, activeId: activity.activeId, enc: encManual, lat, lon, address, name, altitude });
      break;
    }
    case 4: {
      // 位置签到
      console.log('[获取经纬度]https://api.map.baidu.com/lbsapi/getpoint/index.html');
      if (!configs.monitor.presetAddress) configs.monitor.presetAddress = [];
      let lon_lat_address: any;
      if (configs.monitor.presetAddress.length > 0) {
        // 已有预设地址，自动使用第一个
        const addr = configs.monitor.presetAddress[0];
        console.log(`[位置] 使用预设地址: ${addr.address}`);
        lon_lat_address = ['填充[0]', addr.lon, addr.lat, addr.address];
      } else {
        const { presetItem } = await prompts({
          type: 'select',
          name: 'presetItem',
          message: '详细地址',
          choices: presetAddressChoices(configs.monitor.presetAddress),
          initial: 0,
        }, PromptsOptions);
        if (presetItem === -1) {
          const { lon_lat_address: result } = await prompts({
            type: 'text',
            name: 'lon_lat_address',
            message: '位置参数预设（经纬度/地址）',
            initial: '113.516288,34.817038/河南省郑州市万科城大学软件楼',
          }, PromptsOptions);
          lon_lat_address = result.match(/([\d.]*),([\d.]*)\/(\S*)/);
          configs.monitor.presetAddress.push({
            lon: lon_lat_address?.[1],
            lat: lon_lat_address?.[2],
            address: lon_lat_address?.[3]
          });
        } else {
          lon_lat_address = [
            '填充[0]',
            configs.monitor.presetAddress[presetItem].lon,
            configs.monitor.presetAddress[presetItem].lat,
            configs.monitor.presetAddress[presetItem].address,
          ];
        }
      }
      // 构成预设位置对象
      const addressItem = {
        lon: lon_lat_address?.[1],
        lat: lon_lat_address?.[2],
        address: lon_lat_address?.[3]
      };
      await LocationSign({ ...activity, ...params, ...addressItem, name });
      // 更新本地数据
      configs.monitor = { presetAddress: configs?.monitor.presetAddress, delay: configs?.monitor?.delay || 0 };
      configs.mailing = configs.mailing ? configs.mailing : { enabled: false };
      break;
    }
case 0: {
      await GeneralSign({ ...params, activeId: activity.activeId, name });
    }
  }
  // 记录签到信息
  const { phone, ...rest_param } = params;
  if (phone) storeUser(phone, { phone, params: rest_param, ...configs });
})();
