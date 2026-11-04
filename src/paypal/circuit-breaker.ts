import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("circuit-breaker");

export class CircuitBreakerOpenError extends Error {
  constructor(message = "PayPal circuit breaker is OPEN. Fast failing request.") {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

export class CircuitBreaker {
  private failureCount = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private nextAttemptTimestamp = 0;
  private readonly threshold: number;
  private readonly coolOffMs: number;

  constructor(threshold = 5, coolOffMs = 30000) {
    this.threshold = threshold;
    this.coolOffMs = coolOffMs;
  }

  public getState() {
    return this.state;
  }

  public beforeRequest(): void {
    if (this.state === "OPEN") {
      if (Date.now() > this.nextAttemptTimestamp) {
        log.info("Circuit breaker entering HALF_OPEN state to probe service reachability.");
        this.state = "HALF_OPEN";
      } else {
        throw new CircuitBreakerOpenError();
      }
    }
  }

  public recordSuccess(): void {
    if (this.state !== "CLOSED") {
      log.info("Circuit breaker closed: Service recovered.");
    }
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  public recordFailure(isTransient = true): void {
    if (!isTransient) return;

    this.failureCount++;
    log.warn({ failureCount: this.failureCount, threshold: this.threshold }, "Circuit breaker recorded transient failure");

    if (this.state === "HALF_OPEN" || this.failureCount >= this.threshold) {
      this.state = "OPEN";
      this.nextAttemptTimestamp = Date.now() + this.coolOffMs;
      log.error({ nextAttempt: new Date(this.nextAttemptTimestamp).toISOString() }, "Circuit breaker TRIPPED to OPEN state");
    }
  }

  public reset(): void {
    this.failureCount = 0;
    this.state = "CLOSED";
    this.nextAttemptTimestamp = 0;
  }
}
