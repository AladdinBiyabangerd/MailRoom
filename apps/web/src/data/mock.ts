import type { SentEmailRecord } from "@/api/emails";
/* ------------------------------------------------------------------ */
export const sentEmails: SentEmailRecord[] = [
  {
    id: "em-1001",
    subject: "Q3 Platform Update — New RMS Features",
    bodyHtml:
      "<p>Dear team,</p><p>We are excited to announce <strong>new RMS analytics dashboards</strong> rolling out this quarter.</p><ul><li>Revenue forecasting</li><li>Channel mix breakdown</li><li>Competitor rate tracking</li></ul><p>Best regards,<br/>StayBoard Team</p>",
    sentBy: "admin@stayboard.app",
    sentByName: "Aytac Admin",
    sentAt: "2026-06-15 14:32",
    status: "delivered",
    to: [
      { email: "nigar@stayboard.app", name: "Nigar Mövsümova", status: "opened", deliveredAt: "2026-06-15 14:32", openedAt: "2026-06-15 14:45" },
      { email: "rauf@caspian.az", name: "Rauf Aliyev", status: "delivered", deliveredAt: "2026-06-15 14:33" },
      { email: "leyla@kavkaz.ge", name: "Leyla Huseynova", status: "opened", deliveredAt: "2026-06-15 14:32", openedAt: "2026-06-15 15:10" },
    ],
    cc: [
      { email: "support@stayboard.app", name: "Tariel S.", status: "delivered", deliveredAt: "2026-06-15 14:32" },
    ],
  },
  {
    id: "em-1002",
    subject: "Scheduled Maintenance — June 18",
    bodyHtml:
      "<p>Hello,</p><p>Please be advised that <em>scheduled maintenance</em> will occur on <strong>June 18, 02:00–04:00 UTC</strong>.</p><p>Services may be briefly unavailable during this window.</p>",
    sentBy: "nigar@stayboard.app",
    sentByName: "Nigar Mövsümova",
    sentAt: "2026-06-14 09:15",
    status: "opened",
    to: [
      { email: "rauf@caspian.az", name: "Rauf Aliyev", status: "opened", deliveredAt: "2026-06-14 09:16", openedAt: "2026-06-14 10:02" },
      { email: "leyla@kavkaz.ge", name: "Leyla Huseynova", status: "opened", deliveredAt: "2026-06-14 09:16", openedAt: "2026-06-14 11:30" },
      { email: "kamran@heritage.az", name: "Kamran V.", status: "bounced", errorMessage: "Mailbox not found" },
    ],
  },
  {
    id: "em-1003",
    subject: "Welcome to StayBoard — Getting Started Guide",
    bodyHtml:
      "<h2>Welcome aboard!</h2><p>Your hotel onboarding is complete. Here is your <a href='#'>getting started guide</a>.</p><p>Need help? Reply to this email or contact support.</p>",
    sentBy: "support@stayboard.app",
    sentByName: "Tariel S.",
    sentAt: "2026-06-13 16:48",
    status: "delivered",
    to: [
      { email: "manager@newhotel.az", name: "Elvin R.", status: "delivered", deliveredAt: "2026-06-13 16:49" },
    ],
  },
  {
    id: "em-1004",
    subject: "Invoice #INV-2026-0612 — Payment Reminder",
    bodyHtml:
      "<p>This is a friendly reminder that invoice <strong>#INV-2026-0612</strong> is due on June 20.</p><p>Amount due: <strong>$2,450.00</strong></p>",
    sentBy: "admin@stayboard.app",
    sentByName: "Aytac Admin",
    sentAt: "2026-06-12 11:00",
    status: "failed",
    to: [
      { email: "billing@azure-resorts.com", name: "Azure Resorts Billing", status: "failed", errorMessage: "SMTP connection timeout" },
    ],
  },
  {
    id: "em-1005",
    subject: "Security Alert — New Login from Unknown Device",
    bodyHtml:
      "<p>A new login to your admin account was detected.</p><table><tr><th>Time</th><th>IP</th><th>Location</th></tr><tr><td>Jun 11, 08:22</td><td>85.132.10.4</td><td>Baku, AZ</td></tr></table><p>If this wasn't you, reset your password immediately.</p>",
    sentBy: "system@stayboard.app",
    sentByName: "System",
    sentAt: "2026-06-11 08:23",
    status: "delivered",
    to: [
      { email: "rauf@caspian.az", name: "Rauf Aliyev", status: "opened", deliveredAt: "2026-06-11 08:23", openedAt: "2026-06-11 08:25" },
    ],
  },
  {
    id: "em-1006",
    subject: "Enterprise Plan Renewal Confirmation",
    bodyHtml:
      "<p>Your <strong>Enterprise plan</strong> has been renewed for another year.</p><p>Thank you for continuing with StayBoard.</p>",
    sentBy: "nigar@stayboard.app",
    sentByName: "Nigar Mövsümova",
    sentAt: "2026-06-10 15:30",
    status: "sent",
    to: [
      { email: "rauf@caspian.az", name: "Rauf Aliyev", status: "sent" },
    ],
    cc: [
      { email: "finance@caspian.az", name: "Caspian Finance", status: "sent" },
    ],
  },
  {
    id: "em-1007",
    subject: "Weekly Platform Digest — June 9",
    bodyHtml:
      "<h3>This week on StayBoard</h3><ul><li>12 new hotel sign-ups</li><li>98.7% uptime across all services</li><li>3 integration updates</li></ul>",
    sentBy: "admin@stayboard.app",
    sentByName: "Aytac Admin",
    sentAt: "2026-06-09 07:00",
    status: "delivered",
    to: [
      { email: "nigar@stayboard.app", name: "Nigar Mövsümova", status: "opened", deliveredAt: "2026-06-09 07:01", openedAt: "2026-06-09 09:15" },
      { email: "support@stayboard.app", name: "Tariel S.", status: "delivered", deliveredAt: "2026-06-09 07:01" },
      { email: "rauf@caspian.az", name: "Rauf Aliyev", status: "delivered", deliveredAt: "2026-06-09 07:02" },
      { email: "leyla@kavkaz.ge", name: "Leyla Huseynova", status: "delivered", deliveredAt: "2026-06-09 07:02" },
    ],
    bcc: [
      { email: "archive@stayboard.app", name: "Archive", status: "delivered", deliveredAt: "2026-06-09 07:01" },
    ],
  },
  {
    id: "em-1008",
    subject: "PMS Module Access Granted",
    bodyHtml:
      "<p>Your <strong>PMS module access</strong> has been enabled for <em>Sheki Silk Inn</em>.</p><p>You can now log in and manage reservations.</p>",
    sentBy: "admin@stayboard.app",
    sentByName: "Aytac Admin",
    sentAt: "2026-06-08 13:20",
    status: "queued",
    to: [
      { email: "kamran@heritage.az", name: "Kamran V.", status: "queued" },
    ],
  },
];
