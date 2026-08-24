import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BrandMark } from "@/components/common/BrandLogo";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-hero px-4 py-10">
      <div className="grid-pattern absolute inset-0 opacity-60" />
      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark className="h-12 w-12" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        <div className="glass-strong shadow-elegant rounded-2xl p-6 sm:p-8">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t("auth.secureNote")}
        </p>
      </div>
    </div>
  );
}
