/**
 * @param {number} timeout 作为等待时间，单位是秒
 */
const delay = async (timeout = 0) => {
  await new Promise<void>((res) => setTimeout(() => res(), timeout * 1000));
};

export { delay };
