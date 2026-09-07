import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BrandMark } from "@/components/common/BrandLogo";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

const BUILDER_NAME = "Aladdin Biyabangerd";
const PORTFOLIO_ORIGIN = "https://aladdinbiyabangerd.site";

function builderPortfolioUrl(language: string): string {
  const code = language.slice(0, 2).toLowerCase();
  const pathLocale = code === "az" || code === "ru" ? code : "en";
  const url = new URL(`/${pathLocale}`, PORTFOLIO_ORIGIN);
  url.searchParams.set("utm_source", "mailroom");
  url.searchParams.set("utm_medium", "organic_social");
  url.searchParams.set("utm_campaign", "portfolio");
  url.searchParams.set("utm_content", "auth_credit");
  return url.toString();
}

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  const { t, i18n } = useTranslation();

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
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {t("auth.builderCredit")}{" "}
          <a
            href={builderPortfolioUrl(i18n.language)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground/85 underline decoration-border underline-offset-2 hover:text-foreground hover:decoration-current transition-colors"
          >
            {BUILDER_NAME}
            <span aria-hidden> ↗</span>
          </a>
        </p>
      </div>
    </div>
  );
}
