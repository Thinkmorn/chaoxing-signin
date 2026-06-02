import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
import { scanImageData } from '@undecaf/zbar-wasm';
import jsQR from 'jsqr';

const MIN_SIZE = 300;
const UPSCALE_FACTOR = 2;

export const extractEnc = (url: string): string | null => {
  const match = url.match(/[?&]enc=([^&]+)/);
  return match ? match[1] : null;
};

export const extractActiveId = (url: string): string | null => {
  const match = url.match(/[?&]activeId=([^&]+)/) || url.match(/[?&]id=(\d+)/);
  return match ? match[1] : null;
};

function isPNG(buf: Buffer): boolean {
  return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
}

function isJPEG(buf: Buffer): boolean {
  return buf[0] === 0xFF && buf[1] === 0xD8;
}

/** 将 RGBA 数据转为灰度 Uint8Array */
function toGraysane(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const off = i * 4;
    gray[i] = (data[off] * 0.299 + data[off + 1] * 0.587 + data[off + 2] * 0.114) | 0;
  }
  return gray;
}

/** 区域平均下采样 — 缩小大图，减少噪点干扰 */
function downscale(data: Uint8ClampedArray, width: number, height: number, factor: number): { data: Uint8ClampedArray; width: number; height: number } {
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
          r += data[si]; g += data[si + 1]; b += data[si + 2]; a += data[si + 3];
          count++;
        }
      }
      const di = (y * nw + x) * 4;
      out[di] = r / count; out[di + 1] = g / count; out[di + 2] = b / count; out[di + 3] = a / count;
    }
  }
  return { data: out, width: nw, height: nh };
}

/** 最近邻插值上采样 */
function upscale(data: Uint8ClampedArray, width: number, height: number, factor: number): { data: Uint8ClampedArray; width: number; height: number } {
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
function grayToRGBA(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
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
function otsuThreshold(gray: Uint8ClampedArray, total: number): number {
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
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
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
function addDownscaledVariants(raw: Uint8ClampedArray, w: number, h: number, variants: Array<{ imageData: ImageData; label: string }>): void {
  const scales = w > 2000 || h > 2000 ? [4, 2] : w > 1000 || h > 1000 ? [2] : [];
  for (const factor of scales) {
    const ds = downscale(raw, w, h, factor);
    variants.push({
      label: `down${factor}x`,
      imageData: { data: ds.data, width: ds.width, height: ds.height, colorSpace: 'srgb' } as ImageData,
    });
    const gray = toGraysane(ds.data, ds.width, ds.height);
    variants.push({
      label: `down${factor}x_gray`,
      imageData: { data: grayToRGBA(gray, ds.width, ds.height), width: ds.width, height: ds.height, colorSpace: 'srgb' } as ImageData,
    });
  }
}

/** 生成多个图像变体以提高解码成功率（从快到慢排列） */
function generateVariants(buffer: Buffer): Array<{ imageData: ImageData; label: string }> {
  const image = decodeImage(buffer);
  const raw = new Uint8ClampedArray(image.data);
  const variants: Array<{ imageData: ImageData; label: string }> = [];

  // 小图直接上采样
  if (image.width < MIN_SIZE || image.height < MIN_SIZE) {
    const up = upscale(raw, image.width, image.height, UPSCALE_FACTOR);
    variants.push({
      label: 'upscaled',
      imageData: { data: up.data, width: up.width, height: up.height, colorSpace: 'srgb' } as ImageData,
    });
  }

  // 大图优先添加缩小变体（更快、减少噪点干扰）
  addDownscaledVariants(raw, image.width, image.height, variants);

  // 原始图
  variants.push({
    label: 'original',
    imageData: { data: raw, width: image.width, height: image.height, colorSpace: 'srgb' } as ImageData,
  });

  // 灰度 + 二值化
  if (image.width * image.height * 4 === raw.length) {
    const gray = toGraysane(raw, image.width, image.height);
    variants.push({
      label: 'grayscale',
      imageData: { data: grayToRGBA(gray, image.width, image.height), width: image.width, height: image.height, colorSpace: 'srgb' } as ImageData,
    });
    const thresh = otsuThreshold(gray, image.width * image.height);
    const binary = new Uint8ClampedArray(image.width * image.height * 4);
    for (let i = 0; i < image.width * image.height; i++) {
      const v = gray[i] >= thresh ? 255 : 0;
      const off = i * 4;
      binary[off] = v; binary[off + 1] = v; binary[off + 2] = v; binary[off + 3] = 255;
    }
    variants.push({
      label: 'binary',
      imageData: { data: binary, width: image.width, height: image.height, colorSpace: 'srgb' } as ImageData,
    });
  }

  return variants;
}

function decodeImage(buffer: Buffer): { data: Buffer; width: number; height: number } {
  if (isPNG(buffer)) {
    return PNG.sync.read(buffer);
  }
  if (isJPEG(buffer)) {
    return decodeJpeg(buffer);
  }
  throw new Error('不支持的图片格式（仅支持 PNG/JPEG）');
}

/** 使用 ZBar 尝试解码 */
async function tryZBar(variant: { imageData: ImageData; label: string }): Promise<string | null> {
  try {
    const symbols = await scanImageData(variant.imageData);
    if (symbols.length > 0) return symbols[0].decode();
  } catch { /* ignore */ }
  return null;
}

/** 使用 jsQR 尝试解码 */
function tryJsQR(data: Uint8ClampedArray, width: number, height: number): string | null {
  try {
    const result = jsQR(data, width, height);
    return result?.data ?? null;
  } catch { /* ignore */ }
  return null;
}

export const decodeQRFromBuffer = async (buffer: Buffer): Promise<string> => {
  const variants = generateVariants(buffer);
  const errors: string[] = [];

  // 第一轮：ZBar on all variants
  for (const v of variants) {
    const result = await tryZBar(v);
    if (result) return result;
  }

  // 第二轮：jsQR on all variants
  for (const v of variants) {
    const d = v.imageData;
    const result = tryJsQR(d.data, d.width, d.height);
    if (result) return result;
  }

  throw new Error('未在图片中发现二维码');
};

export const decodeQRFromUrl = async (imageUrl: string): Promise<string> => {
  const { downloadBinary } = await import('./request');
  const buffer = await downloadBinary(imageUrl);
  return decodeQRFromBuffer(buffer);
};

export const decodeQRFromBase64 = async (base64: string): Promise<string> => {
  const buffer = Buffer.from(base64, 'base64');
  return decodeQRFromBuffer(buffer);
};
