import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { OtpVerificationForm } from "@/components/auth/OtpVerificationForm";
import { useAuth } from "@/context/AuthContext";
import { resendOtpRequest } from "@/api/auth";
import { isDemoMode } from "@/api/client";
import { DEMO_CREDENTIALS } from "@/api/auth";
import { getApiErrorMessage, isInvalidCredentials } from "@/lib/api-error";

export default function Login() {
  const { t } = useTranslation();
  const { login, verifyOtp, activationEmail, setActivationEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(isDemoMode ? DEMO_CREDENTIALS.email : "");
  const [password, setPassword] = useState(isDemoMode ? DEMO_CREDENTIALS.password : "");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"LOGIN" | "ACTIVATION">("LOGIN");

  const from = (location.state as { from?: Location })?.from?.pathname ?? "/";
  const activeEmail = activationEmail ?? email;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login({ email, password });
      if (result === "REQUIRES_ACTIVATION") {
        setStage("ACTIVATION");
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(
        isInvalidCredentials(err)
          ? t("auth.invalidCredentials")
          : getApiErrorMessage(err, t("auth.genericError")),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleActivationSubmit = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      await verifyOtp(activeEmail, parseInt(code, 10));
      navigate(from, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, t("auth.otp.invalidCode")));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    try {
      await resendOtpRequest({
        email: activeEmail,
        purpose: "ACCOUNT_ACTIVATION",
      });
    } catch (err) {
      setError(getApiErrorMessage(err, t("auth.otp.resendFailed")));
    }
  };

  if (stage === "ACTIVATION") {
    return (
      <AuthLayout
        title={t("auth.otp.title")}
        description={t("auth.otp.subtitle", { email: activeEmail })}
      >
        <OtpVerificationForm
          onSubmit={handleActivationSubmit}
          isLoading={loading}
          error={error}
          onResend={handleResendOtp}
        />
        <div className="mt-4 text-center">
          <Button
            variant="link"
            onClick={() => {
              setStage("LOGIN");
              setActivationEmail(null);
            }}
          >
            {t("auth.forgotPassword.backToLogin")}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("auth.title")} description={t("auth.subtitle")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.passwordPlaceholder")}
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox id="remember" defaultChecked />
            {t("auth.rememberMe")}
          </label>
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("auth.forgotPassword.link")}
          </Link>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? t("auth.signingIn") : t("auth.signIn")}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {t("auth.register.invited")}{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            {t("auth.register.completeRegistration")}
          </Link>
        </p>
      </form>

      {isDemoMode && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Demo: {DEMO_CREDENTIALS.email} · {DEMO_CREDENTIALS.password}
        </p>
      )}
    </AuthLayout>
  );
}
