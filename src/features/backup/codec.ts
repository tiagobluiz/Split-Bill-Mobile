import pako from "pako";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

import type { BackupSnapshotV1 } from "./types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 210_000;

function ensurePassphrase(passphrase: string | undefined) {
  if (!passphrase || !passphrase.trim()) {
    throw new Error("missing-backup-passphrase");
  }
  return passphrase.trim();
}

function deriveKey(passphrase: string, salt: Uint8Array) {
  return pbkdf2(sha256, passphrase, salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: KEY_LENGTH,
  });
}

export function encodeBackupSnapshot(
  data: unknown,
  options: {
    createdAt: string;
    appVersion: string;
    deviceLocale: string;
    passphrase?: string;
  },
): BackupSnapshotV1 {
  const rawBytes = textEncoder.encode(JSON.stringify(data));
  const compressed = pako.gzip(rawBytes);
  const encryptionEnabled = Boolean(options.passphrase?.trim());

  if (!encryptionEnabled) {
    return {
      schemaVersion: 1,
      createdAt: options.createdAt,
      appVersion: options.appVersion,
      deviceLocale: options.deviceLocale,
      compression: "gzip",
      encryption: { enabled: false },
      payloadBase64: naclUtil.encodeBase64(compressed),
    };
  }

  const passphrase = ensurePassphrase(options.passphrase);
  const salt = nacl.randomBytes(16);
  const nonce = nacl.randomBytes(24);
  const key = deriveKey(passphrase, salt);
  const encrypted = nacl.secretbox(compressed, nonce, key);

  return {
    schemaVersion: 1,
    createdAt: options.createdAt,
    appVersion: options.appVersion,
    deviceLocale: options.deviceLocale,
    compression: "gzip",
    encryption: {
      enabled: true,
      algorithm: "xsalsa20poly1305",
      kdf: {
        name: "pbkdf2",
        hash: "sha256",
        iterations: PBKDF2_ITERATIONS,
        keyLength: KEY_LENGTH,
      },
      saltBase64: naclUtil.encodeBase64(salt),
      nonceBase64: naclUtil.encodeBase64(nonce),
    },
    payloadBase64: naclUtil.encodeBase64(encrypted),
  };
}

export function decodeBackupSnapshot(
  snapshot: BackupSnapshotV1,
  passphrase?: string,
) {
  let payloadBytes = naclUtil.decodeBase64(snapshot.payloadBase64);

  if (snapshot.encryption.enabled) {
    const phrase = ensurePassphrase(passphrase);
    const salt = naclUtil.decodeBase64(snapshot.encryption.saltBase64);
    const nonce = naclUtil.decodeBase64(snapshot.encryption.nonceBase64);
    const key = deriveKey(phrase, salt);
    const opened = nacl.secretbox.open(payloadBytes, nonce, key);
    if (!opened) {
      throw new Error("invalid-backup-passphrase");
    }
    payloadBytes = opened;
  }

  const rawBytes = pako.ungzip(payloadBytes);
  const rawText = textDecoder.decode(rawBytes);

  return JSON.parse(rawText) as unknown;
}
