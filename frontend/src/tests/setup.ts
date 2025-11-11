import "@testing-library/jest-dom";

if (typeof crypto === "undefined" || !crypto.randomUUID) {
  globalThis.crypto = {
    ...(globalThis.crypto ?? {}),
    randomUUID: () => Math.random().toString(36).slice(2)
  } as Crypto;
}
