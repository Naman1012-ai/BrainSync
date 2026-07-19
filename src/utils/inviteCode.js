import { INVITE_CODE_LENGTH } from '../config/constants';

/**
 * Generates an 8-character uppercase alphanumeric invite code.
 * Example output: "BX7K9M2P"
 */
export function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous 0, O, 1, I
  let code = '';
  const cryptoObj = window.crypto || window.msCrypto;

  if (cryptoObj && cryptoObj.getRandomValues) {
    const randomValues = new Uint32Array(INVITE_CODE_LENGTH);
    cryptoObj.getRandomValues(randomValues);
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      code += chars[randomValues[i] % chars.length];
    }
  } else {
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }

  return code;
}
