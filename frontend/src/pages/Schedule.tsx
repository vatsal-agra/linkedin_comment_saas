import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type Settings } from "../api";
import { fmtClock } from "../format";
import {
  Alert,
  Button,
  Card,
  cx,
  Field,
  Spinner,
} from "../components/ui";

const selectClass =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-white";

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

const FALLBACK_ZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Singapore",
  "Asia/Dubai",
  "Australia/Sydney",
];

function getZones(): string[] {
  try {
    const fn = (Intl as unknown as {
      supportedValuesOf?: (k: string) => string[];
    }).supportedValuesOf;
    if (fn) return fn("timeZone");
  } catch {
    /* ignore */
  }
  return FALLBACK_ZONES;
}

export default function Schedule() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const zones = useMemo(getZones, []);

  useEffect(() => {
    api
      .getSettings()
      .then(setS)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Could not load your schedule."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  function patch(p: Partial<Settings>) {
    setS((prev) => (prev ? { ...prev, ...p } : prev));
  }

  async function save() {
    if (!s) return;
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const updated = await api.updateSettings({
        enabled: s.enabled,
        schedule_hour: s.schedule_hour,
        schedule_minute: s.schedule_minute,
        timezone: s.timezone,
        relevance_threshold: s.relevance_threshold,
        posts_per_profile: s.posts_per_profile,
        max_drafts_per_account: s.max_drafts_per_account,
        gemini_model: s.gemini_model,
      });
      setS(updated);
      setNotice("Schedule saved.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save your schedule."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !s) {
    return (
      <div className="grid place-items-center py-20 text-brand-600">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Schedule
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Pick when Replier runs each day and fine-tune how it filters and
          drafts.
        </p>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      {/* Enable */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Daily automation
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {s.enabled
                ? `On — runs every day at ${fmtClock(
                    s.schedule_hour,
                    s.schedule_minute
                  )} (${s.timezone}).`
                : "Off — Replier won't run automatically."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={s.enabled}
            onClick={() => patch({ enabled: !s.enabled })}
            className={cx(
              "relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition",
              s.enabled ? "bg-brand-600" : "bg-slate-300"
            )}
          >
            <span
              className={cx(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
                s.enabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
      </Card>

      {/* Time */}
      <Card>
        <h2 className="text-base font-semibold text-slate-900">Run time</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Hour">
            <select
              className={selectClass}
              value={s.schedule_hour}
              onChange={(e) => patch({ schedule_hour: Number(e.target.value) })}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {fmtClock(h, 0).replace(":00", "")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minute">
            <select
              className={selectClass}
              value={s.schedule_minute}
              onChange={(e) =>
                patch({ schedule_minute: Number(e.target.value) })
              }
            >
              {Array.from({ length: 60 }, (_, m) => m)
                .filter((m) => m % 5 === 0 || m === s.schedule_minute)
                .map((m) => (
                  <option key={m} value={m}>
                    :{String(m).padStart(2, "0")}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Time zone">
            <select
              className={selectClass}
              value={s.timezone}
              onChange={(e) => patch({ timezone: e.target.value })}
            >
              {!zones.includes(s.timezone) && (
                <option value={s.timezone}>{s.timezone}</option>
              )}
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Drafts will arrive around{" "}
          <strong>{fmtClock(s.schedule_hour, s.schedule_minute)}</strong> your
          chosen time zone, every day.
        </p>
      </Card>

      {/* Tuning */}
      <Card>
        <h2 className="text-base font-semibold text-slate-900">Fine-tuning</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sensible defaults are set. Adjust only if you want to.
        </p>

        <div className="mt-5 space-y-5">
          <Field
            label={`Relevance threshold — ${s.relevance_threshold}/10`}
            hint="Only posts scoring at or above this get a draft. Higher = stricter, fewer drafts."
          >
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={s.relevance_threshold}
              onChange={(e) =>
                patch({ relevance_threshold: Number(e.target.value) })
              }
              className="w-full accent-brand-600"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Posts per profile"
              hint="How many recent posts to fetch per profile (1–50)."
            >
              <input
                type="number"
                min={1}
                max={50}
                value={s.posts_per_profile}
                onChange={(e) =>
                  patch({
                    posts_per_profile: Math.max(
                      1,
                      Math.min(50, Number(e.target.value) || 1)
                    ),
                  })
                }
                className={selectClass}
              />
            </Field>
            <Field
              label="Max drafts per profile"
              hint="Cap on drafts created per profile each run (1–20)."
            >
              <input
                type="number"
                min={1}
                max={20}
                value={s.max_drafts_per_account}
                onChange={(e) =>
                  patch({
                    max_drafts_per_account: Math.max(
                      1,
                      Math.min(20, Number(e.target.value) || 1)
                    ),
                  })
                }
                className={selectClass}
              />
            </Field>
          </div>

          <Field
            label="Gemini model"
            hint="Flash models are fast and cheap. Pro is stronger but costs more."
          >
            <select
              className={selectClass}
              value={s.gemini_model}
              onChange={(e) => patch({ gemini_model: e.target.value })}
            >
              {!MODELS.includes(s.gemini_model) && (
                <option value={s.gemini_model}>{s.gemini_model}</option>
              )}
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Save schedule
        </Button>
      </div>
    </div>
  );
}
