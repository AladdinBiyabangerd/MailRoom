import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import * as z from "zod";
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

const RESEND_COOLDOWN_SECONDS = 60;

interface OtpVerificationFormProps {
  onSubmit: (code: string) => void;
  isLoading: boolean;
  error?: string | null;
  onResend?: () => void | Promise<void>;
}

export function OtpVerificationForm({
  onSubmit,
  isLoading,
  error,
  onResend,
}: OtpVerificationFormProps) {
  const { t } = useTranslation();
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const otpSchema = z.object({
    code: z
      .string()
      .length(6, { message: t("auth.otp.codeLength") })
      .regex(/^\d{6}$/, { message: t("auth.otp.codeLength") }),
  });

  const form = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  const handleResend = useCallback(async () => {
    if (!onResend || cooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      await onResend();
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } finally {
      setIsResending(false);
    }
  }, [onResend, cooldown, isResending]);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => onSubmit(data.code))}
        className="space-y-4"
      >
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.otp.verificationCode")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className="text-center text-lg tracking-[0.4em]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? t("auth.otp.verifying") : t("auth.otp.verifyCode")}
        </Button>

        {onResend && (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={handleResend}
            disabled={isLoading || cooldown > 0 || isResending}
          >
            {isResending
              ? t("auth.otp.resending")
              : cooldown > 0
                ? t("auth.otp.resendIn", { seconds: cooldown })
                : t("auth.otp.resendCode")}
          </Button>
        )}
      </form>
    </Form>
  );
}
