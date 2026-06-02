"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.delay = void 0;
/**
 * @param {number} timeout 作为等待时间，单位是秒
 */
const delay = async (timeout = 0) => {
    await new Promise((res) => setTimeout(() => res(), timeout * 1000));
};
exports.delay = delay;
