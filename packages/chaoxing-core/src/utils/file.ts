import filehandle from 'fs';
import path from 'path';

interface LocalData {
  users: User[];
}

// 项目根目录：dist/utils/ -> project root
const BUILD_DIR = path.resolve(__dirname, '..');
const PROJECT_DIR = path.resolve(BUILD_DIR, '../../..');

/**
 * 储存用户凭证
 */
export const storeUser = (phone: string, user: User): User[] => {
  const data: LocalData = getJsonObject('configs/storage.json');
  let i = 0;
  user.phone = phone;

  // 存了则替换
  for (; i < data.users.length; i++) {
    if (data.users[i].phone === phone) {
      data.users[i] = user;
      break;
    }
  }
  // 未存则push
  if (i === data.users.length) {
    data.users.push(user);
  }
  filehandle.writeFileSync(path.join(PROJECT_DIR, 'configs/storage.json'), JSON.stringify(data), 'utf8');
  return data.users;
};

export const getStoredUser = (phone: string): User | null => {
  const data: User[] = getJsonObject('configs/storage.json').users;
  for (let i = 0; i < data.length; i++) {
    if (data[i].phone === phone) {
      return JSON.parse(JSON.stringify(data[i]));
    }
  }
  return null;
};

export const getJsonObject = (fileURL: string) => {
  return JSON.parse(filehandle.readFileSync(path.join(PROJECT_DIR, fileURL), 'utf8'));
};
