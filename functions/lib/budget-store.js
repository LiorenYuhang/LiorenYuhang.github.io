export function createMemoryBudgetStore(limits) {
  limits = limits || {};
  let day = new Date().toISOString().slice(0, 10);
  let requests = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let reservedInputTokens = 0;
  let reservedOutputTokens = 0;
  const maxOutputTokens = limits.maxOutputTokens ?? 800;
  const reservations = new Map();

  function resetIfNeeded() {
    const current = new Date().toISOString().slice(0, 10);
    if (day !== current) {
      day = current;
      requests = 0;
      inputTokens = 0;
      outputTokens = 0;
      reservedInputTokens = 0;
      reservedOutputTokens = 0;
      reservations.clear();
    }
  }

  function transition(requestId, from, to) {
    resetIfNeeded();
    const reservation = reservations.get(requestId);
    if (!reservation || reservation.state !== from) return false;
    reservation.state = to;
    return reservation;
  }

  return {
    async reserveRequest({ requestId, estimatedInputTokens }) {
      resetIfNeeded();
      if (!Number.isInteger(estimatedInputTokens) || estimatedInputTokens < 0) throw new Error("invalid_parameter: estimatedInputTokens");
      if (reservations.has(requestId)) return { ok: false, reason: "duplicate_reservation" };
      if (requests >= (limits.dailyRequestLimit ?? 500)) return { ok: false, reason: "budget_exceeded" };
      if (inputTokens + reservedInputTokens + estimatedInputTokens > (limits.dailyInputTokenLimit ?? 200000)) return { ok: false, reason: "budget_exceeded" };
      if (outputTokens + reservedOutputTokens + maxOutputTokens > (limits.dailyOutputTokenLimit ?? 50000)) return { ok: false, reason: "budget_exceeded" };
      reservations.set(requestId, { state: "reserved", estimatedInputTokens, reservedOutputTokens: maxOutputTokens });
      requests++;
      reservedInputTokens += estimatedInputTokens;
      reservedOutputTokens += maxOutputTokens;
      return { ok: true };
    },
    async markDispatched({ requestId }) {
      return transition(requestId, "reserved", "dispatched")
        ? { ok: true }
        : { ok: false, reason: "reservation_not_reserved" };
    },
    async settleSuccess({ requestId, actualInputTokens, actualOutputTokens }) {
      if (!Number.isInteger(actualInputTokens) || actualInputTokens < 0 || !Number.isInteger(actualOutputTokens) || actualOutputTokens < 0) throw new Error("invalid_parameter: actualTokens");
      const reservation = transition(requestId, "dispatched", "settled");
      if (!reservation) return { ok: false, reason: "reservation_not_dispatched" };
      reservedInputTokens -= reservation.estimatedInputTokens;
      reservedOutputTokens -= reservation.reservedOutputTokens;
      inputTokens += actualInputTokens;
      outputTokens += actualOutputTokens;
      return { ok: true };
    },
    async settleRejected({ requestId }) {
      const reservation = transition(requestId, "dispatched", "rejected");
      if (!reservation) return { ok: false, reason: "reservation_not_dispatched" };
      reservedInputTokens -= reservation.estimatedInputTokens;
      reservedOutputTokens -= reservation.reservedOutputTokens;
      return { ok: true };
    },
    async settleUnknown({ requestId }) {
      const reservation = transition(requestId, "dispatched", "unknown");
      if (!reservation) return { ok: false, reason: "reservation_not_dispatched" };
      reservedInputTokens -= reservation.estimatedInputTokens;
      reservedOutputTokens -= reservation.reservedOutputTokens;
      inputTokens += reservation.estimatedInputTokens;
      outputTokens += reservation.reservedOutputTokens;
      return { ok: true };
    },
    async cancelBeforeDispatch({ requestId }) {
      const reservation = transition(requestId, "reserved", "cancelled");
      if (!reservation) return { ok: false, reason: "reservation_not_reserved" };
      requests--;
      reservedInputTokens -= reservation.estimatedInputTokens;
      reservedOutputTokens -= reservation.reservedOutputTokens;
      return { ok: true };
    },
    getDailyUsage() {
      resetIfNeeded();
      return { requests, inputTokens, outputTokens };
    },
    config: {
      dailyLimit: limits.dailyRequestLimit ?? 500,
      inputLimit: limits.dailyInputTokenLimit ?? 200000,
      outputLimit: limits.dailyOutputTokenLimit ?? 50000,
      maxOutput: maxOutputTokens,
    },
  };
}
