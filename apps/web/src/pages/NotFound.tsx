import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-hero px-4 text-center">
      <p className="text-7xl font-bold text-gradient">404</p>
      <h1 className="mt-4 text-xl font-semibold text-foreground">
        {t("errors.notFoundTitle")}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {t("errors.notFoundBody")}
      </p>
      <Button asChild className="mt-6">
        <Link to="/">{t("errors.goHome")}</Link>
      </Button>
    </div>
  );
}
