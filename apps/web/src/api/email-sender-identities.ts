import { adminApi, isDemoMode } from "./client";

export interface EmailSenderIdentity {
  id: string;
  email: string;
  displayName: string;
  defaultSender: boolean;
  active: boolean;
  label: string;
}

export interface UpsertEmailSenderIdentityRequest {
  email: string;
  displayName: string;
  defaultSender?: boolean;
  active?: boolean;
}

const demoSenders: EmailSenderIdentity[] = [
  {
    id: "1",
    email: "info@ingress.az",
    displayName: "Aladdin Hotels",
    defaultSender: true,
    active: true,
    label: "Aladdin Hotels <info@ingress.az>",
  },
  {
    id: "2",
    email: "reservations@ingress.az",
    displayName: "Reservations",
    defaultSender: false,
    active: true,
    label: "Reservations <reservations@ingress.az>",
  },
];

export async function fetchEmailSenderIdentitiesRequest(): Promise<EmailSenderIdentity[]> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 200));
    return demoSenders.filter((s) => s.active);
  }
  const { data } = await adminApi.get<EmailSenderIdentity[]>("/email-sender-identities");
  return data;
}

export async function fetchAllEmailSenderIdentitiesRequest(): Promise<EmailSenderIdentity[]> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 200));
    return demoSenders;
  }
  const { data } = await adminApi.get<EmailSenderIdentity[]>("/email-sender-identities/all");
  return data;
}

export async function createEmailSenderIdentityRequest(
  payload: UpsertEmailSenderIdentityRequest,
): Promise<EmailSenderIdentity> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 300));
    return {
      id: String(Date.now()),
      email: payload.email,
      displayName: payload.displayName,
      defaultSender: payload.defaultSender ?? false,
      active: payload.active ?? true,
      label: `${payload.displayName} <${payload.email}>`,
    };
  }
  const { data } = await adminApi.post<EmailSenderIdentity>("/email-sender-identities", payload);
  return data;
}

export async function updateEmailSenderIdentityRequest(
  id: string,
  payload: UpsertEmailSenderIdentityRequest,
): Promise<EmailSenderIdentity> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 300));
    return {
      id,
      email: payload.email,
      displayName: payload.displayName,
      defaultSender: payload.defaultSender ?? false,
      active: payload.active ?? true,
      label: `${payload.displayName} <${payload.email}>`,
    };
  }
  const { data } = await adminApi.put<EmailSenderIdentity>(`/email-sender-identities/${id}`, payload);
  return data;
}

export async function deleteEmailSenderIdentityRequest(id: string): Promise<void> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 300));
    return;
  }
  await adminApi.delete(`/email-sender-identities/${id}`);
}

export function pickDefaultSenderId(senders: EmailSenderIdentity[]): string | undefined {
  const defaultSender = senders.find((s) => s.defaultSender);
  return defaultSender?.id ?? senders[0]?.id;
}
