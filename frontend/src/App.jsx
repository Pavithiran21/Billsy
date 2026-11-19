import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Route, Routes } from 'react-router';
import { restoreSession } from './auth/authThunks';
import { HomeRedirect, PublicOnly, RequireBusiness, RequireRole, RequireSituation, StartupScreen } from './auth/guards';
import { SvgDefs } from './components/Logo';
import { ErrorPanel } from './components/Panels';
import { useMetaQuery } from './features/auth/authApi';
import { AcceptInvitePage } from './features/auth/AcceptInvitePage';
import { DeactivatedPage } from './features/auth/DeactivatedPage';
import { DemoPage } from './features/auth/DemoPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { LoginPage } from './features/auth/LoginPage';
import { NoBusinessPage } from './features/auth/NoBusinessPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { SignupPage } from './features/auth/SignupPage';
import { CreditNoteListPage } from './features/creditNotes/CreditNoteListPage';
import { CreditNotePage } from './features/creditNotes/CreditNotePage';
import { CustomerFormPage } from './features/customers/CustomerFormPage';
import { CustomerListPage } from './features/customers/CustomerListPage';
import { CustomerViewPage } from './features/customers/CustomerViewPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { InvoiceEditorPage } from './features/invoices/InvoiceEditorPage';
import { InvoiceListPage } from './features/invoices/InvoiceListPage';
import { InvoiceViewPage } from './features/invoices/InvoiceViewPage';
import { PaymentListPage } from './features/payments/PaymentListPage';
import { ProductFormPage } from './features/products/ProductFormPage';
import { ProductListPage } from './features/products/ProductListPage';
import { ProductViewPage } from './features/products/ProductViewPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { ReportPage } from './features/reports/ReportPage';
import { BusinessSettingsPage } from './features/settings/BusinessSettingsPage';
import { TeamPage } from './features/settings/TeamPage';
import { AppShell } from './layout/AppShell';
import { NotFoundPage } from './pages/ErrorPages';
import { ToastStack } from './toasts/ToastStack';

// The 403 messages are the server's own words (utils/roles.js and the services).
const VIEW_ONLY = 'Accountants have view-only access.';
const WRITERS = ['owner', 'staff'];

export function App() {
  const dispatch = useDispatch();
  // States, GST rates and payment modes fill the selects. They load once, before any screen, so a
  // form's select never mounts without its options (it would show and submit the first option).
  const meta = useMetaQuery();
  // Only the first load waits. Log out, an ended session and a password reset clear the API cache,
  // /api/meta included, and it reloads in the background: hiding the routes meanwhile would
  // unmount the page on screen and lose its state ("Password changed." on Reset password).
  const [metaLoaded, setMetaLoaded] = useState(false);
  if (meta.isSuccess && !metaLoaded) {
    setMetaLoaded(true);
  }

  useEffect(() => {
    // One refresh with the HTTP-only cookie: a reload keeps you logged in, the token stays in memory.
    dispatch(restoreSession());
  }, [dispatch]);

  if (!meta.isSuccess && !metaLoaded) {
    return (
      <>
        <SvgDefs />
        {meta.isError ? (
          <div className="auth-page">
            <ErrorPanel error={meta.error} onRetry={meta.refetch} />
          </div>
        ) : (
          <StartupScreen />
        )}
      </>
    );
  }

  return (
    <>
      <SvgDefs />
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/" element={<LoginPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        {/* Sign-up logs the new Owner in after step 2 and still shows step 3, so it has no guard. */}
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/invite/:token" element={<AcceptInvitePage />} />
        <Route element={<RequireSituation path="/no-business" />}>
          <Route path="/no-business" element={<NoBusinessPage />} />
        </Route>
        <Route element={<RequireSituation path="/deactivated" />}>
          <Route path="/deactivated" element={<DeactivatedPage />} />
        </Route>

        <Route element={<RequireBusiness />}>
          <Route element={<AppShell />}>
            <Route
              path="/home"
              element={
                <HomeRedirect>
                  <DashboardPage />
                </HomeRedirect>
              }
            />
            <Route path="/invoices" element={<InvoiceListPage />} />
            <Route path="/invoices/:id" element={<InvoiceViewPage />} />
            <Route element={<RequireRole roles={WRITERS} message={VIEW_ONLY} />}>
              <Route path="/invoices/new" element={<InvoiceEditorPage />} />
              <Route path="/invoices/:id/edit" element={<InvoiceEditorPage />} />
              <Route path="/customers/new" element={<CustomerFormPage />} />
              <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
              <Route path="/products/new" element={<ProductFormPage />} />
              <Route path="/products/:id/edit" element={<ProductFormPage />} />
            </Route>
            <Route path="/credit-notes" element={<CreditNoteListPage />} />
            <Route path="/credit-notes/:id" element={<CreditNotePage />} />
            <Route path="/payments" element={<PaymentListPage />} />
            <Route path="/customers" element={<CustomerListPage />} />
            <Route path="/customers/:id" element={<CustomerViewPage />} />
            <Route path="/products" element={<ProductListPage />} />
            <Route path="/products/:id" element={<ProductViewPage />} />
            <Route element={<RequireRole roles={['owner', 'accountant']} message="Reports are for the Owner and the Accountant." />}>
              <Route path="/reports/sales" element={<ReportPage kind="sales" />} />
              <Route path="/reports/gst" element={<ReportPage kind="gst" />} />
            </Route>
            <Route element={<RequireRole roles={['owner']} message="Only the Owner can change the business settings." />}>
              <Route path="/settings/business" element={<BusinessSettingsPage />} />
            </Route>
            <Route element={<RequireRole roles={['owner']} message="Only the Owner can manage the team." />}>
              <Route path="/settings/team" element={<TeamPage />} />
            </Route>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
      <ToastStack />
    </>
  );
}
