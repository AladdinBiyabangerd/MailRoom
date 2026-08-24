import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PasswordRequirements({ password }: { password: string }) {
  const { t } = useTranslation();

  const requirements = [
    {
      label: t("auth.passwordRequirements.chars"),
      met: password.length >= 6 && password.length <= 30,
    },
    {
      label: t("auth.passwordRequirements.uppercase"),
      met: /[A-Z]/.test(password),
    },
    {
      label: t("auth.passwordRequirements.lowercase"),
      met: /[a-z]/.test(password),
    },
    {
      label: t("auth.passwordRequirements.number"),
      met: /\d/.test(password),
    },
  ];

  return (
    <div className="mt-1 text-xs">
      <div className="flex flex-wrap gap-2">
        {requirements.map((req) => (
          <span
            key={req.label}
            className={`flex items-center gap-1 ${req.met ? "text-green-600" : "text-muted-foreground"}`}
          >
            {req.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {req.label}
          </span>
        ))}
      </div>
      <p className="mt-1 text-muted-foreground">
        {t("auth.passwordRequirements.allowedChars")}
      </p>
    </div>
  );
}
