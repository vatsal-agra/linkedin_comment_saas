import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import {
  Alert,
  Button,
  Card,
  Field,
  Spinner,
  Textarea,
} from "../components/ui";

export default function MyProfile() {
  const [profileText, setProfileText] = useState("");
  const [styleSamples, setStyleSamples] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setProfileText(s.profile_text || "");
        setStyleSamples(s.style_samples || "");
      })
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Could not load your profile."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await api.updateSettings({
        profile_text: profileText,
        style_samples: styleSamples,
      });
      setNotice("Saved.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
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
          My profile
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          This is how Replier decides what's relevant to you and how your drafts
          should sound. The more specific, the better the results.
        </p>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Card>
        <Field
          label="About you"
          hint="Who you are, what you work on, the topics you care about. Used to score how relevant each post is to you."
        >
          <Textarea
            rows={8}
            value={profileText}
            onChange={(e) => setProfileText(e.target.value)}
            placeholder={
              "e.g. I'm a final-year CS student focused on AI/ML and building developer tools. I care about LLM applications, startups, open-source, and career advice for early engineers. I'm less interested in generic motivational content."
            }
          />
        </Field>
      </Card>

      <Card>
        <Field
          label="Your writing style"
          hint="A few example comments or sentences in your voice. Drafts will mimic this tone — keep it natural, the way you actually write."
        >
          <Textarea
            rows={8}
            value={styleSamples}
            onChange={(e) => setStyleSamples(e.target.value)}
            placeholder={
              "Paste 3–5 short comments you'd actually post. Casual, specific, no corporate fluff. These set the tone for every draft."
            }
          />
        </Field>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Save profile
        </Button>
      </div>
    </div>
  );
}
