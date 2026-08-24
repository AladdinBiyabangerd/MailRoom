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
  registerRequest,
  resendOtpRequest,
} from "@/api/auth";
import { useAuth } from "@/context/AuthContext";
import { getApiErrorMessage } from "@/lib/api-error";

function createRegisterSchema(t: (key: string) => string) {
  return z
    .object({
      firstName: z.string().min(2, t("auth.validation.firstNameMin")),
      lastName: z.string().min(2, t("auth.validation.lastNameMin")),
      email: z.string().email(t("auth.validation.invalidEmail")),
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
}

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { verifyOtp } = useAuth();
  const [stage, setStage] = useState<"REGISTER" | "VERIFY">("REGISTER");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const registerSchema = createRegisterSchema(t);
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      passwordConfirm: "",
    },
  });

  const handleRegisterSubmit = async (data: z.infer<typeof registerSchema>) => {
    setIsLoading(true);
    setError(null);
    try {
      await registerRequest({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email,
        password: data.password,
        passwordConfirm: data.passwordConfirm,
      });
      setEmail(data.email);
      setStage("VERIFY");
    } catch (err) {
      setError(getApiErrorMessage(err, t("auth.register.failed")));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await verifyOtp(email, parseInt(code, 10));
      navigate("/", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, t("auth.otp.invalidCode")));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    try {
      await resendOtpRequest({ email, purpose: "ACCOUNT_ACTIVATION" });
    } catch (err) {
      setError(getApiErrorMessage(err, t("auth.otp.resendFailed")));
    }
  };

  return (
    <AuthLayout
      title={stage === "REGISTER" ? t("auth.register.title") : t("auth.otp.title")}
      description={
        stage === "REGISTER"
          ? t("auth.register.subtitle")
          : t("auth.otp.subtitle", { email })
      }
    >
      {stage === "REGISTER" ? (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleRegisterSubmit)}
            className="space-y-4"
          >
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.register.firstName")}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="given-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.register.lastName")}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="family-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
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

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.password")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" autoComplete="new-password" />
                  </FormControl>
                  <PasswordRequirements password={field.value || ""} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="passwordConfirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.register.confirmPassword")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" autoComplete="new-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? t("auth.register.submitting") : t("auth.register.submit")}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t("auth.register.hasAccount")}{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                {t("auth.signIn")}
              </Link>
            </p>
          </form>
        </Form>
      ) : (
        <OtpVerificationForm
          onSubmit={handleVerifySubmit}
          isLoading={isLoading}
          error={error}
          onResend={handleResendOtp}
        />
      )}
    </AuthLayout>
  );
}
