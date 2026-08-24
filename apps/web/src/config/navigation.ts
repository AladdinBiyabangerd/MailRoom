import {
  BarChart3,
  Contact,
  FileText,
  Mail,
  MailCheck,
  Megaphone,
  Send,
  Server,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  end?: boolean;
  permission?: Permission;
}

export interface NavSection {
  titleKey: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    titleKey: "nav.sectionCompose",
    items: [
      { to: "/emails/compose", labelKey: "nav.emails", icon: Mail, permission: "emails:read" },
      { to: "/emails/campaigns", labelKey: "nav.campaigns", icon: Megaphone, permission: "emails:read" },
    ],
  },
  {
    titleKey: "nav.sectionLibrary",
    items: [
      { to: "/emails/templates", labelKey: "nav.emailTemplates", icon: FileText, permission: "emails:read" },
      { to: "/emails/contacts", labelKey: "nav.emailContacts", icon: Contact, permission: "emails:read" },
    ],
  },
  {
    titleKey: "nav.sectionReports",
    items: [
      { to: "/emails/history", labelKey: "nav.emailsHistory", icon: MailCheck, permission: "emails:read" },
      { to: "/emails/analytics", labelKey: "nav.emailAnalytics", icon: BarChart3, permission: "emails:read" },
      { to: "/emails/suppressions", labelKey: "nav.emailSuppressions", icon: UserX, permission: "emails:read" },
    ],
  },
  {
    titleKey: "nav.sectionSettings",
    items: [
      {
        to: "/email-delivery",
        labelKey: "nav.emailDelivery",
        icon: Server,
        permission: "mail-config:read",
      },
      {
        to: "/email-delivery/senders",
        labelKey: "nav.emailSenders",
        icon: Send,
        permission: "mail-config:read",
      },
    ],
  },
];
