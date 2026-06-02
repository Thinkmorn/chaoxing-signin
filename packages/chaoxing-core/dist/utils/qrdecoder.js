"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeQRFromBase64 = exports.decodeQRFromUrl = exports.decodeQRFromBuffer = exports.extractActiveId = exports.extractEnc = void 0;
const jpeg_js_1 = require("jpeg-js");
const pngjs_1 = require("pngjs");
const zbar_wasm_1 = require("@undecaf/zbar-wasm");
const jsqr_1 = __importDefault(require("jsqr"));
const MIN_SIZE = 300;
const UPSCALE_FACTOR = 2;
const extractEnc = (url) => {
    const match = url.match(/[?&]enc=([^&]+)/);
    return match ? match[1] : null;
};
exports.extractEnc = extractEnc;
const extractActiveId = (url) => {
    const match = url.match(/[?&]activeId=([^&]+)/) || url.match(/[?&]id=(\d+)/);
    return match ? match[1] : null;
};
exports.extractActiveId = extractActiveId;
function isPNG(buf) {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
}
function isJPEG(buf) {
    return buf[0] === 0xFF && buf[1] === 0xD8;
}
/** 将 RGBA 数据转为灰度 Uint8Array */
function toGraysane(data, width, height) {
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0; i < width * height; i++) {
        const off = i * 4;
        gray[i] = (data[off] * 0.299 + data[off + 1] * 0.587 + data[off + 2] * 0.114) | 0;
    }
    return gray;
}
/** 区域平均下采样 — 缩小大图，减少噪点干扰 */
function downscale(data, width, height, factor) {
    const nw = Math.floor(width / factor);
    const nh = Math.floor(height / factor);
    const out = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
        for (let x = 0; x < nw; x++) {
            let r = 0, g = 0, b = 0, a = 0, count = 0;
            const sy = y * factor, sx = x * factor;
            for (let dy = 0; dy < factor && sy + dy < height; dy++) {
                for (let dx = 0; dx < factor && sx + dx < width; dx++) {
                    const si = ((sy + dy) * width + (sx + dx)) * 4;
                    r += data[si];
                    g += data[si + 1];
                    b += data[si + 2];
                    a += data[si + 3];
                    count++;
                }
            }
            const di = (y * nw + x) * 4;
            out[di] = r / count;
            out[di + 1] = g / count;
            out[di + 2] = b / count;
            out[di + 3] = a / count;
        }
    }
    return { data: out, width: nw, height: nh };
}
/** 最近邻插值上采样 */
function upscale(data, width, height, factor) {
    const nw = width * factor;
    const nh = height * factor;
    const out = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
        for (let x = 0; x < nw; x++) {
            const sx = (x / factor) | 0;
            const sy = (y / factor) | 0;
            const si = (sy * width + sx) * 4;
            const di = (y * nw + x) * 4;
            out[di] = data[si];
            out[di + 1] = data[si + 1];
            out[di + 2] = data[si + 2];
            out[di + 3] = data[si + 3];
        }
    }
    return { data: out, width: nw, height: nh };
}
/** 灰度转 RGBA（ZBar 需要 RGBA 格式） */
function grayToRGBA(gray, width, height) {
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        const off = i * 4;
        rgba[off] = gray[i];
        rgba[off + 1] = gray[i];
        rgba[off + 2] = gray[i];
        rgba[off + 3] = 255;
    }
    return rgba;
}
/** Otsu 自适应阈值 — 将灰度图二值化 */
function otsuThreshold(gray, total) {
    let sum = 0;
    const hist = new Uint32Array(256);
    for (let i = 0; i < total; i++) {
        const v = gray[i];
        hist[v]++;
        sum += v;
    }
    let sumB = 0, wB = 0, wF = 0;
    let maxVariance = 0, threshold = 0;
    for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (wB === 0)
            continue;
        wF = total - wB;
        if (wF === 0)
            break;
        sumB += t * hist[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > maxVariance) {
            maxVariance = between;
            threshold = t;
        }
    }
    return threshold;
}
/** 为大图生成缩小变体 */
function addDownscaledVariants(raw, w, h, variants) {
    const scales = w > 2000 || h > 2000 ? [4, 2] : w > 1000 || h > 1000 ? [2] : [];
    for (const factor of scales) {
        const ds = downscale(raw, w, h, factor);
        variants.push({
            label: `down${factor}x`,
            imageData: { data: ds.data, width: ds.width, height: ds.height, colorSpace: 'srgb' },
        });
        const gray = toGraysane(ds.data, ds.width, ds.height);
        variants.push({
            label: `down${factor}x_gray`,
            imageData: { data: grayToRGBA(gray, ds.width, ds.height), width: ds.width, height: ds.height, colorSpace: 'srgb' },
        });
    }
}
/** 生成多个图像变体以提高解码成功率（从快到慢排列） */
function generateVariants(buffer) {
    const image = decodeImage(buffer);
    const raw = new Uint8ClampedArray(image.data);
    const variants = [];
    // 小图直接上采样
    if (image.width < MIN_SIZE || image.height < MIN_SIZE) {
        const up = upscale(raw, image.width, image.height, UPSCALE_FACTOR);
        variants.push({
            label: 'upscaled',
            imageData: { data: up.data, width: up.width, height: up.height, colorSpace: 'srgb' },
        });
    }
    // 大图优先添加缩小变体（更快、减少噪点干扰）
    addDownscaledVariants(raw, image.width, image.height, variants);
    // 原始图
    variants.push({
        label: 'original',
        imageData: { data: raw, width: image.width, height: image.height, colorSpace: 'srgb' },
    });
    // 灰度 + 二值化
    if (image.width * image.height * 4 === raw.length) {
        const gray = toGraysane(raw, image.width, image.height);
        variants.push({
            label: 'grayscale',
            imageData: { data: grayToRGBA(gray, image.width, image.height), width: image.width, height: image.height, colorSpace: 'srgb' },
        });
        const thresh = otsuThreshold(gray, image.width * image.height);
        const binary = new Uint8ClampedArray(image.width * image.height * 4);
        for (let i = 0; i < image.width * image.height; i++) {
            const v = gray[i] >= thresh ? 255 : 0;
            const off = i * 4;
            binary[off] = v;
            binary[off + 1] = v;
            binary[off + 2] = v;
            binary[off + 3] = 255;
        }
        variants.push({
            label: 'binary',
            imageData: { data: binary, width: image.width, height: image.height, colorSpace: 'srgb' },
        });
    }
    return variants;
}
function decodeImage(buffer) {
    if (isPNG(buffer)) {
        return pngjs_1.PNG.sync.read(buffer);
    }
    if (isJPEG(buffer)) {
        return (0, jpeg_js_1.decode)(buffer);
    }
    throw new Error('不支持的图片格式（仅支持 PNG/JPEG）');
}
/** 使用 ZBar 尝试解码 */
async function tryZBar(variant) {
    try {
        const symbols = await (0, zbar_wasm_1.scanImageData)(variant.imageData);
        if (symbols.length > 0)
            return symbols[0].decode();
    }
    catch { /* ignore */ }
    return null;
}
/** 使用 jsQR 尝试解码 */
function tryJsQR(data, width, height) {
    try {
        const result = (0, jsqr_1.default)(data, width, height);
        return result?.data ?? null;
    }
    catch { /* ignore */ }
    return null;
}
const decodeQRFromBuffer = async (buffer) => {
    const variants = generateVariants(buffer);
    const errors = [];
    // 第一轮：ZBar on all variants
    for (const v of variants) {
        const result = await tryZBar(v);
        if (result)
            return result;
    }
    // 第二轮：jsQR on all variants
    for (const v of variants) {
        const d = v.imageData;
        const result = tryJsQR(d.data, d.width, d.height);
        if (result)
            return result;
    }
    throw new Error('未在图片中发现二维码');
};
exports.decodeQRFromBuffer = decodeQRFromBuffer;
const decodeQRFromUrl = async (imageUrl) => {
    const { downloadBinary } = await Promise.resolve().then(() => __importStar(require('./request')));
    const buffer = await downloadBinary(imageUrl);
    return (0, exports.decodeQRFromBuffer)(buffer);
};
exports.decodeQRFromUrl = decodeQRFromUrl;
const decodeQRFromBase64 = async (base64) => {
    const buffer = Buffer.from(base64, 'base64');
    return (0, exports.decodeQRFromBuffer)(buffer);
};
exports.decodeQRFromBase64 = decodeQRFromBase64;
