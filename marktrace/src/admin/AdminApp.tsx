import { useEffect, useState } from 'react';
import { DashboardPage } from './DashboardPage';
import { LoginPage } from './LoginPage';

export function AdminApp() {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void fetch('/admin/api/me')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { email: string };
        setEmail(data.email);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-light dark:bg-page-dark">
        <p className="text-sm text-secondary-light dark:text-secondary-dark">Loading…</p>
      </div>
    );
  }

  if (!email) {
    return <LoginPage onLogin={setEmail} />;
  }

  return <DashboardPage email={email} onLogout={() => setEmail(null)} />;
}
