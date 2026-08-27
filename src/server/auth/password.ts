import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/** Precomputed bcrypt of a dummy string at cost 12. Used so unknown emails take the same time as known ones. */
export const DUMMY_PASSWORD_HASH =
  "$2b$12$C1UFMtMVbv/tjjsUQE1jUemKvdBOW55/K/mSJbWWGN.LUVbqCjHqe";
