import { adminApi } from "./client";

export interface EmailDeliverySettings {
  host: string;
  port: number;
  username: string;
  password?: string;
}

export interface SendTestEmailRequest {
  email: string;
}

export const emailDeliveryApi = {
  getSettings: async (): Promise<EmailDeliverySettings> => {
    const response = await adminApi.get<EmailDeliverySettings>("/settings/mail-config");
    return response.data;
  },

  createSettings: async (settings: EmailDeliverySettings): Promise<EmailDeliverySettings> => {
    const response = await adminApi.post<EmailDeliverySettings>("/settings/mail-config", settings);
    return response.data;
  },

  updateSettings: async (settings: EmailDeliverySettings): Promise<EmailDeliverySettings> => {
    const response = await adminApi.put<EmailDeliverySettings>("/settings/mail-config", settings);
    return response.data;
  },

  sendTestEmail: async (request: SendTestEmailRequest): Promise<void> => {
    await adminApi.post("/settings/mail-config/test-email", request);
  },
};
