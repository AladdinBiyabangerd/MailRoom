import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { queryClient } from "@/lib/query-client";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import NotFound from "@/pages/NotFound";
import EmailComposer from "@/pages/EmailComposer";
import EmailHistory from "@/pages/EmailHistory";
import Campaigns from "@/pages/Campaigns";
import CampaignEditor from "@/pages/CampaignEditor";
import EmailContacts from "@/pages/EmailContacts";
import EmailTemplates from "@/pages/EmailTemplates";
import EmailTemplateEditor from "@/pages/EmailTemplateEditor";
import EmailAnalytics from "@/pages/EmailAnalytics";
import EmailSuppressions from "@/pages/EmailSuppressions";
import EmailSenderIdentities from "@/pages/EmailSenderIdentities";
import EmailDeliverySettings from "@/pages/EmailDeliverySettings";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <Toaster position="top-right" richColors />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/emails/compose" replace />} />
                  <Route path="emails/compose" element={<EmailComposer />} />
                  <Route path="emails/campaigns" element={<Campaigns />} />
                  <Route path="emails/campaigns/new" element={<CampaignEditor />} />
                  <Route path="emails/campaigns/:id/edit" element={<CampaignEditor />} />
                  <Route path="emails/templates" element={<EmailTemplates />} />
                  <Route path="emails/templates/new" element={<EmailTemplateEditor />} />
                  <Route path="emails/templates/:id/edit" element={<EmailTemplateEditor />} />
                  <Route path="emails/contacts" element={<EmailContacts />} />
                  <Route path="emails/history" element={<EmailHistory />} />
                  <Route path="emails/analytics" element={<EmailAnalytics />} />
                  <Route path="emails/suppressions" element={<EmailSuppressions />} />
                  <Route path="email-delivery" element={<EmailDeliverySettings />} />
                  <Route path="email-delivery/senders" element={<EmailSenderIdentities />} />
                </Route>

                <Route path="/404" element={<NotFound />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
