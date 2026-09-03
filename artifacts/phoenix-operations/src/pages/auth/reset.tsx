import { Link } from "wouter";
import AuthShell from "@/components/auth/AuthShell";

export default function ResetPage() {
  return (
    <AuthShell>
      <div className="auth-card">
        <img src="/assets/mark.png" alt="" width={40} height={40} className="mark" />
        <h1>Reset your password</h1>
        <p className="auth-sub">Password recovery email is unavailable until an email provider is connected.</p>
        <p className="auth-foot">
          <Link href="/login" className="auth-link">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
