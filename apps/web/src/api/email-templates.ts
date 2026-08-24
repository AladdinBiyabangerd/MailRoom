import { adminApi, isDemoMode } from "./client";

export interface EmailTemplate {
  id: number;
  name: string;
  description?: string;
  subject?: string;
  htmlBody?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailTemplatePage {
  items: EmailTemplate[];
  total: number;
  page: number;
  limit: number;
}

export interface UpsertEmailTemplatePayload {
  name: string;
  description?: string;
  subject?: string;
  htmlBody?: string;
}

const demoTemplates: EmailTemplate[] = [
  {
    id: 1,
    name: "Product demo invitation",
    description: "Standard outreach for hotel demos",
    subject: "StayBoard PMS — Demo invitation",
    htmlBody:
      "<p>Hello,</p><p>We would like to invite you to try <strong>StayBoard PMS</strong>.</p>",
  },
  {
    id: 2,
    name: "Trial follow-up",
    description: "Check-in with hotels on trial",
    subject: "How is your StayBoard trial going?",
    htmlBody: "<p>Hi,</p><p>We hope your trial is going well. Let us know if you need help.</p>",
  },
];

export async function fetchEmailTemplatesRequest(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<EmailTemplatePage> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 250));
    const search = params?.search?.trim().toLowerCase();
    const filtered = search
      ? demoTemplates.filter(
          (template) =>
            template.name.toLowerCase().includes(search) ||
            (template.description ?? "").toLowerCase().includes(search),
        )
      : demoTemplates;
    return {
      items: filtered,
      total: filtered.length,
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
    };
  }

  const { data } = await adminApi.get<EmailTemplatePage>("/email-templates", { params });
  return data;
}

export async function fetchEmailTemplateRequest(id: number): Promise<EmailTemplate> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 200));
    const template = demoTemplates.find((item) => item.id === id);
    if (!template) throw new Error("Template not found");
    return template;
  }

  const { data } = await adminApi.get<EmailTemplate>(`/email-templates/${id}`);
  return data;
}

export async function createEmailTemplateRequest(
  payload: UpsertEmailTemplatePayload,
): Promise<EmailTemplate> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 350));
    return { id: Date.now(), ...payload };
  }

  const { data } = await adminApi.post<EmailTemplate>("/email-templates", payload);
  return data;
}

export async function updateEmailTemplateRequest(
  id: number,
  payload: UpsertEmailTemplatePayload,
): Promise<EmailTemplate> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 350));
    return { id, ...payload };
  }

  const { data } = await adminApi.put<EmailTemplate>(`/email-templates/${id}`, payload);
  return data;
}

export async function deleteEmailTemplateRequest(id: number): Promise<void> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 250));
    return;
  }

  await adminApi.delete(`/email-templates/${id}`);
}

export function templateToDraft(template: EmailTemplate): UpsertEmailTemplatePayload {
  return {
    name: template.name,
    description: template.description ?? "",
    subject: template.subject ?? "",
    htmlBody: template.htmlBody ?? "",
  };
}

export const emptyTemplateDraft = (): UpsertEmailTemplatePayload => ({
  name: "",
  description: "",
  subject: "",
  htmlBody: "",
});
