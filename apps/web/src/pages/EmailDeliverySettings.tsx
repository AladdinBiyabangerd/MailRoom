import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AxiosError } from "axios";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
  Save,
  Send,
  Server,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { emailDeliveryApi, type EmailDeliverySettings } from "@/api/emailDelivery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ApiErrorShape = { message?: string };

const defaultSettings: EmailDeliverySettings = {
  host: "",
  port: 587,
  username: "",
  password: "",
};

const normalizeSettings = (
  raw: Partial<EmailDeliverySettings> | null | undefined,
  options?: { clearPassword?: boolean },
): EmailDeliverySettings => ({
  host: typeof raw?.host === "string" ? raw.host : "",
  port: typeof raw?.port === "number" && Number.isFinite(raw.port) ? raw.port : 587,
  username: typeof raw?.username === "string" ? raw.username : "",
  password: options?.clearPassword ? "" : typeof raw?.password === "string" ? raw.password : "",
});

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof AxiosError && error.response?.data) {
    const data = error.response.data as ApiErrorShape;
    if (data.message) return data.message;
  }
  return fallback;
};

export default function EmailDeliverySettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<EmailDeliverySettings>(defaultSettings);
  const [testEmail, setTestEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const response = await emailDeliveryApi.getSettings();
        setSettings(normalizeSettings(response, { clearPassword: true }));
        setHasExistingConfig(true);
      } catch (error) {
        if (error instanceof AxiosError && error.response?.status === 404) {
          setHasExistingConfig(false);
          setSettings(defaultSettings);
          return;
        }
        toast.error(getErrorMessage(error, t("emailDelivery.loadFailed")));
      } finally {
        setIsLoading(false);
      }
    };

    void fetchSettings();
  }, [t]);

  const canSave = useMemo(() => {
    return Boolean(
      settings.host.trim() &&
        settings.port > 0 &&
        settings.username.trim() &&
        (hasExistingConfig || (settings.password ?? "").trim()),
    );
  }, [settings, hasExistingConfig]);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) {
      toast.error(t("emailDelivery.validation"));
      return;
    }

    setIsSaving(true);
    try {
      const response = hasExistingConfig
        ? await emailDeliveryApi.updateSettings(settings)
        : await emailDeliveryApi.createSettings(settings);
      setSettings(normalizeSettings(response, { clearPassword: true }));
      setHasExistingConfig(true);
      toast.success(t("emailDelivery.saved"), {
        description: t("emailDelivery.savedDesc"),
      });
    } catch (error) {
      toast.error(getErrorMessage(error, t("emailDelivery.saveFailed")));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error(t("emailDelivery.testRecipientRequired"));
      return;
    }

    setIsSendingTest(true);
    try {
      await emailDeliveryApi.sendTestEmail({ email: testEmail.trim() });
      toast.success(t("emailDelivery.testSuccess"), {
        description: t("emailDelivery.testSuccessDesc"),
      });
    } catch (error) {
      toast.error(getErrorMessage(error, t("emailDelivery.testFailed")));
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <PermissionGate permission="mail-config:read">
      <div className="space-y-6">
        <PageHeader
          title={t("emailDelivery.title")}
          subtitle={t("emailDelivery.subtitle")}
        />

        <Card className="overflow-hidden border-0 bg-gradient-to-r from-violet-500/15 via-sky-500/10 to-emerald-500/15 shadow-card">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                {t("emailDelivery.headerBadge")}
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold sm:text-2xl">{t("emailDelivery.headerTitle")}</h2>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-8 min-w-8 rounded-full px-2 font-bold"
                  onClick={() => setShowHelpDialog(true)}
                  aria-label={t("emailDelivery.helpOpen")}
                >
                  ?
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{t("emailDelivery.headerDesc")}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <Card className="shadow-card border border-primary/20 xl:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                {t("emailDelivery.serverConfig")}
              </CardTitle>
              <CardDescription>{t("emailDelivery.serverConfigDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t("common.loading")}
                </div>
              ) : (
                <form className="space-y-5" onSubmit={handleSave}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="port">{t("emailDelivery.port")}</Label>
                      <Input
                        id="port"
                        type="number"
                        min={1}
                        max={65535}
                        value={settings.port}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            port: Number(event.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="host">{t("emailDelivery.host")}</Label>
                    <Input
                      id="host"
                      placeholder="smtp.gmail.com"
                      value={settings.host}
                      onChange={(event) => setSettings((prev) => ({ ...prev, host: event.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="username">{t("emailDelivery.username")}</Label>
                      <Input
                        id="username"
                        placeholder="you@example.com"
                        value={settings.username}
                        onChange={(event) =>
                          setSettings((prev) => ({ ...prev, username: event.target.value }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">{t("emailDelivery.password")}</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder={t("emailDelivery.passwordPlaceholder")}
                          value={settings.password ?? ""}
                          onChange={(event) =>
                            setSettings((prev) => ({ ...prev, password: event.target.value }))
                          }
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowPassword((prev) => !prev)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <PermissionGate permission="mail-config:write">
                      <Button type="submit" disabled={isSaving || !canSave} className="w-full sm:w-auto">
                        {isSaving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        {isSaving ? t("emailDelivery.saving") : t("emailDelivery.save")}
                      </Button>
                    </PermissionGate>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border border-emerald-400/20 bg-gradient-to-b from-background to-emerald-500/5 xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailCheck className="h-5 w-5 text-emerald-600" />
                {t("emailDelivery.diagnostics")}
              </CardTitle>
              <CardDescription>{t("emailDelivery.diagnosticsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{t("emailDelivery.status")}</p>
                  <Badge
                    className={
                      canSave
                        ? "bg-emerald-500 text-white hover:bg-emerald-500"
                        : "bg-muted text-muted-foreground hover:bg-muted"
                    }
                  >
                    {canSave ? t("emailDelivery.enabled") : t("emailDelivery.disabled")}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t("emailDelivery.statusHint")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-email">{t("emailDelivery.testRecipient")}</Label>
                <Input
                  id="test-email"
                  type="email"
                  placeholder="qa@example.com"
                  value={testEmail}
                  onChange={(event) => setTestEmail(event.target.value)}
                />
              </div>

              <PermissionGate permission="mail-config:write">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleSendTestEmail}
                  disabled={isSendingTest || !testEmail.trim() || !hasExistingConfig}
                >
                  {isSendingTest ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  {isSendingTest ? t("emailDelivery.sendingTest") : t("emailDelivery.sendTest")}
                </Button>
              </PermissionGate>

              <div className="rounded-lg border bg-background/60 p-3 text-xs text-muted-foreground">
                <CheckCircle2 className="mb-2 h-4 w-4 text-emerald-600" />
                {t("emailDelivery.tips")}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("emailDelivery.helpTitle")}</DialogTitle>
            <DialogDescription>{t("emailDelivery.helpDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>{t("emailDelivery.helpWhereToGet")}</p>
            <p>{t("emailDelivery.helpHost")}</p>
            <p>{t("emailDelivery.helpPort")}</p>
            <p>{t("emailDelivery.helpUsername")}</p>
            <p>{t("emailDelivery.helpPassword")}</p>
            <div className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-primary">
              {t("emailDelivery.helpDefaultFallback")}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PermissionGate>
  );
}
