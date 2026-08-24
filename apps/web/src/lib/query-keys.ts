export const queryKeys = {
  systemUsers: {
    all: ["system-users"] as const,
    list: (params: Record<string, unknown>) =>
      ["system-users", "list", params] as const,
  },
  campaigns: {
    all: ["campaigns"] as const,
    list: (params: Record<string, unknown>) =>
      ["campaigns", "list", params] as const,
    detail: (id: number) => ["campaigns", "detail", id] as const,
  },
  emailContacts: {
    all: ["email-contacts"] as const,
    list: (params: Record<string, unknown>) =>
      ["email-contacts", "list", params] as const,
  },
  emailHistory: {
    all: ["email-history"] as const,
  },
  emailTemplates: {
    all: ["email-templates"] as const,
    list: (params: Record<string, unknown>) =>
      ["email-templates", "list", params] as const,
    detail: (id: number) => ["email-templates", "detail", id] as const,
  },
  emailDrafts: {
    current: ["email-drafts", "current"] as const,
  },
  emailAnalytics: {
    all: ["email-analytics"] as const,
    summary: (params: Record<string, unknown>) => ["email-analytics", params] as const,
  },
  emailSuppressions: {
    all: ["email-suppressions"] as const,
    list: (params: Record<string, unknown>) => ["email-suppressions", "list", params] as const,
  },
  emailSenderIdentities: {
    all: ["email-sender-identities"] as const,
    list: () => ["email-sender-identities", "list"] as const,
  },
};
