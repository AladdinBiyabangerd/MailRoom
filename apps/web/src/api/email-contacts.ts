import { adminApi, isDemoMode } from "./client";

export interface EmailAddressBookContact {
  id: number;
  email: string;
  name?: string;
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
}

const demoContacts: EmailAddressBookContact[] = [
  { id: 1, email: "info@caspian.az", name: "Caspian Resort" },
  { id: 2, email: "contact@oldcity.az", name: "Old City Boutique" },
  { id: 3, email: "sales@heritage.az", name: "Heritage Stays" },
  { id: 4, email: "manager@sheki.az", name: "Sheki Silk Inn" },
  { id: 5, email: "front@gabala.az", name: "Gabala Mountain Lodge" },
];

export async function fetchEmailContactsRequest(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<EmailAddressBookContactPage> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 200));
    const search = params?.search?.trim().toLowerCase();
    const filtered = search
      ? demoContacts.filter(
          (c) =>
            c.email.toLowerCase().includes(search) ||
            (c.name ?? "").toLowerCase().includes(search),
        )
      : demoContacts;
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
    return { id: Date.now(), ...payload };
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
    return { id, ...payload };
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
