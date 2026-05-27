import { buildClipboardSummary } from "../../domain";
import { t } from "../../i18n";
import { getDeviceLocale } from "../../lib/device";
import type { DraftRecord } from "../../storage/records";
import { STEP_ROUTE, resolveDraftStep } from "./splitFlow";

export function getDraftPendingStep(record: DraftRecord) {
  return resolveDraftStep(record);
}

export function buildRecordRoute(record: DraftRecord) {
  if (record.status === "completed") {
    const summary = buildClipboardSummary(record.values, getDeviceLocale(), {
      settledParticipantIds: record.settlementState?.settledParticipantIds ?? [],
    });
    return summary ? `/split/${record.id}/results` : `/split/${record.id}/overview`;
  }

  const pendingStep = getDraftPendingStep(record);
  if (pendingStep === 5) {
    return `/split/${record.id}/overview`;
  }
  const route = STEP_ROUTE[pendingStep as keyof typeof STEP_ROUTE];
  return `/split/${record.id}/${route}`;
}

export function getRecordTitle(record: DraftRecord) {
  return (
    record.values.splitName?.trim() ||
    record.values.items[0]?.name ||
    t("record.title.untitled")
  );
}

