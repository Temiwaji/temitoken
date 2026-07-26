/** Uniform pick using the Web Crypto RNG instead of Math.random. */
export function pickRandom<T>(items: T[]): T {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const index = buf[0] % items.length;
  return items[index];
}
