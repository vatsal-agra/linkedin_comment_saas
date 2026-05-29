import { useEffect, useState } from "react";
import { api, ApiError, type ChatOption, type KeysStatus } from "../api";
import { useAuth } from "../auth";
import {
  Alert,
  Badge,
  Button,
  Card,
  cx,
  Field,
  Input,
  Spinner,
} from "../components/ui";

function StatusBadge({ set }: { set: boolean }) {
  return (
    <Badge kind={set ? "success" : "warn"}>
      {set ? "Connected" : "Not set"}
    </Badge>
  );
}

export default function Keys() {
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<KeysStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [apify, setApify] = useState("");
  const [gemini, setGemini] = useState("");
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");

  const [chats, setChats] = useState<ChatOption[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  async function load() {
    try {
      const s = await api.getSettings();
      setStatus(s.keys);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load your keys."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function discover() {
    setDiscoverError(null);
    setDiscovering(true);
    try {
      const res = await api.discoverChatId(botToken.trim());
      setChats(res.chats);
      if (res.chats.length === 0) {
        setDiscoverError(
          "No chats found. Send your bot a message in Telegram, then try again."
        );
      } else if (res.chats.length === 1) {
        setChatId(res.chats[0].chat_id);
      }
    } catch (err) {
      setDiscoverError(
        err instanceof ApiError ? err.message : "Could not reach Telegram."
      );
    } finally {
      setDiscovering(false);
    }
  }

  async function save() {
    setError(null);
    setNotice(null);
    const payload: {
      apify_key?: string;
      gemini_key?: string;
      telegram_bot_token?: string;
      telegram_chat_id?: string;
    } = {};
    if (apify.trim()) payload.apify_key = apify.trim();
    if (gemini.trim()) payload.gemini_key = gemini.trim();
    if (botToken.trim()) payload.telegram_bot_token = botToken.trim();
    if (chatId.trim()) payload.telegram_chat_id = chatId.trim();

    if (Object.keys(payload).length === 0) {
      setNotice("Nothing to update — fill a field to replace a key.");
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateKeys(payload);
      setStatus(updated.keys);
      await refreshUser();
      setApify("");
      setGemini("");
      setBotToken("");
      setChatId("");
      setChats([]);
      setNotice("Keys updated.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not update your keys."
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
          API keys
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Replace a key by entering a new value. Leave a field blank to keep the
          current one. Keys are encrypted at rest and never displayed back.
        </p>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}

      <Alert kind="warn">
        <strong>Protect yourself with spend caps.</strong> Set a monthly limit
        on your Apify and Gemini accounts. Even though your keys are encrypted
        here, a hard cap guarantees usage can never run away.
      </Alert>

      {/* Apify */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Apify</h2>
          <StatusBadge set={!!status?.apify_set} />
        </div>
        <Field
          label="Apify API token"
          hint="Set a cap in Apify → Billing → Limits."
        >
          <Input
            type="password"
            value={apify}
            onChange={(e) => setApify(e.target.value)}
            placeholder={status?.apify_set ? "•••••••• (set) — enter to replace" : "apify_api_..."}
            autoComplete="off"
          />
        </Field>
      </Card>

      {/* Gemini */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Google Gemini
          </h2>
          <StatusBadge set={!!status?.gemini_set} />
        </div>
        <Field
          label="Gemini API key"
          hint="Set a budget alert in Google Cloud Billing if billing is enabled."
        >
          <Input
            type="password"
            value={gemini}
            onChange={(e) => setGemini(e.target.value)}
            placeholder={status?.gemini_set ? "•••••••• (set) — enter to replace" : "AIza..."}
            autoComplete="off"
          />
        </Field>
      </Card>

      {/* Telegram */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Telegram</h2>
          <div className="flex gap-2">
            <StatusBadge set={!!status?.telegram_bot_set} />
            <StatusBadge set={!!status?.telegram_chat_set} />
          </div>
        </div>

        <div className="space-y-4">
          <Field
            label="Bot token"
            hint="From @BotFather. Enter it to replace or to re-discover your chat."
          >
            <Input
              type="password"
              value={botToken}
              onChange={(e) => {
                setBotToken(e.target.value);
                setChats([]);
              }}
              placeholder={
                status?.telegram_bot_set
                  ? "•••••••• (set) — enter to replace"
                  : "123456789:AA..."
              }
              autoComplete="off"
            />
          </Field>

          <div>
            <Button
              variant="secondary"
              onClick={discover}
              loading={discovering}
              disabled={!botToken.trim()}
            >
              Find my chat
            </Button>
            <p className="mt-1.5 text-xs text-slate-500">
              Enter your bot token above first, then message the bot on Telegram.
            </p>
          </div>

          {discoverError && <Alert kind="warn">{discoverError}</Alert>}

          {chats.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                Select where drafts should go:
              </p>
              {chats.map((c) => (
                <button
                  key={c.chat_id}
                  type="button"
                  onClick={() => setChatId(c.chat_id)}
                  className={cx(
                    "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition",
                    chatId === c.chat_id
                      ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/30"
                      : "border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <span>
                    <span className="font-medium text-slate-900">
                      {c.name || "Chat"}
                    </span>
                    <span className="ml-2 text-slate-400">{c.chat_id}</span>
                  </span>
                  <Badge kind={chatId === c.chat_id ? "success" : "neutral"}>
                    {chatId === c.chat_id ? "Selected" : c.type}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          <Field label="Chat ID" hint="Auto-filled by discovery, or paste manually.">
            <Input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder={
                status?.telegram_chat_set
                  ? "•••••••• (set) — enter to replace"
                  : "e.g. 123456789"
              }
              autoComplete="off"
            />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
