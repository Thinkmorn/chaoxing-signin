interface AddressItem {
  lon: string;
  lat: string;
  address: string;
}

interface MonitorConfig {
  delay: number;
  lon: number;
  lat: number;
  address: string;
  presetAddress?: AddressItem[];
}

interface MailConfig {
  enabled: boolean;
  host: string;
  ssl: boolean;
  port: number;
  user: string;
  pass: string;
  to: string;
}

interface BasicCookie {
  _uid: string;
  _d: string;
  uf: string;
  vc3: string;
}

type UserParams = BasicCookie & {
  fid: string;
  lv: string;
};

interface User {
  phone?: string;
  remark?: string;
  params?: UserParams;
  monitor?: MonitorConfig;
  mailing?: MailConfig;
}

interface CourseType {
  courseId: string;
  classId: string;
}

interface Activity {
  activeId: string;
  name?: string;
  courseId: string;
  classId: string;
  otherId: number;
  ifphoto?: number;
  chatId?: string;
}

interface IMParamsType {
  myName: string;
  myToken: string;
  myTuid: string;
  myPuid: string;
}

interface UserCookieType {
  name?: string;
  fid: string;
  pid: string;
  refer: string;
  _blank: string;
  t: boolean;
  vc3: string;
  _uid: string;
  _d: string;
  uf: string;
  lv: string;
  UID?: string;
}

