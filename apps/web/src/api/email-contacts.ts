import { adminApi, isDemoMode } from "./client";

export interface EmailContactLabel {
  id: number;
  name: string;
}

export interface EmailAddressBookContact {
  id: number;
  email: string;
  name?: string;
  labels?: EmailContactLabel[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailAddressBookContactPage {
  items: EmailAddressBookContact[];
  total: number;
  page: number;
  limit: number;
}

export interface UpsertEmailAddressBookContactPayload {
  email: string;
  name?: string;
  labels?: string[];
}

export interface EmailLabel {
  id: number;
  name: string;
  contactCount: number;
  createdAt?: string;
  updatedAt?: string;
}

const demoContacts: EmailAddressBookContact[] = [
  {
    id: 1,
    email: "info@caspian.az",
    name: "Caspian Resort",
    labels: [{ id: 1, name: "Hotels" }],
  },
  {
    id: 2,
    email: "contact@oldcity.az",
    name: "Old City Boutique",
    labels: [
      { id: 1, name: "Hotels" },
      { id: 2, name: "Baku" },
    ],
  },
  { id: 3, email: "sales@heritage.az", name: "Heritage Stays", labels: [] },
  { id: 4, email: "manager@sheki.az", name: "Sheki Silk Inn", labels: [{ id: 2, name: "Baku" }] },
  { id: 5, email: "front@gabala.az", name: "Gabala Mountain Lodge", labels: [] },
];

let demoLabels: EmailLabel[] = [
  { id: 1, name: "Hotels", contactCount: 2 },
  { id: 2, name: "Baku", contactCount: 2 },
];

export async function fetchEmailLabelsRequest(params?: {
  search?: string;
}): Promise<EmailLabel[]> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 150));
    const search = params?.search?.trim().toLowerCase();
    return search
      ? demoLabels.filter((l) => l.name.toLowerCase().includes(search))
      : [...demoLabels];
  }
  const { data } = await adminApi.get<EmailLabel[]>("/email-labels", { params });
  return data;
}

export async function createEmailLabelRequest(payload: { name: string }): Promise<EmailLabel> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 200));
    const label = { id: Date.now(), name: payload.name.trim(), contactCount: 0 };
    demoLabels = [...demoLabels, label].sort((a, b) => a.name.localeCompare(b.name));
    return label;
  }
  const { data } = await adminApi.post<EmailLabel>("/email-labels", payload);
  return data;
}

export async function updateEmailLabelRequest(
  id: number,
  payload: { name: string },
): Promise<EmailLabel> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 200));
    demoLabels = demoLabels.map((l) =>
      l.id === id ? { ...l, name: payload.name.trim() } : l,
    );
    return demoLabels.find((l) => l.id === id)!;
  }
  const { data } = await adminApi.put<EmailLabel>(`/email-labels/${id}`, payload);
  return data;
}

export async function deleteEmailLabelRequest(id: number): Promise<void> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 200));
    demoLabels = demoLabels.filter((l) => l.id !== id);
    return;
  }
  await adminApi.delete(`/email-labels/${id}`);
}

export async function fetchEmailContactsRequest(params?: {
  search?: string;
  label?: string;
  page?: number;
  limit?: number;
}): Promise<EmailAddressBookContactPage> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 200));
    const search = params?.search?.trim().toLowerCase();
    const label = params?.label?.trim().toLowerCase();
    const filtered = demoContacts.filter((c) => {
      if (label && !(c.labels ?? []).some((l) => l.name.toLowerCase() === label)) return false;
      if (!search) return true;
      return (
        c.email.toLowerCase().includes(search) ||
        (c.name ?? "").toLowerCase().includes(search) ||
        (c.labels ?? []).some((l) => l.name.toLowerCase().includes(search))
      );
    });
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);
    return { items, total: filtered.length, page, limit };
  }

  const { data } = await adminApi.get<EmailAddressBookContactPage>("/email-contacts", { params });
  return data;
}

export async function createEmailContactRequest(
  payload: UpsertEmailAddressBookContactPayload,
): Promise<EmailAddressBookContact> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 300));
    return {
      id: Date.now(),
      email: payload.email,
      name: payload.name,
      labels: (payload.labels ?? []).map((name, i) => ({ id: i + 1, name })),
    };
  }

  const { data } = await adminApi.post<EmailAddressBookContact>("/email-contacts", payload);
  return data;
}

export async function updateEmailContactRequest(
  id: number,
  payload: UpsertEmailAddressBookContactPayload,
): Promise<EmailAddressBookContact> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 300));
    return {
      id,
      email: payload.email,
      name: payload.name,
      labels: (payload.labels ?? []).map((name, i) => ({ id: i + 1, name })),
    };
  }

  const { data } = await adminApi.put<EmailAddressBookContact>(`/email-contacts/${id}`, payload);
  return data;
}

export async function deleteEmailContactRequest(id: number): Promise<void> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 300));
    return;
  }

  await adminApi.delete(`/email-contacts/${id}`);
}

export function emailContactDisplayName(contact: EmailAddressBookContact): string {
  return contact.name?.trim() || contact.email;
}

export function parseLabelInput(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
