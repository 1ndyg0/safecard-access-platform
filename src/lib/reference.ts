import { randomInt } from 'node:crypto';

const REFERENCE_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateApplicationReference(now = new Date()): string {
  let code = '';
  for (let index = 0; index < 8; index += 1) {
    code += REFERENCE_CHARSET[randomInt(REFERENCE_CHARSET.length)];
  }
  return `SC-${now.getUTCFullYear()}-${code}`;
}
