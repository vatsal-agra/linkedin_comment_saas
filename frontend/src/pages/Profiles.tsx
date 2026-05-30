import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type Profile } from "../api";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Spinner,
  Textarea,
} from "../components/ui";

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "").replace(/\/$/, "");
}

export default function Profiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [single, setSingle] = useState("");
  const [adding, setAdding] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState("");
  const [bulkAdding, setBulkAdding] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addingSelected, setAddingSelected] = useState(false);

  async function load() {
    try {
      setProfiles(await api.listProfiles());
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load your profiles."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addSingle(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setAdding(true);
    try {
      const p = await api.addProfile(single.trim());
      setProfiles((prev) => [p, ...prev.filter((x) => x.id !== p.id)]);
      setSingle("");
      setNotice("Profile added.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not add that profile."
      );
    } finally {
      setAdding(false);
    }
  }

  async function addBulk() {
    setError(null);
    setNotice(null);
    const urls = bulk
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) return;
    setBulkAdding(true);
    try {
      const added = await api.addBulk(urls);
      await load();
      setBulk("");
      setBulkOpen(false);
      setNotice(`Added ${added.length} profile${added.length === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not add those profiles."
      );
    } finally {
      setBulkAdding(false);
    }
  }

  async function runSuggest() {
    setError(null);
    setNotice(null);
    setSuggesting(true);
    try {
      const { urls } = await api.suggestProfiles();
      setSuggestions(urls);
      setSelected(new Set(urls));
      if (urls.length === 0) {
        setNotice("Couldn't extract any suggestions this time — try again.");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not generate suggestions."
      );
    } finally {
      setSuggesting(false);
    }
  }

  function toggleSel(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  async function addSelected() {
    const urls = suggestions.filter((u) => selected.has(u));
    if (urls.length === 0) return;
    setError(null);
    setNotice(null);
    setAddingSelected(true);
    try {
      const added = await api.addBulk(urls);
      await load();
      setSuggestions([]);
      setSelected(new Set());
      setNotice(`Added ${added.length} profile${added.length === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not add those profiles."
      );
    } finally {
      setAddingSelected(false);
    }
  }

  async function remove(id: number) {
    setError(null);
    setDeletingId(id);
    try {
      await api.deleteProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not remove that profile."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Tracked profiles
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          The LinkedIn people whose new posts you want drafts for. You control
          the Apify spend — see the note below on sensible limits.
        </p>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Alert kind="info">
        On the <strong>free Apify tier</strong>, stick to around{" "}
        <strong>10 profiles</strong>. Each profile is fetched every run, so more
        profiles means more Apify usage — go beyond 10 only once you've raised
        the limits on your own Apify key.
      </Alert>

      <Card>
        <form onSubmit={addSingle} className="space-y-4">
          <Field
            label="Add a profile"
            hint="Paste a full profile URL, e.g. https://www.linkedin.com/in/username"
          >
            <div className="flex gap-2">
              <Input
                type="url"
                required
                value={single}
                onChange={(e) => setSingle(e.target.value)}
                placeholder="https://www.linkedin.com/in/username"
              />
              <Button type="submit" loading={adding} className="flex-shrink-0">
                Add
              </Button>
            </div>
          </Field>
        </form>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setBulkOpen((v) => !v)}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            {bulkOpen ? "Hide bulk add" : "Add several at once"}
          </button>
        </div>

        {bulkOpen && (
          <div className="mt-3 space-y-3">
            <Field
              label="Paste multiple URLs"
              hint="One per line (or comma-separated). Duplicates are ignored."
            >
              <Textarea
                rows={5}
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder={"https://www.linkedin.com/in/one\nhttps://www.linkedin.com/in/two"}
              />
            </Field>
            <Button
              variant="secondary"
              onClick={addBulk}
              loading={bulkAdding}
              disabled={!bulk.trim()}
            >
              Add all
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Suggest profiles for me
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              We read your "About me" and ask Gemini for LinkedIn people worth
              following. Pick the ones you want — they're AI suggestions, so
              double-check each link.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={runSuggest}
            loading={suggesting}
            className="flex-shrink-0"
          >
            Auto-suggest
          </Button>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-4 space-y-3">
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {suggestions.map((url) => (
                <li key={url} className="flex items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(url)}
                    onChange={() => toggleSel(url)}
                    className="h-4 w-4 flex-shrink-0 accent-brand-600"
                  />
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-sm text-slate-700 hover:text-brand-600 hover:underline"
                  >
                    {shortUrl(url)}
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3">
              <Button
                onClick={addSelected}
                loading={addingSelected}
                disabled={selected.size === 0}
              >
                Add selected ({selected.size})
              </Button>
              <button
                type="button"
                onClick={() => {
                  setSuggestions([]);
                  setSelected(new Set());
                }}
                className="text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Your profiles
          </h2>
          <Badge kind="neutral">{profiles.length} tracked</Badge>
        </div>

        {loading ? (
          <div className="grid place-items-center py-10 text-brand-600">
            <Spinner />
          </div>
        ) : profiles.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No profiles yet. Add your first one above.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">
                    {shortUrl(p.url)}
                  </p>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-xs text-slate-400 hover:text-brand-600 hover:underline"
                  >
                    {p.url}
                  </a>
                </div>
                <Button
                  variant="ghost"
                  className="flex-shrink-0 text-red-600 hover:bg-red-50"
                  loading={deletingId === p.id}
                  onClick={() => remove(p.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
