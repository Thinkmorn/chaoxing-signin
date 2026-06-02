"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadBinary = exports.cookieSerialize = exports.request = void 0;
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const zlib_1 = __importDefault(require("zlib"));
var RequestMethod;
(function (RequestMethod) {
    RequestMethod["GET"] = "GET";
    RequestMethod["POST"] = "POST";
    RequestMethod["PUT"] = "PUT";
    RequestMethod["DELETE"] = "DELETE";
})(RequestMethod || (RequestMethod = {}));
/**
 * @param url 接口地址
 * @param options headers, method 参数配置
 * @param payload 当进行POST请求时传入数据
 * @returns
 */
const request = (url, options, payload) => {
    // 设置默认值
    options.method = options.method || 'GET';
    const timeout = options.timeout || 30000;
    const protocol = url.startsWith('https') ? https_1.default : http_1.default;
    const result = new Promise((resolve, reject) => {
        let data = '';
        let timedOut = false;
        const req = protocol.request(url, { headers: options.headers, method: options.method }, (res) => {
            if (options.gzip) {
                // 若启用了gzip，进行转换再返回，否则乱码
                const gzip = zlib_1.default.createGunzip();
                res.pipe(gzip);
                gzip.on('data', (chunk) => {
                    data += chunk;
                });
                gzip.on('end', () => {
                    resolve({ data, headers: res.headers, statusCode: res.statusCode });
                });
            }
            else {
                // 返回内容为字符串的情况下直接拼接返回
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve({ data, headers: res.headers, statusCode: res.statusCode });
                });
                res.on('error', (e) => {
                    reject(e);
                });
            }
        });
        req.setTimeout(timeout, () => {
            timedOut = true;
            req.destroy();
            reject(new Error(`请求超时 (${timeout}ms): ${url}`));
        });
        req.on('error', (e) => {
            if (!timedOut)
                reject(e);
        });
        if (options.method === RequestMethod.POST) {
            if (Object.prototype.toString.call(payload) === '[object Object]')
                req.write(JSON.stringify(payload));
            else
                req.write(payload);
        }
        req.end();
    });
    return result;
};
exports.request = request;
/**
 * 下载二进制数据（图片等），返回 Buffer
 */
const downloadBinary = (url) => {
    const protocol = url.startsWith('https') ? https_1.default : http_1.default;
    return new Promise((resolve, reject) => {
        const chunks = [];
        protocol.get(url, (res) => {
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
};
exports.downloadBinary = downloadBinary;
const cookieSerialize = ({ ...args }) => {
    return `fid=${args.fid}; uf=${args.uf}; _d=${args._d}; UID=${args._uid || args.UID}; vc3=${args.vc3};`;
};
exports.cookieSerialize = cookieSerialize;
