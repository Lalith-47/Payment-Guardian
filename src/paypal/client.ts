import crypto from "crypto";
import { env } from "@/config/env";
import { createChildLogger } from "@/lib/logger";
import { CircuitBreaker } from "./circuit-breaker";

const log = createChildLogger("paypal-client");

// Global circuit breaker instance for PayPal API calls
export const paypalCircuitBreaker = new CircuitBreaker(5, 30000);

// In-memory OAuth token cache
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export interface PayPalCaptureSuccess {
  success: true;
  declined: false;
  orderId: string;
  captureId: string;
  status: string;
  statusCode?: number;
  amount: { currency_code: string; value: string };
  raw: Record<string, unknown>;
}

export interface PayPalCaptureDecline {
  success: false;
  declined: true;
  orderId: string;
  statusCode?: number;
  issue: "INSTRUMENT_DECLINED" | "TRANSACTION_REFUSED" | string;
  description: string;
  debugId: string | null;
  raw: Record<string, unknown>;
}

export type PayPalCaptureResult = PayPalCaptureSuccess | PayPalCaptureDecline;

export function buildPaymentTerm(
  dueDays: number | null | undefined,
  defaultDueDays: number = 15,
  baseDate: Date = new Date()
): { term_type: string; due_date?: string } {
  const days = dueDays !== null && dueDays !== undefined ? dueDays : defaultDueDays;

  if (days === 0) {
    return { term_type: "DUE_ON_RECEIPT" };
  }

  const standardNetDays = [10, 15, 30, 45, 60, 90];
  if (standardNetDays.includes(days)) {
    return { term_type: `NET_${days}` };
  }

  const dueDateObj = new Date(baseDate.getTime() + days * 86400000);
  const dueDateStr = dueDateObj.toISOString().split("T")[0];
  return {
    term_type: "DUE_ON_DATE_SPECIFIED",
    due_date: dueDateStr,
  };
}

export class PayPalClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly timeoutMs: number;

  constructor(customBaseUrl?: string, timeoutMs = 10000) {
    this.baseUrl = (customBaseUrl || env.PAYPAL_BASE_URL).replace(/\/+$/, "");
    this.clientId = env.PAYPAL_CLIENT_ID;
    this.clientSecret = env.PAYPAL_CLIENT_SECRET;
    this.timeoutMs = timeoutMs;

    // Hard sandbox verification
    const parsed = new URL(this.baseUrl);
    if (!parsed.hostname.includes("sandbox")) {
      throw new Error(`CRITICAL: Refusing to initialize PayPalClient with non-sandbox URL: ${parsed.hostname}`);
    }
  }

  /**
   * OAuth 2.0 Client Credentials token with automatic in-memory caching.
   */
  public async getAccessToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    // Use cached token if valid for at least another 60 seconds
    if (!forceRefresh && cachedToken && tokenExpiresAt > now + 60000) {
      return cachedToken;
    }

    log.debug("Requesting fresh PayPal OAuth token...");
    const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");

    const res = await this.requestWithRetry(
      `${this.baseUrl}/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: "grant_type=client_credentials",
      },
      false // do not inject bearer token into oauth request
    );

    if (!res.ok) {
      const errText = await res.text();
      log.error({ status: res.status, body: errText }, "PayPal OAuth token request failed");
      throw new Error(`PayPal OAuth Failed (HTTP ${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = data.access_token;
    tokenExpiresAt = now + data.expires_in * 1000;

    log.info({ expiresIn: data.expires_in }, "PayPal OAuth token successfully acquired and cached");
    return cachedToken;
  }

  /**
   * Core HTTP request handler with Circuit Breaker, timeout, and bounded exponential backoff retries.
   */
  private async requestWithRetry(
    url: string,
    options: RequestInit,
    injectBearer = true,
    maxRetries = 2
  ): Promise<Response> {
    paypalCircuitBreaker.beforeRequest();

    let attempt = 0;
    while (true) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const headers = new Headers(options.headers || {});
        if (injectBearer) {
          const token = await this.getAccessToken();
          headers.set("Authorization", `Bearer ${token}`);
        }

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Success or standard client error (4xx) - circuit breaker considers service reachable
        if (response.status < 500) {
          paypalCircuitBreaker.recordSuccess();
          return response;
        }

        // 5xx Server Error: Candidate for retry
        log.warn(
          { status: response.status, attempt, url },
          "PayPal returned 5xx server error, evaluating retry..."
        );
        paypalCircuitBreaker.recordFailure(true);

        if (attempt > maxRetries) {
          return response;
        }
      } catch (err) {
        clearTimeout(timeoutId);
        const isAbort = (err as Error).name === "AbortError";
        log.warn({ err, attempt, isAbort }, "Network/Timeout error executing PayPal API call");
        paypalCircuitBreaker.recordFailure(true);

        if (attempt > maxRetries) {
          throw err;
        }
      }

      // Exponential backoff with jitter (e.g. 500ms * 2^attempt + jitter)
      const delay = Math.pow(2, attempt) * 500 + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // ==========================================
  // ORDERS API (v2)
  // ==========================================

  public async createOrder(params: {
    amount: string;
    currency: string;
    description?: string;
    returnUrl?: string;
    cancelUrl?: string;
    requestId?: string;
  }): Promise<{ id: string; status: string; approveLink: string | null; raw: Record<string, unknown> }> {
    const isE2E = (process.env.STACK_ROLE === "e2e" || env.STACK_ROLE === "e2e") && process.env.STACK_ROLE !== "demo";
    const requestId = params.requestId || crypto.randomUUID();
    const endpoint = `${this.baseUrl}/v2/checkout/orders`;

    const purchaseUnit: Record<string, unknown> = {
      reference_id: `rg_order_${Date.now()}`,
      description: params.description || "Revenue Guardian Order",
      amount: {
        currency_code: params.currency,
        value: params.amount,
      },
    };
    if (isE2E) {
      purchaseUnit.custom_id = `e2e_${Date.now()}`;
    }

    const payload = {
      intent: "CAPTURE",
      purchase_units: [purchaseUnit],
      application_context: {
        brand_name: "Revenue Guardian",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        return_url: params.returnUrl || "http://localhost:3000/order-return",
        cancel_url: params.cancelUrl || "http://localhost:3000/order-cancel",
      },
    };

    const res = await this.requestWithRetry(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PayPal-Request-Id": requestId,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`PayPal Create Order Failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
    }

    const links = (data.links as Array<{ rel: string; href: string }>) || [];
    const approveLinkObj = links.find((l) => l.rel === "approve" || l.rel === "payer-action");

    return {
      id: data.id as string,
      status: data.status as string,
      approveLink: approveLinkObj?.href || null,
      raw: data,
    };
  }

  public async getOrder(orderId: string): Promise<Record<string, unknown>> {
    const endpoint = `${this.baseUrl}/v2/checkout/orders/${orderId}`;
    const res = await this.requestWithRetry(endpoint, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`PayPal Get Order Failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
    }

    return data;
  }

  public async captureOrder(params: {
    orderId: string;
    requestId?: string;
    mockCode?: "INSTRUMENT_DECLINED" | "TRANSACTION_REFUSED";
  }): Promise<PayPalCaptureResult> {
    const requestId = params.requestId || crypto.randomUUID();
    const endpoint = `${this.baseUrl}/v2/checkout/orders/${params.orderId}/capture`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "PayPal-Request-Id": requestId,
      Prefer: "return=representation",
    };

    // Amendment A2: Simulate decline control
    if (params.mockCode) {
      if (!env.SANDBOX_NEGATIVE_TESTING) {
        throw new Error("SANDBOX_NEGATIVE_TESTING is disabled in env; mockCode cannot be provided.");
      }
      if (params.mockCode !== "INSTRUMENT_DECLINED" && params.mockCode !== "TRANSACTION_REFUSED") {
        throw new Error(
          `Invalid mock code: ${params.mockCode}. Only INSTRUMENT_DECLINED or TRANSACTION_REFUSED are permitted.`
        );
      }
      headers["PayPal-Mock-Response"] = JSON.stringify({ mock_application_codes: params.mockCode });
      log.warn({ orderId: params.orderId, mockCode: params.mockCode }, "Executing negative testing capture mock");
    }

    const res = await this.requestWithRetry(endpoint, {
      method: "POST",
      headers,
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawText: text };
    }

    // Check for synchronous 422 decline (Amendment A1)
    if (res.status === 422) {
      const details = (data.details as Array<{ issue: string; description: string }>) || [];
      const primaryIssue = details[0] || {
        issue: (data.name as string) || "UNKNOWN",
        description: (data.message as string) || "Payment capture declined",
      };

      log.warn(
        { orderId: params.orderId, issue: primaryIssue.issue, debugId: res.headers.get("paypal-debug-id") },
        "Order capture synchronously declined"
      );

      return {
        success: false,
        declined: true,
        orderId: params.orderId,
        statusCode: res.status,
        issue: primaryIssue.issue,
        description: primaryIssue.description,
        debugId: res.headers.get("paypal-debug-id"),
        raw: data,
      };
    }

    if (!res.ok) {
      throw new Error(`PayPal Capture Order Failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
    }

    // Successful capture
    const purchaseUnits = (data.purchase_units as Array<Record<string, unknown>>) || [];
    const payments = (purchaseUnits[0]?.payments as Record<string, unknown>) || {};
    const captures = (payments.captures as Array<Record<string, unknown>>) || [];
    const firstCapture = captures[0] || {};

    return {
      success: true,
      declined: false,
      orderId: params.orderId,
      captureId: (firstCapture.id as string) || (data.id as string),
      status: (data.status as string) || "COMPLETED",
      statusCode: res.status,
      amount: (firstCapture.amount as { currency_code: string; value: string }) || {
        currency_code: "USD",
        value: "0.00",
      },
      raw: data,
    };
  }

  // ==========================================
  // INVOICING API (v2)
  // ==========================================

  public async generateNextInvoiceNumber(): Promise<string> {
    const endpoint = `${this.baseUrl}/v2/invoicing/generate-next-invoice-number`;
    const res = await this.requestWithRetry(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      const data = (await res.json()) as { invoice_number?: string };
      if (data.invoice_number) return data.invoice_number;
    }

    return `INV-${Date.now()}`;
  }

  public async createDraftInvoice(params: {
    recipientEmail: string;
    amount: string;
    currency: string;
    itemName?: string;
    note?: string;
    requestId?: string;
    dueDays?: number | null;
    defaultDueDays?: number;
    paymentTerm?: { term_type: string; due_date?: string };
  }): Promise<{ id: string; invoiceNumber: string; status: string; raw: Record<string, unknown> }> {
    const isE2E = (process.env.STACK_ROLE === "e2e" || env.STACK_ROLE === "e2e") && process.env.STACK_ROLE !== "demo";
    const requestId = params.requestId || crypto.randomUUID();
    const rawNumber = await this.generateNextInvoiceNumber();
    const invoiceNumber = isE2E ? `E2E-${rawNumber}` : rawNumber;
    const businessEmail = env.PAYPAL_BUSINESS_EMAIL || "merchant@example.com";
    const todayStr = new Date().toISOString().split("T")[0];
    const paymentTerm =
      params.paymentTerm ||
      buildPaymentTerm(params.dueDays, params.defaultDueDays ?? 15);

    const payload = {
      detail: {
        invoice_number: invoiceNumber,
        invoice_date: todayStr,
        currency_code: params.currency,
        note: params.note || "Revenue Guardian Invoice",
        payment_term: paymentTerm,
      },
      invoicer: {
        name: { given_name: "Revenue", surname: "Guardian" },
        email_address: businessEmail,
      },
      primary_recipients: [
        {
          billing_info: {
            name: { given_name: "Client", surname: "Customer" },
            email_address: params.recipientEmail,
          },
        },
      ],
      items: [
        {
          name: params.itemName || "Services Rendered",
          quantity: "1",
          unit_amount: { currency_code: params.currency, value: params.amount },
          unit_of_measure: "QUANTITY",
        },
      ],
      amount: {
        currency_code: params.currency,
        value: params.amount,
        breakdown: {
          item_total: { currency_code: params.currency, value: params.amount },
        },
      },
    };

    const res = await this.requestWithRetry(`${this.baseUrl}/v2/invoicing/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PayPal-Request-Id": requestId,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`PayPal Create Draft Invoice Failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
    }

    return {
      id: data.id as string,
      invoiceNumber,
      status: data.status as string,
      raw: data,
    };
  }

  public async sendInvoice(
    invoiceId: string,
    requestId?: string
  ): Promise<{ success: boolean; raw: Record<string, unknown> }> {
    const reqId = requestId || crypto.randomUUID();
    const endpoint = `${this.baseUrl}/v2/invoicing/invoices/${invoiceId}/send`;

    const res = await this.requestWithRetry(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PayPal-Request-Id": reqId,
      },
      body: JSON.stringify({
        send_to_recipient: true,
        send_to_invoicer: false,
      }),
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      throw new Error(`PayPal Send Invoice Failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
    }

    return { success: true, raw: data };
  }

  public async getInvoice(
    invoiceId: string
  ): Promise<{ status: string; payerViewUrl: string | null; raw: Record<string, unknown> }> {
    const endpoint = `${this.baseUrl}/v2/invoicing/invoices/${invoiceId}`;
    const res = await this.requestWithRetry(endpoint, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`PayPal Get Invoice Failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
    }

    const detail = (data.detail as Record<string, unknown>) || {};
    const metadata = (detail.metadata as Record<string, unknown>) || {};
    const payerViewUrl = (metadata.payer_view_url as string) || null;

    return {
      status: (data.status as string) || "UNKNOWN",
      payerViewUrl,
      raw: data,
    };
  }

  // ==========================================
  // REFUNDS API (v2)
  // ==========================================

  public async refundCapture(params: {
    captureId: string;
    amount?: string;
    currency?: string;
    note?: string;
    requestId?: string;
  }): Promise<{ id: string; status: string; raw: Record<string, unknown> }> {
    const requestId = params.requestId || crypto.randomUUID();
    const endpoint = `${this.baseUrl}/v2/payments/captures/${params.captureId}/refund`;

    const bodyObj: Record<string, unknown> = {};
    if (params.amount && params.currency) {
      bodyObj.amount = {
        value: params.amount,
        currency_code: params.currency,
      };
    }
    if (params.note) {
      bodyObj.note_to_payer = params.note;
    }

    const res = await this.requestWithRetry(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PayPal-Request-Id": requestId,
        Prefer: "return=representation",
      },
      body: Object.keys(bodyObj).length > 0 ? JSON.stringify(bodyObj) : "{}",
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`PayPal Refund Capture Failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
    }

    return {
      id: data.id as string,
      status: data.status as string,
      raw: data,
    };
  }

  public async getRefund(refundId: string): Promise<Record<string, unknown>> {
    const endpoint = `${this.baseUrl}/v2/payments/refunds/${refundId}`;
    const res = await this.requestWithRetry(endpoint, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`PayPal Get Refund Failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
    }

    return data;
  }

  // ==========================================
  // WEBHOOKS MANAGEMENT API
  // ==========================================

  public async listWebhooks(): Promise<Array<{ id: string; url: string; event_types: Array<{ name: string }> }>> {
    const endpoint = `${this.baseUrl}/v1/notifications/webhooks`;
    const res = await this.requestWithRetry(endpoint, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = (await res.json()) as { webhooks?: Array<{ id: string; url: string; event_types: Array<{ name: string }> }> };
    if (!res.ok) {
      throw new Error(`PayPal List Webhooks Failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
    }

    return data.webhooks || [];
  }

  public async createWebhook(
    url: string,
    eventNames: string[] = [
      "CHECKOUT.ORDER.APPROVED",
      "PAYMENT.CAPTURE.COMPLETED",
      "PAYMENT.CAPTURE.REFUNDED",
      "INVOICING.INVOICE.PAID",
    ]
  ): Promise<{ id: string; url: string }> {
    const endpoint = `${this.baseUrl}/v1/notifications/webhooks`;
    const payload = {
      url,
      event_types: eventNames.map((name) => ({ name })),
    };

    const res = await this.requestWithRetry(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as { id: string; url: string };
    if (!res.ok) {
      throw new Error(`PayPal Create Webhook Failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
    }

    return { id: data.id, url: data.url };
  }

  public async updateWebhookUrl(webhookId: string, newUrl: string): Promise<void> {
    const endpoint = `${this.baseUrl}/v1/notifications/webhooks/${webhookId}`;
    const patchPayload = [
      {
        op: "replace",
        path: "/url",
        value: newUrl,
      },
    ];

    const res = await this.requestWithRetry(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`PayPal Update Webhook Failed (HTTP ${res.status}): ${errText}`);
    }
  }

  public async deleteWebhook(webhookId: string): Promise<void> {
    const endpoint = `${this.baseUrl}/v1/notifications/webhooks/${webhookId}`;
    const res = await this.requestWithRetry(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok && res.status !== 404) {
      const errText = await res.text();
      throw new Error(`PayPal Delete Webhook Failed (HTTP ${res.status}): ${errText}`);
    }
  }
}

export const paypalClient = new PayPalClient();
