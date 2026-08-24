import { useEffect, useRef } from "react";
import { toast } from "sonner";
import i18n from "@/i18n";

/** Shows a toast once per error cycle — avoids putting `t` in fetch effect deps. */
export function useQueryErrorToast(isError: boolean, messageKey: string): void {
  const toasted = useRef(false);

  useEffect(() => {
    if (!isError) {
      toasted.current = false;
      return;
    }
    if (toasted.current) return;
    toasted.current = true;
    toast.error(i18n.t(messageKey));
  }, [isError, messageKey]);
}
