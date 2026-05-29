import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type Run, type Settings } from "../api";
import { useAuth } from "../auth";
import { fmtClock, fmtDateTime, fmtRelative } from "../format";
import {
  Alert,
  Badge,
  Button,
  Card,
  Spinner,
} from "../components/ui";

function statusKind(status: string): "success" | "error" | "warn" | "neutral" {
  const s = status.toLowerCase();
  if (s.includes("success") || s === "ok" || s === "done") return "success";
  if (s.includes("error") || s.includes("fail")) return "error";
  if (s.includes("running") || s.includes("progress")) return "warn";
  return "neutral";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [nextRun, setNextRun] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      const [s, r, n] = await Promise.all([
        api.getSettings(),
        api.listRuns(),
        api.nextRun(),
      ]);
      setSettings(s);
      setRuns(r);
      setNextRun(n.next_run_at);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load your dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runTest() {
    setNotice(null);
    setTesting(true);
    try {
      await api.triggerTest();
      setNotice(
        "Test run started. Drafts (if any) will arrive on Telegram shortly — refreshing results…"
      );
      setTimeout(() => {
        api.listRuns().then(setRuns).catch(() => {});
        setTesting(false);
      }, 5000);
    } catch (err) {
      setNotice(null);
      setError(
        err instanceof ApiError ? err.message : "Could not start a test run."
      );
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-brand-600">
        <Spinner />
      </div>
    );
  }

  const onboarded = user?.onboarded && settings?.keys
    ? settings.keys.apify_set &&
      settings.keys.gemini_set &&
      settings.keys.telegram_bot_set &&
      settings.keys.telegram_chat_set
    : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Your daily drafting at a glance.
        </p>
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      {!onboarded && (
        <Alert kind="warn">
          <div className="flex items-center justify-between gap-4">
            <span>Finish connecting your keys to start receiving drafts.</span>
            <Link to="/onboarding">
              <Button variant="secondary">Finish setup</Button>
            </Link>
          </div>
        </Alert>
      )}

      {notice && <Alert kind="info">{notice}</Alert>}

      {/* Status grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Status
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge kind={settings?.enabled ? "success" : "neutral"}>
              {settings?.enabled ? "Active" : "Paused"}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {settings?.enabled
              ? `Runs daily at ${fmtClock(
                  settings.schedule_hour,
                  settings.schedule_minute
                )}`
              : "Enable a schedule to run daily."}
          </p>
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Next run
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {settings?.enabled ? fmtDateTime(nextRun) : "—"}
          </p>
          <p className="mt-1 text-sm text-slate-500">{settings?.timezone}</p>
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Last run
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {fmtRelative(settings?.last_run_at)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {runs[0] ? runs[0].message || runs[0].status : "No runs yet"}
          </p>
        </Card>
      </div>

      {/* Test run */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Run a test now
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Fetch, score, and draft right now to confirm everything works.
              Uses your Apify and Gemini quota.
            </p>
          </div>
          <Button onClick={runTest} loading={testing} disabled={!onboarded}>
            Run test
          </Button>
        </div>
      </Card>

      {/* Recent runs */}
      <Card>
        <h2 className="text-base font-semibold text-slate-900">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Nothing yet. Your first run will appear here.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-4 font-medium">When</th>
                  <th className="pb-2 pr-4 font-medium">Trigger</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Posts</th>
                  <th className="pb-2 font-medium">Drafts</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4 text-slate-700">
                      {fmtDateTime(r.started_at)}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500 capitalize">
                      {r.trigger}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge kind={statusKind(r.status)}>{r.status}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-700">
                      {r.posts_fetched}
                    </td>
                    <td className="py-2.5 text-slate-700">{r.drafts_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
