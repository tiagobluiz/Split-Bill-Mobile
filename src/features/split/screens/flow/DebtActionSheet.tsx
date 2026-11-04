import { Bell, Check } from "lucide-react-native";
import { useTranslation } from "../../../../i18n/provider";
import { PALETTE } from "../../../../theme/palette";
import { ActionListSheet } from "../shared/ActionListSheet";

type DebtTarget = { id: string; name: string; settled: boolean };

export function DebtActionSheet({ visible, target, tracking, hasReminder, bottomInset, onDismiss, onDismissComplete, onPayment, onReminder }: {
  visible: boolean; target: DebtTarget | null; tracking: boolean; hasReminder: boolean; bottomInset: number;
  onDismiss: () => void; onDismissComplete: () => void;
  onPayment: (target: DebtTarget) => void; onReminder: (target: DebtTarget) => void;
}) {
  const { t } = useTranslation();
  return <ActionListSheet visible={visible} title={target?.name ?? ""} cancelLabel={t("common.cancel")} bottomInset={bottomInset} onDismiss={onDismiss} onDismissComplete={onDismissComplete} options={target ? [
    ...(tracking ? [{ label: t(target.settled ? "flow.results.debtMarkUnpaid" : "flow.results.debtMarkPaid"), icon: <Check color={PALETTE.primary} size={22} />, onPress: () => onPayment(target) }] : []),
    ...(!target.settled ? [{ label: t(hasReminder ? "reminders.actionEdit" : "reminders.actionSet"), icon: <Bell color={PALETTE.primary} size={22} />, onPress: () => onReminder(target) }] : []),
  ] : []} />;
}
