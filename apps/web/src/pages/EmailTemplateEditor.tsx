import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { EmailPreviewButton, EmailPreviewDialog } from "@/components/email/EmailPreview";
import { PageHeader } from "@/components/common/PageHeader";
import { RichTextEditor } from "@/components/email/RichTextEditor";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createEmailTemplateRequest,
  emptyTemplateDraft,
  fetchEmailTemplateRequest,
  templateToDraft,
  updateEmailTemplateRequest,
  type UpsertEmailTemplatePayload,
} from "@/api/email-templates";
import { getApiErrorMessage } from "@/lib/api-error";
import { queryKeys } from "@/lib/query-keys";
import { usePermission } from "@/hooks/use-permission";
import { useQueryErrorToast } from "@/hooks/use-query-error-toast";

export default function EmailTemplateEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { can } = usePermission();
  const canWrite = can("emails:write");

  const isNew = !id || id === "new";
  const templateId = !isNew && id ? Number(id) : null;
  const invalidId = !isNew && (!templateId || !Number.isFinite(templateId));

  const [draft, setDraft] = useState<UpsertEmailTemplatePayload>(emptyTemplateDraft());
  const [saving, setSaving] = useState(false);
  const [draftInitialized, setDraftInitialized] = useState(isNew);
  const [previewOpen, setPreviewOpen] = useState(false);

  const {
    data: loadedTemplate,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.emailTemplates.detail(templateId ?? 0),
    queryFn: () => fetchEmailTemplateRequest(templateId!),
    enabled: !isNew && !invalidId && templateId != null,
  });

  useQueryErrorToast(isError, "emailTemplates.loadError");

  useEffect(() => {
    if (!loadedTemplate || draftInitialized) return;
    setDraft(templateToDraft(loadedTemplate));
    setDraftInitialized(true);
  }, [draftInitialized, loadedTemplate]);

  useEffect(() => {
    if (isError) {
      navigate("/emails/templates");
    }
  }, [isError, navigate]);

  useEffect(() => {
    if (!canWrite && !isLoading && draftInitialized) {
      navigate("/emails/templates");
    }
  }, [canWrite, draftInitialized, isLoading, navigate]);

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast.error(t("emailTemplates.nameRequired"));
      return;
    }

    const payload: UpsertEmailTemplatePayload = {
      ...draft,
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      subject: draft.subject?.trim() || undefined,
      htmlBody: draft.htmlBody?.trim() || undefined,
    };

    setSaving(true);
    try {
      if (isNew) {
        await createEmailTemplateRequest(payload);
        toast.success(t("emailTemplates.created"));
      } else {
        await updateEmailTemplateRequest(templateId!, payload);
        toast.success(t("emailTemplates.updated"));
      }
      navigate("/emails/templates");
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("emailTemplates.saveError")));
    } finally {
      setSaving(false);
    }
  };

  if (invalidId) {
    return null;
  }

  if (!isNew && !invalidId && isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={isNew ? t("emailTemplates.createTitle") : t("emailTemplates.editTitle")}
        subtitle={t("emailTemplates.formSubtitle")}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to="/emails/templates">
                <ArrowLeft className="h-4 w-4" />
                {t("emailTemplates.backToList")}
              </Link>
            </Button>
            <EmailPreviewButton
              onClick={() => setPreviewOpen(true)}
              disabled={!draft.htmlBody?.trim() && !draft.subject?.trim()}
            />
            <PermissionGate permission="emails:write">
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? t("emailTemplates.saving") : t("common.save")}
              </Button>
            </PermissionGate>
          </>
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card className="shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{t("emailTemplates.detailsSection")}</CardTitle>
            <CardDescription>{t("emailTemplates.detailsSectionHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">{t("emailTemplates.name")}</Label>
              <Input
                id="template-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={t("emailTemplates.namePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">{t("emailTemplates.description")}</Label>
              <Textarea
                id="template-description"
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder={t("emailTemplates.descriptionPlaceholder")}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-subject">{t("emailTemplates.subject")}</Label>
              <Input
                id="template-subject"
                value={draft.subject ?? ""}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                placeholder={t("emailTemplates.subjectPlaceholder")}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card xl:min-h-[calc(100vh-12rem)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{t("emailTemplates.body")}</CardTitle>
            <CardDescription>{t("emailTemplates.bodySectionHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <RichTextEditor
              value={draft.htmlBody ?? ""}
              onChange={(html) => setDraft({ ...draft, htmlBody: html })}
              placeholder={t("emailTemplates.bodyPlaceholder")}
              minHeight={560}
            />
          </CardContent>
        </Card>
      </div>

      <EmailPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        subject={draft.subject}
        html={draft.htmlBody ?? ""}
      />
    </>
  );
}
