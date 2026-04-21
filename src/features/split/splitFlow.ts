import { validateStepOne, validateStepTwo } from "../../domain";
import type { DraftRecord } from "../../storage/records";

export const STEP_ROUTE = {
  1: "setup",
  2: "participants",
  3: "payer",
  4: "items",
  5: "overview",
  6: "results",
} as const;

export function deriveMaxReachableStep(record: DraftRecord) {
  if (record.status === "completed") {
    return 6;
  }

  const stepOneErrors = validateStepOne(record.values);
  const participantOnlyErrors = stepOneErrors.filter((error) => error.path !== "payerParticipantId");
  if (participantOnlyErrors.length > 0) {
    return 2;
  }

  if (stepOneErrors.length > 0) {
    return 3;
  }

  if (validateStepTwo(record.values).length > 0) {
    return 4;
  }

  return 5;
}

export function resolveDraftStep(record: DraftRecord) {
  const maxReachableStep = deriveMaxReachableStep(record);
  if (record.status === "completed") {
    return maxReachableStep;
  }

  const requestedStep = Number.isFinite(record.step) ? Math.trunc(record.step) : 1;
  const normalizedRequestedStep = Math.min(Math.max(requestedStep, 1), 5);
  return Math.min(normalizedRequestedStep, maxReachableStep);
}
