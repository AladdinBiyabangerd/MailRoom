import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchEmailSenderIdentitiesRequest, pickDefaultSenderId } from "@/api/email-sender-identities";
import { queryKeys } from "@/lib/query-keys";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SenderIdentitySelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}

export function SenderIdentitySelect({
  id = "sender-identity",
  value,
  onChange,
}: SenderIdentitySelectProps) {
  const { t } = useTranslation();

  const { data: senders = [], isLoading } = useQuery({
    queryKey: queryKeys.emailSenderIdentities.list(),
    queryFn: fetchEmailSenderIdentitiesRequest,
  });

  useEffect(() => {
    if (!value && senders.length > 0) {
      const defaultId = pickDefaultSenderId(senders);
      if (defaultId) onChange(defaultId);
    }
  }, [senders, value, onChange]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{t("emails.fromSender")}</Label>
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (senders.length === 0) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{t("emails.fromSender")}</Label>
        <p className="text-sm text-muted-foreground">{t("emailSenders.noneConfigured")}</p>
      </div>
    );
  }

  const selected = value || pickDefaultSenderId(senders) || "";

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("emails.fromSender")}</Label>
      <Select value={selected} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={t("emails.fromSenderPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {senders.map((sender) => (
            <SelectItem key={sender.id} value={sender.id}>
              {sender.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t("emails.fromSenderHint")}</p>
    </div>
  );
}
