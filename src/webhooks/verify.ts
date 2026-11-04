import crypto from "crypto";
import { env } from "@/config/env";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("webhook-verify");

// IEEE 802.3 CRC32 implementation
export function crc32(buf: Buffer | string): number {
  if (typeof buf === "string") {
    buf = Buffer.from(buf, "utf-8");
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Host validation for PayPal certificate URL (Amendment A3)
 * Rules: https only, no userinfo, host === "paypal.com" or endsWith(".paypal.com") (dot boundary).
 */
export function validateCertUrl(certUrlStr: string): boolean {
  try {
    const url = new URL(certUrlStr);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;

    const hostname = url.hostname.toLowerCase();
    return hostname === "paypal.com" || hostname.endsWith(".paypal.com");
  } catch {
    return false;
  }
}

// In-memory certificate cache (certUrl -> public key PEM)
const certCache = new Map<string, string>();

export async function getPublicKeyFromCert(certUrl: string): Promise<string> {
  if (certCache.has(certUrl)) {
    return certCache.get(certUrl)!;
  }

  if (!validateCertUrl(certUrl)) {
    throw new Error(`Security Violation: Certificate URL ${certUrl} does not belong to a verified PayPal domain!`);
  }

  const res = await fetch(certUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch certificate from ${certUrl}: ${res.status} ${res.statusText}`);
  }

  const certPem = await res.text();
  const cert = new crypto.X509Certificate(certPem);
  const publicKeyPem = cert.publicKey.export({ type: "spki", format: "pem" }).toString();
  certCache.set(certUrl, publicKeyPem);
  return publicKeyPem;
}

export interface WebhookVerificationParams {
  transmissionId: string;
  transmissionTime: string;
  webhookId: string;
  certUrl: string;
  authAlgo?: string;
  transmissionSig: string;
  rawBody: string;
  toleranceSeconds?: number;
}

export type WebhookVerificationStatus =
  | "VALID"
  | "INVALID"
  | "TAMPERED"
  | "STALE_TIMESTAMP"
  | "BAD_CERT_HOST";

export interface WebhookVerificationResult {
  valid: boolean;
  status: WebhookVerificationStatus;
  signingString: string;
  crc: number;
  error?: string;
}

export async function verifyPayPalWebhookSignature(
  params: WebhookVerificationParams
): Promise<WebhookVerificationResult> {
  const tolerance = params.toleranceSeconds ?? env.PAYPAL_WEBHOOK_TOLERANCE_SECONDS;
  const rawBodyCrc = crc32(params.rawBody);
  const signingString = `${params.transmissionId}|${params.transmissionTime}|${params.webhookId}|${rawBodyCrc}`;

  // 1. Host validation
  if (!validateCertUrl(params.certUrl)) {
    log.warn({ certUrl: params.certUrl }, "Webhook rejected: Invalid certificate host URL");
    return {
      valid: false,
      status: "BAD_CERT_HOST",
      signingString,
      crc: rawBodyCrc,
      error: "Certificate URL must be an https URL strictly on paypal.com or *.paypal.com with no userinfo.",
    };
  }

  // 2. Timestamp staleness check
  const txTimeMs = new Date(params.transmissionTime).getTime();
  if (isNaN(txTimeMs)) {
    return {
      valid: false,
      status: "INVALID",
      signingString,
      crc: rawBodyCrc,
      error: "Malformed transmission time header.",
    };
  }

  const ageSeconds = Math.abs(Date.now() - txTimeMs) / 1000;
  if (ageSeconds > tolerance) {
    log.warn({ ageSeconds, tolerance }, "Webhook rejected: Timestamp is stale");
    return {
      valid: false,
      status: "STALE_TIMESTAMP",
      signingString,
      crc: rawBodyCrc,
      error: `Transmission time difference (${ageSeconds.toFixed(1)}s) exceeds tolerance (${tolerance}s).`,
    };
  }

  // 3. Fetch public key and verify RSA-SHA256 signature
  try {
    const publicKeyPem = await getPublicKeyFromCert(params.certUrl);
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(signingString);
    const valid = verifier.verify(publicKeyPem, params.transmissionSig, "base64");

    if (!valid) {
      log.warn({ transmissionId: params.transmissionId }, "Webhook rejected: Signature verification failed (TAMPERED)");
      return {
        valid: false,
        status: "TAMPERED",
        signingString,
        crc: rawBodyCrc,
        error: "Cryptographic signature does not match payload and headers.",
      };
    }

    return {
      valid: true,
      status: "VALID",
      signingString,
      crc: rawBodyCrc,
    };
  } catch (err) {
    log.error({ err }, "Error during webhook cryptographic verification");
    return {
      valid: false,
      status: "INVALID",
      signingString,
      crc: rawBodyCrc,
      error: (err as Error).message,
    };
  }
}
