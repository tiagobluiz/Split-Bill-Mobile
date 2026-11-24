import { useCallback, useRef, useState } from "react";
import { useTranslation } from "../../../../i18n/provider";
import { areSameInvoicePhotos } from "../../invoicePhotos";

export function useSplitDetailsSave() {
  const { t } = useTranslation();
  const savingRef = useRef(false);
  const pickingRef = useRef(false);
  const [picking, setPicking] = useState(false);
  const [savingMessage, setSavingMessage] = useState("");
  const isBusy = useCallback(() => savingRef.current || pickingRef.current, []);
  const onPickingChange = (active: boolean) => {
    pickingRef.current = active;
    setPicking(active);
  };

  const save = async (
    selectedUri: string | null,
    previousUri: string | null | undefined,
    action: () => Promise<void>,
  ) => {
    if (isBusy()) return;
    savingRef.current = true;
    setSavingMessage(t(selectedUri && !areSameInvoicePhotos(selectedUri, previousUri)
      ? "splitDetails.savingPhoto"
      : "splitDetails.savingDetails"));
    try {
      await action();
    } finally {
      savingRef.current = false;
      setSavingMessage("");
    }
  };

  return {
    save,
    savingRef,
    isBusy,
    onPickingChange,
    progressMessage: savingMessage || (picking ? t("splitDetails.preparingPhoto") : ""),
  };
}
