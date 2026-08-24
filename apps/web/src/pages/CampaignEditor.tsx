import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, FilePlus2, Loader2, Save, Send, Trash2 } from "lucide-react";
import { EmailPreviewButton, EmailPreviewDialog, EmailPreviewFrame } from "@/components/email/EmailPreview";
import { EmailAttachmentPicker } from "@/components/email/EmailAttachmentPicker";
import { PageHeader } from "@/components/common/PageHeader";
import { BulkEmailPasteButton } from "@/components/email/BulkEmailPasteDialog";
import { SavedContactPickerButton } from "@/components/email/SavedContactPicker";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { SenderIdentitySelect } from "@/components/email/SenderIdentitySelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  formatDateTimeLocal,
  getLocalTimezoneLabel,
  localDatetimeToIso,
  minScheduleDatetimeLocal,
} from "@/lib/schedule";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  campaignToDraft,
  createCampaignRequest,
  emptyCampaignDraft,
  fetchCampaignRequest,
  resolveCampaignContent,
  sendCampaignRequest,
  updateCampaignRequest,
  type UpsertEmailCampaignPayload,
} from "@/api/campaigns";
import {
  fetchEmailTemplateRequest,
  fetchEmailTemplatesRequest,
} from "@/api/email-templates";
import { getApiErrorMessage } from "@/lib/api-error";
import { queryKeys } from "@/lib/query-keys";
import { usePermission } from "@/hooks/use-permission";
import { useQueryErrorToast } from "@/hooks/use-query-error-toast";
import type { EmailAttachmentItem } from "@/lib/attachments";
import { MAX_ATTACHMENTS } from "@/lib/attachments";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEMPLATE_LIST_PARAMS = { page: 1, limit: 100 };

export default function CampaignEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { can } = usePermission();
  const canWrite = can("emails:write");

  const isNew = !id || id === "new";
  const campaignId = !isNew && id ? Number(id) : null;
  const invalidId = !isNew && (!campaignId || !Number.isFinite(campaignId));

  const [draft, setDraft] = useState<UpsertEmailCampaignPayload>(emptyCampaignDraft());
  const [saving, setSaving] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [draftInitialized, setDraftInitialized] = useState(isNew);
  const [sendOpen, setSendOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [scheduleSend, setScheduleSend] = useState(false);
  const [sendAttachments, setSendAttachments] = useState<EmailAttachmentItem[]>([]);
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [senderIdentityId, setSenderIdentityId] = useState("");

  const {
    data: loadedCampaign,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.campaigns.detail(campaignId ?? 0),
    queryFn: () => fetchCampaignRequest(campaignId!),
    enabled: !isNew && !invalidId && campaignId != null,
  });

  useQueryErrorToast(isError, "campaigns.loadError");

  const { data: templatesPage } = useQuery({
    queryKey: queryKeys.emailTemplates.list(TEMPLATE_LIST_PARAMS),
    queryFn: () => fetchEmailTemplatesRequest(TEMPLATE_LIST_PARAMS),
  });
  const templates = templatesPage?.items ?? [];
  const linkedTemplate = templates.find((template) => template.id === draft.templateId);
  const templateAttachments = linkedTemplate?.attachments ?? [];

  useEffect(() => {
    if (!loadedCampaign || draftInitialized) return;
    let cancelled = false;
    void (async () => {
      const base = campaignToDraft(loadedCampaign);
      if (loadedCampaign.templateId) {
        try {
          const content = await resolveCampaignContent(loadedCampaign);
          if (cancelled) return;
          setDraft({
            ...base,
            defaultSubject: content.subject ?? "",
            defaultHtmlBody: content.bodyHtml ?? "",
          });
        } catch {
          if (cancelled) return;
          setDraft(base);
        }
      } else {
        setDraft(base);
      }
      setDraftInitialized(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [draftInitialized, loadedCampaign]);

  useEffect(() => {
    if (isError) {
      navigate("/emails/campaigns");
    }
  }, [isError, navigate]);

  useEffect(() => {
    if (!canWrite && !isLoading && draftInitialized) {
      navigate("/emails/campaigns");
    }
  }, [canWrite, draftInitialized, isLoading, navigate]);

  const addContact = () => {
    const normalized = contactEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      toast.error(t("campaigns.invalidEmail"));
      return;
    }
    if (draft.contacts.some((c) => c.email === normalized)) {
      toast.error(t("campaigns.duplicateEmail"));
      return;
    }
    setDraft({
      ...draft,
      contacts: [
        ...draft.contacts,
        { email: normalized, name: contactName.trim() || undefined },
      ],
    });
    setContactEmail("");
    setContactName("");
  };

  const removeContact = (email: string) => {
    setDraft({
      ...draft,
      contacts: draft.contacts.filter((c) => c.email !== email),
    });
  };

  const importContacts = (imported: { email: string; name?: string }[]) => {
    const existing = new Set(draft.contacts.map((c) => c.email));
    const next = [...draft.contacts];
    let added = 0;
    for (const contact of imported) {
      if (existing.has(contact.email)) continue;
      existing.add(contact.email);
      next.push({ email: contact.email, name: contact.name });
      added += 1;
    }
    setDraft({ ...draft, contacts: next });
    if (added > 0) {
      toast.success(t("bulkEmailPaste.importSuccess", { count: added }));
    }
  };

  const selectedContactEmails = useMemo(
    () => new Set(draft.contacts.map((c) => c.email.toLowerCase())),
    [draft.contacts],
  );

  const handleTemplateChange = async (value: string) => {
    const templateId = Number(value);
    if (!Number.isFinite(templateId)) return;

    try {
      const template = await fetchEmailTemplateRequest(templateId);
      setDraft({
        ...draft,
        templateId,
        defaultSubject: template.subject || "",
        defaultHtmlBody: template.htmlBody || "",
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("emailTemplates.loadError")));
    }
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast.error(t("campaigns.nameRequired"));
      return;
    }
    if (!draft.templateId) {
      toast.error(t("campaigns.templateRequired"));
      return;
    }

    setSaving(true);
    try {
      const payload: UpsertEmailCampaignPayload = {
        ...draft,
        name: draft.name.trim(),
        description: draft.description?.trim() || undefined,
        // Content lives on the template — don't store a campaign copy.
        defaultSubject: undefined,
        defaultHtmlBody: undefined,
        templateId: draft.templateId,
      };

      if (isNew) {
        await createCampaignRequest(payload);
        toast.success(t("campaigns.created"));
      } else {
        await updateCampaignRequest(campaignId!, payload);
        toast.success(t("campaigns.updated"));
      }
      navigate("/emails/campaigns");
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("campaigns.saveError")));
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!campaignId) return;

    let scheduledAt: string | undefined;
    if (scheduleSend) {
      scheduledAt = localDatetimeToIso(scheduledAtLocal);
      if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) {
        toast.error(t("emails.validation.scheduleInPast"));
        return;
      }
    }

    setSending(true);
    try {
      const payload = {
        ...(scheduledAt ? { scheduledAt } : {}),
        ...(senderIdentityId ? { senderIdentityId: Number(senderIdentityId) } : {}),
        ...(sendAttachments.length
          ? {
              attachments: sendAttachments
                .filter((a) => a.contentBase64)
                .map((a) => ({
                  fileName: a.fileName,
                  contentType: a.contentType,
                  contentBase64: a.contentBase64!,
                })),
            }
          : {}),
      };
      const result = await sendCampaignRequest(
        campaignId,
        Object.keys(payload).length > 0 ? payload : undefined,
      );
      if (result.status === "scheduled") {
        toast.success(
          t("campaigns.scheduleSuccess", {
            count: result.recipientCount,
            time: formatDateTimeLocal(result.scheduledAt ?? result.sentAt),
          }),
        );
      } else {
        toast.success(t("campaigns.sendSuccess", { count: result.recipientCount }));
      }
      setSendOpen(false);
      setScheduleSend(false);
      setScheduledAtLocal("");
      setSenderIdentityId("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, t("campaigns.sendError")));
    } finally {
      setSending(false);
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
        title={isNew ? t("campaigns.createTitle") : t("campaigns.editTitle")}
        subtitle={t("campaigns.formSubtitle")}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to="/emails/campaigns">
                <ArrowLeft className="h-4 w-4" />
                {t("campaigns.backToList")}
              </Link>
            </Button>
            <EmailPreviewButton
              onClick={() => setPreviewOpen(true)}
              disabled={!draft.defaultHtmlBody?.trim() && !draft.defaultSubject?.trim()}
            />
            <PermissionGate permission="emails:write">
              {!isNew && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setSendOpen(true)}
                >
                  <Send className="h-4 w-4" />
                  {t("campaigns.send")}
                </Button>
              )}
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
                {saving ? t("campaigns.saving") : t("common.save")}
              </Button>
            </PermissionGate>
          </>
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">{t("campaigns.detailsSection")}</CardTitle>
              <CardDescription>{t("campaigns.detailsSectionHint")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">{t("campaigns.name")}</Label>
                <Input
                  id="campaign-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder={t("campaigns.namePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign-description">{t("campaigns.description")}</Label>
                <Textarea
                  id="campaign-description"
                  value={draft.description ?? ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder={t("campaigns.descriptionPlaceholder")}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="campaign-template">{t("campaigns.template")}</Label>
                  <PermissionGate permission="emails:write">
                    <Button type="button" variant="link" size="sm" className="h-auto gap-1 px-0 text-xs" asChild>
                      <Link to="/emails/templates/new">
                        <FilePlus2 className="h-3.5 w-3.5" />
                        {t("campaigns.createTemplate")}
                      </Link>
                    </Button>
                  </PermissionGate>
                </div>
                {templates.length === 0 ? (
                  <div className="space-y-3 rounded-lg border border-dashed bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground">{t("campaigns.noTemplatesYet")}</p>
                    <PermissionGate permission="emails:write">
                      <Button type="button" size="sm" className="gap-1.5" asChild>
                        <Link to="/emails/templates/new">
                          <FilePlus2 className="h-4 w-4" />
                          {t("campaigns.createTemplate")}
                        </Link>
                      </Button>
                    </PermissionGate>
                  </div>
                ) : (
                  <>
                    <Select
                      value={draft.templateId ? String(draft.templateId) : undefined}
                      onValueChange={handleTemplateChange}
                    >
                      <SelectTrigger id="campaign-template">
                        <SelectValue placeholder={t("campaigns.templatePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={String(template.id)}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("campaigns.templateHint")}</p>
                    {draft.templateId && (
                      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                        <Link to={`/emails/templates/${draft.templateId}/edit`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                          {t("campaigns.editTemplate")}
                        </Link>
                      </Button>
                    )}
                    {templateAttachments.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t("campaigns.templateAttachmentsHint", {
                          files: templateAttachments.map((a) => a.fileName).join(", "),
                        })}
                      </p>
                    )}
                  </>
                )}
              </div>

              {draft.templateId && (
                <div className="space-y-2">
                  <Label>{t("campaigns.defaultSubject")}</Label>
                  <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    {draft.defaultSubject?.trim() || (
                      <span className="text-muted-foreground">{t("campaigns.templateSubjectEmpty")}</span>
                    )}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{t("campaigns.contacts")}</CardTitle>
                  <CardDescription>{t("campaigns.contactsSectionHint")}</CardDescription>
                </div>
                {draft.contacts.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => setDraft({ ...draft, contacts: [] })}
                  >
                    {t("campaigns.clearAllContacts")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {draft.contacts.map((contact) => (
                  <Badge key={contact.email} variant="secondary" className="gap-1 pr-1">
                    <span className="max-w-[240px] truncate text-xs">
                      {contact.name ? `${contact.name} <${contact.email}>` : contact.email}
                    </span>
                    <button
                      type="button"
                      className="rounded-sm p-0.5 hover:bg-muted"
                      onClick={() => removeContact(contact.email)}
                      aria-label={t("emails.recipients.remove")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {draft.contacts.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("campaigns.noContacts")}</p>
                )}
              </div>

              <Separator />

              <SavedContactPickerButton
                selectedEmails={selectedContactEmails}
                onAdd={(contact) => importContacts([contact])}
                onAddMany={importContacts}
                className="h-8 gap-1 px-2 text-xs"
              />

              <Separator />

              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder={t("campaigns.contactEmailPlaceholder")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addContact();
                      }
                    }}
                  />
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder={t("campaigns.contactNamePlaceholder")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addContact();
                      }
                    }}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addContact}>
                  {t("campaigns.addContact")}
                </Button>
                <BulkEmailPasteButton
                  existingEmails={draft.contacts.map((c) => c.email)}
                  onImport={importContacts}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card xl:min-h-[calc(100vh-12rem)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{t("campaigns.templatePreview")}</CardTitle>
            <CardDescription>
              {draft.templateId
                ? t("campaigns.templatePreviewHint")
                : t("campaigns.templatePreviewEmptyHint")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {draft.templateId && draft.defaultHtmlBody?.trim() ? (
              <EmailPreviewFrame
                html={draft.defaultHtmlBody}
                emptyLabel={t("emails.emptyBody")}
                heightClassName="min-h-[560px] h-[min(70vh,720px)]"
              />
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/10 px-6 text-center">
                <p className="max-w-sm text-sm text-muted-foreground">
                  {t("campaigns.templatePreviewEmptyHint")}
                </p>
                <PermissionGate permission="emails:write">
                  <Button type="button" size="sm" className="gap-1.5" asChild>
                    <Link to="/emails/templates/new">
                      <FilePlus2 className="h-4 w-4" />
                      {t("campaigns.createTemplate")}
                    </Link>
                  </Button>
                </PermissionGate>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={sendOpen}
        onOpenChange={(open) => {
          setSendOpen(open);
          if (!open) {
            setScheduleSend(false);
            setScheduledAtLocal("");
            setSenderIdentityId("");
            setSendAttachments([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("campaigns.sendTitle")}</DialogTitle>
            <DialogDescription>
              {t("campaigns.sendBody", {
                name: draft.name || loadedCampaign?.name,
                count: draft.contacts.length,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <SenderIdentitySelect
              id="editor-campaign-sender"
              value={senderIdentityId}
              onChange={setSenderIdentityId}
            />
            <div className="flex items-center gap-2">
              <Switch
                id="editor-schedule-send"
                checked={scheduleSend}
                onCheckedChange={setScheduleSend}
              />
              <Label htmlFor="editor-schedule-send" className="font-normal">
                {t("emails.sendLater")}
              </Label>
            </div>
            {scheduleSend && (
              <div className="space-y-2">
                <Label htmlFor="editor-scheduled-at">{t("emails.scheduledAt")}</Label>
                <Input
                  id="editor-scheduled-at"
                  type="datetime-local"
                  value={scheduledAtLocal}
                  min={minScheduleDatetimeLocal()}
                  onChange={(e) => setScheduledAtLocal(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("emails.scheduleTimezoneHint", {
                    timezone: getLocalTimezoneLabel(),
                  })}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("emails.attachments")}</Label>
              {templateAttachments.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("campaigns.templateAttachmentsHint", {
                    files: templateAttachments.map((a) => a.fileName).join(", "),
                  })}
                </p>
              )}
              <EmailAttachmentPicker
                items={sendAttachments}
                onChange={setSendAttachments}
                max={Math.max(0, MAX_ATTACHMENTS - templateAttachments.length)}
                disabled={templateAttachments.length >= MAX_ATTACHMENTS}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSendOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("campaigns.sendConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmailPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        subject={draft.defaultSubject}
        html={draft.defaultHtmlBody ?? ""}
        to={draft.contacts.map((c) => c.email).join(", ") || undefined}
        attachments={
          [...templateAttachments.map((a) => a.fileName), ...sendAttachments.map((a) => a.fileName)].join(", ") ||
          undefined
        }
      />
    </>
  );
}
