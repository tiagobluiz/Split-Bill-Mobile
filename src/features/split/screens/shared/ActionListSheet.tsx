import type { ReactNode } from "react";
import { BottomActionSheet } from "./BottomActionSheet";

export function ActionListSheet({ visible, title, cancelLabel, bottomInset, options, onDismiss, onDismissComplete, rowMinHeight, simpleRows }: {
  visible: boolean;
  title: string;
  cancelLabel: string;
  bottomInset: number;
  options: Array<{
    label: string;
    accessibilityLabel?: string;
    description?: string;
    icon: ReactNode;
    onPress: () => void;
    tone?: "default" | "danger";
    disabled?: boolean;
  }>;
  onDismiss: () => void;
  onDismissComplete?: () => void;
  rowMinHeight?: number;
  simpleRows?: boolean;
}) {
  return <BottomActionSheet visible={visible} title={title} cancelLabel={cancelLabel} bottomInset={bottomInset} options={options} onDismiss={onDismiss} onDismissComplete={onDismissComplete} rowMinHeight={rowMinHeight} simpleRows={simpleRows} />;
}
