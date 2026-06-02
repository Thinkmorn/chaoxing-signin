import { blue, green, red } from 'kolorist';
import { getJsonObject } from '../utils/file';
import { QRCodeSign } from '../functions/qrcode';
import { getAccountInfo } from '../functions/user';

/**
 * 独立二维码签到脚本
 *
 * 用法: node build/scripts/sign-with-enc.js --enc=ENCVALUE --activeId=ACTIVEID [--user=N]
 *
 * 从 storage.json 读取已登录用户的 session 完成签到
 */

(async () => {
  const args = process.argv.slice(2);

  const parseArg = (prefix: string) => {
    const arg = args.find(a => a.startsWith(prefix));
    return arg ? arg.split('=')[1] : undefined;
  };

  const enc = parseArg('--enc');
  const activeId = parseArg('--activeId') || parseArg('--aid');
  const userIndex = parseInt(parseArg('--user') || '0', 10);

  if (!enc) {
    console.log(red('错误: 缺少 --enc 参数'));
    console.log('用法: node build/scripts/sign-with-enc.js --enc=ENCVALUE --activeId=ACTIVEID');
    process.exit(1);
  }

  if (!activeId) {
    console.log(red('错误: 缺少 --activeId (或 --aid) 参数'));
    process.exit(1);
  }

  const envJson = getJsonObject('env.json');
  const envAccounts = envJson.accounts as Array<{ phone: string; password: string }> | undefined;
  const account = envAccounts?.[userIndex];
  const phone = account?.phone;

  if (!phone) {
    console.log(red(`错误: env.json accounts[${userIndex}] 未配置`));
    process.exit(1);
  }

  const storage = getJsonObject('configs/storage.json');
  const users = storage.users as any[];
  const user = users.find((u: any) => u.phone === phone);

  if (!user || !user.params) {
    console.log(red('错误: 未找到用户凭证，请先通过 pnpm monitory 或 pnpm start 登录'));
    process.exit(1);
  }

  const params = user.params;

  let name = '';
  try {
    name = await getAccountInfo(params);
  } catch {
    name = 'unknown';
  }

  const displayName = (account as any)?.remark || user.remark || phone;
  console.log(blue(`[签到] ${displayName} enc=${enc.substring(0, 8)}... activeId=${activeId}`));
  console.log(blue(`[签到] 姓名: ${name}`));

  const result = await QRCodeSign({
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

  console.log(green(`[结果] ${result}`));
  process.exit(0);
})();
