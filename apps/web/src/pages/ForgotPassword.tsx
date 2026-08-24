import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { OtpVerificationForm } from "@/components/auth/OtpVerificationForm";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";
import {
  forgotPasswordRequest,
  resendOtpRequest,
  resetPasswordRequest,
  verifyResetCodeRequest,
} from "@/api/auth";
import { getApiErrorMessage } from "@/lib/api-error";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stage, setStage] = useState<"REQUEST" | "VERIFY" | "RESET">("REQUEST");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const emailSchema = z.object({
    email: z.string().email(t("auth.validation.invalidEmail")),
  });

  const resetSchema = z
    .object({
      password: z
        .string()
        .min(6, t("auth.validation.passwordMin"))
        .max(30, t("auth.validation.passwordMax"))
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*]{6,}$/,
          t("auth.validation.passwordComplexity"),
        ),
      passwordConfirm: z.string(),
    })
    .refine((data) => data.password === data.passwordConfirm, {
      message: t("auth.validation.passwordsDoNotMatch"),
      path: ["passwordConfirm"],
    });

  const requestForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", passwordConfirm: "" },
  });

  const handleRequestSubmit = async (data: z.infer<typeof emailSchema>) => {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await forgotPasswordRequest(data.email);
      setEmail(data.email);
      setStage("VERIFY");
      setSuccessMsg(t("auth.forgotPassword.codeSent"));
    } catch {
      setError(t("auth.forgotPassword.failedSend"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (code: string) => {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await verifyResetCodeRequest({ email, code });
      setStage("RESET");
      setSuccessMsg(t("auth.forgotPassword.codeVerified"));
    } catch (err) {
      setError(getApiErrorMessage(err, t("auth.forgotPassword.invalidCode")));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    try {
      await resendOtpRequest({ email, purpose: "PASSWORD_RESET" });
      setSuccessMsg(t("auth.forgotPassword.codeSent"));
    } catch (err) {
      setError(getApiErrorMessage(err, t("auth.forgotPassword.failedSend")));
    }
  };

  const handleResetSubmit = async (data: z.infer<typeof resetSchema>) => {
    setIsLoading(true);
    setError(null);
    try {
      await resetPasswordRequest({
        email,
        newPassword: data.password,
        retryPassword: data.passwordConfirm,
      });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, t("auth.forgotPassword.failedReset")));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.forgotPassword.title")}
      description={
        stage === "REQUEST"
          ? t("auth.forgotPassword.subtitleRequest")
          : stage === "VERIFY"
            ? t("auth.forgotPassword.subtitleVerify", { email })
            : t("auth.forgotPassword.subtitleReset")
      }
    >
      {error && stage !== "VERIFY" && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {successMsg && !error && (
        <Alert className="mb-4 border-green-200 bg-green-50 text-green-900">
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {stage === "REQUEST" && (
        <Form {...requestForm}>
          <form
            onSubmit={requestForm.handleSubmit(handleRequestSubmit)}
            className="space-y-4"
          >
            <FormField
              control={requestForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.email")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" autoComplete="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading
                ? t("auth.forgotPassword.sending")
                : t("auth.forgotPassword.sendCode")}
            </Button>
            <p className="text-center text-sm">
              <Link to="/login" className="font-medium text-primary hover:underline">
                {t("auth.forgotPassword.backToLogin")}
              </Link>
            </p>
          </form>
        </Form>
      )}

      {stage === "VERIFY" && (
        <div className="space-y-4">
          <OtpVerificationForm
            onSubmit={handleVerifySubmit}
            isLoading={isLoading}
            error={error}
            onResend={handleResendOtp}
          />
          <div className="text-center">
            <Button variant="link" onClick={() => setStage("REQUEST")}>
              {t("auth.forgotPassword.changeEmail")}
            </Button>
          </div>
        </div>
      )}

      {stage === "RESET" && (
        <Form {...resetForm}>
          <form
            onSubmit={resetForm.handleSubmit(handleResetSubmit)}
            className="space-y-4"
          >
            <FormField
              control={resetForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.forgotPassword.newPassword")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" autoComplete="new-password" />
                  </FormControl>
                  <PasswordRequirements password={field.value || ""} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={resetForm.control}
              name="passwordConfirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.forgotPassword.confirmPassword")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" autoComplete="new-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading
                ? t("auth.forgotPassword.resetting")
                : t("auth.forgotPassword.resetPassword")}
            </Button>
          </form>
        </Form>
      )}
    </AuthLayout>
  );
}
