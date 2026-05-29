import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { Alert, Button, Card, Field, Input } from "../components/ui";

function Logo() {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white text-sm font-bold">
      in
    </span>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      await login(res.access_token);
      navigate(res.onboarded ? "/app" : "/onboarding", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong. Try again."
      );
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-aurora px-6 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <Logo />
          <span className="text-lg font-extrabold tracking-tight">Replier</span>
        </Link>
        <Card>
          <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">
            Log in to your Replier account.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <Alert kind="error">{error}</Alert>}
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
            </Field>
            <Button type="submit" loading={loading} className="w-full">
              Log in
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-600">
          New here?{" "}
          <Link to="/signup" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
