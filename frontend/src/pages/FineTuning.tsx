import { useEffect, useState } from "react";
import { api, ApiError, type Settings } from "../api";
import { Alert, Button, Card, Field, Spinner } from "../components/ui";

const selectClass =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-white";

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

export default function FineTuning() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then(setS)
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not load your settings."
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
        relevance_threshold: s.relevance_threshold,
        posts_per_profile: s.posts_per_profile,
        max_drafts_per_account: s.max_drafts_per_account,
        gemini_model: s.gemini_model,
      });
      setS(updated);
      setNotice("Fine-tuning saved. It applies to your next run — test or scheduled.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save your settings."
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
          Fine-tuning
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Control how Replier filters and drafts. These settings apply to every
          run — both test runs and your daily scheduled run.
        </p>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Card>
        <div className="space-y-5">
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

          <Alert kind="warn">
            Increasing <strong>posts per profile</strong> makes each run fetch
            more from Apify. On the free Apify tier this burns through your
            credits much faster — 5 is a safe default, and most people don't
            post more than a few times a day anyway.
          </Alert>

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
          Save fine-tuning
        </Button>
      </div>
    </div>
  );
}
