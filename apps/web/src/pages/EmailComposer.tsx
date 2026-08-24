import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CalendarClock, Eye, History, Loader2, Send, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { RichTextEditor } from "@/components/email/RichTextEditor";
import { EmailPreviewDialog } from "@/components/email/EmailPreview";
import { EmailAttachmentPicker } from "@/components/email/EmailAttachmentPicker";
import { SenderIdentitySelect } from "@/components/email/SenderIdentitySelect";
import {
  EmailRecipients,
  type RecipientChip,
} from "@/components/email/EmailRecipients";
import { fetchCampaignRequest, fetchCampaignsRequest, resolveCampaignContent, type EmailCampaign } from "@/api/campaigns";
import {
  deleteCurrentEmailDraftRequest,
  draftToComposeState,
  fetchCurrentEmailDraftRequest,
  saveCurrentEmailDraftRequest,
} from "@/api/email-drafts";
import { sendEmailRequest, type EmailAttachmentPayload } from "@/api/emails";
import { getApiErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryKeys } from "@/lib/query-keys";
import {
  formatDateTimeLocal,
  getLocalTimezoneLabel,
  localDatetimeToIso,
  minScheduleDatetimeLocal,
} from "@/lib/schedule";
import { htmlHasVisibleContent } from "@/lib/html-source";
import type { EmailAttachmentItem } from "@/lib/attachments";
import {
  buildRecipientNames,
  resolveGreetingName,
  withPersonalizedGreeting,
} from "@/lib/emailGreeting";

const CAMPAIGN_LIST_PARAMS = { page: 1, limit: 100 };
const DRAFT_SAVE_DELAY_MS = 800;

type SendMode = "now" | "schedule";

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent?.trim() ?? "";
}

function isBodyEmpty(html: string): boolean {
  return !htmlHasVisibleContent(html);
}

export default function EmailComposer() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const appliedUrlCampaignId = useRef<number | null>(null);
  const draftReadyRef = useRef(false);
  const skipDraftSaveRef = useRef(false);

  const [to, setTo] = useState<RecipientChip[]>([]);
  const [cc, setCc] = useState<RecipientChip[]>([]);
  const [bcc, setBcc] = useState<RecipientChip[]>([]);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [attachments, setAttachments] = useState<EmailAttachmentItem[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("none");
  const [includeUnsubscribe, setIncludeUnsubscribe] = useState(false);
  const [greetWithName, setGreetWithName] = useState(true);
  const [senderIdentityId, setSenderIdentityId] = useState("");
  const [sendMode, setSendMode] = useState<SendMode>("now");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const { data: campaignsPage, isLoading: loadingCampaigns } = useQuery({
    queryKey: queryKeys.campaigns.list(CAMPAIGN_LIST_PARAMS),
    queryFn: () => fetchCampaignsRequest(CAMPAIGN_LIST_PARAMS),
  });
  const campaigns = campaignsPage?.items ?? [];

  const campaignIdParam = searchParams.get("campaignId");
  const campaignIdFromUrl =
    campaignIdParam && Number.isFinite(Number(campaignIdParam))
      ? Number(campaignIdParam)
      : null;

  const buildDraftPayload = useCallback(
    () => ({
      subject: subject.trim() || undefined,
      bodyHtml: bodyHtml.trim() || undefined,
      campaignId: selectedCampaignId !== "none" ? Number(selectedCampaignId) : null,
      showCc,
      showBcc,
      to: to.map((r) => ({ email: r.email, name: r.label })),
      cc: cc.map((r) => ({ email: r.email, name: r.label })),
      bcc: bcc.map((r) => ({ email: r.email, name: r.label })),
    }),
    [bcc, bodyHtml, cc, selectedCampaignId, showBcc, showCc, subject, to],
  );

  const hasDraftContent =
    to.length > 0 ||
    cc.length > 0 ||
    bcc.length > 0 ||
    subject.trim().length > 0 ||
    !isBodyEmpty(bodyHtml);

  useEffect(() => {
    if (campaignIdFromUrl) {
      setDraftLoaded(true);
      draftReadyRef.current = true;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const draft = await fetchCurrentEmailDraftRequest();
        if (cancelled || !draft) {
          if (!cancelled) {
            setDraftLoaded(true);
            draftReadyRef.current = true;
          }
          return;
        }
        skipDraftSaveRef.current = true;
        const state = draftToComposeState(draft);
        setTo(state.to);
        setCc(state.cc);
        setBcc(state.bcc);
        setSubject(state.subject);
        setBodyHtml(state.bodyHtml);
        setShowCc(state.showCc);
        setShowBcc(state.showBcc);
        setSelectedCampaignId(state.selectedCampaignId);
        if (draft.updatedAt) {
          setDraftSavedAt(new Date(draft.updatedAt));
        }
        toast.info(t("emails.draftRestored"));
      } catch {
        // ignore missing draft
      } finally {
        if (!cancelled) {
          skipDraftSaveRef.current = false;
          setDraftLoaded(true);
          draftReadyRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [campaignIdFromUrl, t]);

  useEffect(() => {
    if (!draftReadyRef.current || skipDraftSaveRef.current || !draftLoaded) return;
    if (!hasDraftContent) return;

    const timer = window.setTimeout(async () => {
      setDraftSaving(true);
      try {
        const saved = await saveCurrentEmailDraftRequest(buildDraftPayload());
        setDraftSavedAt(saved?.updatedAt ? new Date(saved.updatedAt) : new Date());
        await queryClient.invalidateQueries({ queryKey: queryKeys.emailDrafts.current });
      } catch {
        // silent autosave failure
      } finally {
        setDraftSaving(false);
      }
    }, DRAFT_SAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    bcc,
    bodyHtml,
    buildDraftPayload,
    cc,
    draftLoaded,
    hasDraftContent,
    queryClient,
    selectedCampaignId,
    showBcc,
    showCc,
    subject,
    to,
  ]);

  const { data: campaignFromUrl } = useQuery({
    queryKey: queryKeys.campaigns.detail(campaignIdFromUrl ?? 0),
    queryFn: () => fetchCampaignRequest(campaignIdFromUrl!),
    enabled: campaignIdFromUrl != null && campaignIdFromUrl > 0,
  });

  const applyCampaign = async (campaign: EmailCampaign) => {
    const { subject, bodyHtml } = await resolveCampaignContent(campaign);
    if (subject) {
      setSubject(subject);
    }
    if (bodyHtml) {
      setBodyHtml(bodyHtml);
    }
    if (campaign.contacts?.length) {
      setTo(
        campaign.contacts.map((contact) => ({
          email: contact.email,
          label: contact.name,
        })),
      );
    }
  };

  useEffect(() => {
    if (!campaignIdFromUrl || !campaignFromUrl) return;
    if (appliedUrlCampaignId.current === campaignIdFromUrl) return;
    appliedUrlCampaignId.current = campaignIdFromUrl;
    setSelectedCampaignId(String(campaignIdFromUrl));
    setIncludeUnsubscribe(true);
    void applyCampaign(campaignFromUrl);
  }, [campaignFromUrl, campaignIdFromUrl]);

  const handleCampaignChange = async (value: string) => {
    setSelectedCampaignId(value);
    if (value === "none") {
      setIncludeUnsubscribe(false);
      return;
    }

    setIncludeUnsubscribe(true);

    const campaignId = Number(value);
    if (!Number.isFinite(campaignId)) return;

    try {
      const campaign = await fetchCampaignRequest(campaignId);
      await applyCampaign(campaign);
      toast.success(t("emails.campaignLoaded", { name: campaign.name }));
    } catch {
      toast.error(t("campaigns.loadError"));
    }
  };

  const sendMutation = useMutation({
    mutationFn: sendEmailRequest,
    onSuccess: (data) => {
      if (data.status === "scheduled") {
        toast.success(
          t("emails.scheduleSuccess", {
            count: data.recipientCount,
            time: formatDateTimeLocal(data.scheduledAt ?? data.sentAt),
          }),
        );
      } else {
        toast.success(t("emails.sendSuccess", { count: data.recipientCount }));
      }
      if (data.suppressedCount && data.suppressedCount > 0) {
        toast.info(t("emails.suppressedSkipped", { count: data.suppressedCount }));
      }
      setTo([]);
      setCc([]);
      setBcc([]);
      setSubject("");
      setBodyHtml("");
      setShowCc(false);
      setShowBcc(false);
      setAttachments([]);
      setSelectedCampaignId("none");
      setIncludeUnsubscribe(false);
      setSendMode("now");
      setScheduledAtLocal("");
      setDraftSavedAt(null);
      void deleteCurrentEmailDraftRequest();
      void queryClient.invalidateQueries({ queryKey: queryKeys.emailDrafts.current });
      void queryClient.invalidateQueries({ queryKey: queryKeys.emailHistory.all });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t("emails.sendError"))),
  });

  const handleSend = () => {
    if (to.length === 0) {
      toast.error(t("emails.validation.noRecipients"));
      return;
    }
    if (!subject.trim()) {
      toast.error(t("emails.validation.noSubject"));
      return;
    }
    if (isBodyEmpty(bodyHtml)) {
      toast.error(t("emails.validation.noBody"));
      return;
    }

    let scheduledAt: string | undefined;
    if (sendMode === "schedule") {
      scheduledAt = localDatetimeToIso(scheduledAtLocal);
      if (!scheduledAt) {
        toast.error(t("emails.validation.noScheduleTime"));
        return;
      }
      if (new Date(scheduledAt).getTime() <= Date.now()) {
        toast.error(t("emails.validation.scheduleInPast"));
        return;
      }
    }

    const attachmentPayload: EmailAttachmentPayload[] = attachments
      .filter((a) => a.contentBase64)
      .map((a) => ({
        fileName: a.fileName,
        contentType: a.contentType,
        contentBase64: a.contentBase64!,
      }));

    sendMutation.mutate({
      to: to.map((r) => r.email),
      cc: cc.length ? cc.map((r) => r.email) : undefined,
      bcc: bcc.length ? bcc.map((r) => r.email) : undefined,
      subject: subject.trim(),
      bodyHtml,
      bodyText: stripHtml(bodyHtml),
      campaignId:
        selectedCampaignId !== "none" ? Number(selectedCampaignId) : undefined,
      includeUnsubscribe,
      greetWithName,
      recipientNames: buildRecipientNames([...to, ...cc, ...bcc]),
      senderIdentityId: senderIdentityId ? Number(senderIdentityId) : undefined,
      scheduledAt,
      attachments: attachmentPayload.length ? attachmentPayload : undefined,
    });
  };

  const handleClear = async () => {
    setTo([]);
    setCc([]);
    setBcc([]);
    setSubject("");
    setBodyHtml("");
    setShowCc(false);
    setShowBcc(false);
    setAttachments([]);
    setSelectedCampaignId("none");
    setIncludeUnsubscribe(false);
    setGreetWithName(true);
    setSenderIdentityId("");
    setSendMode("now");
    setScheduledAtLocal("");
    setDraftSavedAt(null);
    try {
      await deleteCurrentEmailDraftRequest();
      await queryClient.invalidateQueries({ queryKey: queryKeys.emailDrafts.current });
    } catch {
      // ignore
    }
  };

  const formatRecipientList = (recipients: RecipientChip[]) =>
    recipients
      .map((r) => (r.label ? `${r.label} <${r.email}>` : r.email))
      .join(", ");

  const previewHtml = (() => {
    if (!greetWithName || isBodyEmpty(bodyHtml)) return bodyHtml;
    const sample = to[0]
      ? resolveGreetingName(to[0].label, to[0].email)
      : null;
    return withPersonalizedGreeting(bodyHtml, sample);
  })();

  return (
    <>
      <PageHeader
        title={t("emails.title")}
        subtitle={t("emails.subtitle")}
        actions={
          <>
            {(draftSaving || draftSavedAt) && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {draftSaving ? t("emails.draftSaving") : t("emails.draftSaved")}
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              asChild
            >
              <Link to="/emails/campaigns">
                {t("nav.campaigns")}
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              asChild
            >
              <Link to="/emails/history">
                <History className="h-4 w-4" />
                {t("emailHistory.title")}
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setPreviewOpen(true)}
              disabled={isBodyEmpty(bodyHtml) && !subject}
            >
              <Eye className="h-4 w-4" />
              {t("emails.preview")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleClear}
            >
              <Trash2 className="h-4 w-4" />
              {t("emails.clear")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={handleSend}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : sendMode === "schedule" ? (
                <CalendarClock className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sendMode === "schedule" ? t("emails.schedule") : t("emails.send")}
            </Button>
          </>
        }
      />

      <Card className="mt-6 shadow-card">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="space-y-2">
            <Label>{t("emails.loadCampaign")}</Label>
            <Select
              value={selectedCampaignId}
              onValueChange={handleCampaignChange}
              disabled={loadingCampaigns}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("emails.selectCampaign")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("emails.noCampaign")}</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={String(campaign.id)}>
                    {campaign.name} ({campaign.contactCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <EmailRecipients
            id="email-to"
            label={t("emails.to")}
            value={to}
            onChange={setTo}
            showSavedContacts
          />

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch id="show-cc" checked={showCc} onCheckedChange={setShowCc} />
                <Label htmlFor="show-cc" className="text-sm font-normal">
                  {t("emails.showCc")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="show-bcc" checked={showBcc} onCheckedChange={setShowBcc} />
                <Label htmlFor="show-bcc" className="text-sm font-normal">
                  {t("emails.showBcc")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="greet-with-name"
                  checked={greetWithName}
                  onCheckedChange={setGreetWithName}
                />
                <Label htmlFor="greet-with-name" className="text-sm font-normal">
                  {t("emails.greetWithName")}
                </Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("emails.greetWithNameHint")}</p>
          </div>

          {showCc && (
            <EmailRecipients
              id="email-cc"
              label={t("emails.cc")}
              value={cc}
              onChange={setCc}
            />
          )}

          {showBcc && (
            <EmailRecipients
              id="email-bcc"
              label={t("emails.bcc")}
              value={bcc}
              onChange={setBcc}
            />
          )}

          <SenderIdentitySelect
            value={senderIdentityId}
            onChange={setSenderIdentityId}
          />

          <div className="space-y-2">
            <Label htmlFor="email-subject">{t("emails.subject")}</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("emails.subjectPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>{t("emails.body")}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setPreviewOpen(true)}
                disabled={isBodyEmpty(bodyHtml) && !subject}
              >
                <Eye className="h-4 w-4" />
                {t("emails.preview")}
              </Button>
            </div>
            <RichTextEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder={t("emails.editor.placeholder")}
              minHeight={480}
            />
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <Switch
                id="include-unsubscribe"
                checked={includeUnsubscribe}
                onCheckedChange={setIncludeUnsubscribe}
              />
              <Label htmlFor="include-unsubscribe" className="font-normal">
                {t("emails.includeUnsubscribe")}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">{t("emails.includeUnsubscribeHint")}</p>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <Label>{t("emails.sendMode")}</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={sendMode === "now" ? "default" : "outline"}
                onClick={() => setSendMode("now")}
              >
                {t("emails.sendNow")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={sendMode === "schedule" ? "default" : "outline"}
                onClick={() => setSendMode("schedule")}
              >
                <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                {t("emails.sendLater")}
              </Button>
            </div>
            {sendMode === "schedule" && (
              <div className="space-y-2">
                <Label htmlFor="scheduled-at">{t("emails.scheduledAt")}</Label>
                <Input
                  id="scheduled-at"
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
          </div>

          <div className="space-y-2">
            <Label>{t("emails.attachments")}</Label>
            <EmailAttachmentPicker items={attachments} onChange={setAttachments} />
          </div>
        </CardContent>
      </Card>

      <EmailPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        subject={subject}
        html={previewHtml}
        to={formatRecipientList(to) || undefined}
        cc={showCc && cc.length ? formatRecipientList(cc) : undefined}
        bcc={showBcc && bcc.length ? formatRecipientList(bcc) : undefined}
        attachments={attachments.length ? attachments.map((a) => a.fileName).join(", ") : undefined}
      />
    </>
  );
}
