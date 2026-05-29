import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, type ChatOption } from "../api";
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

const STEPS = ["Welcome", "Apify", "Gemini", "Telegram", "Finish"];

function Logo() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white text-sm font-bold">
      in
    </span>
  );
}

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={cx(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition",
              i < current
                ? "bg-brand-600 text-white"
                : i === current
                ? "bg-brand-600 text-white ring-4 ring-brand-200"
                : "bg-slate-200 text-slate-500"
            )}
          >
            {i < current ? "✓" : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cx(
                "h-0.5 w-6 rounded",
                i < current ? "bg-brand-600" : "bg-slate-200"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2 text-sm text-slate-600">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
            {i + 1}
          </span>
          <span dangerouslySetInnerHTML={{ __html: t }} />
        </li>
      ))}
    </ol>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [step, setStep] = useState(0);
  const [apifyKey, setApifyKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");

  const [chats, setChats] = useState<ChatOption[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const back = () => setStep((s) => Math.max(0, s - 1));
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));

  async function discover() {
    setDiscoverError(null);
    setDiscovering(true);
    try {
      const res = await api.discoverChatId(botToken.trim());
      setChats(res.chats);
      if (res.chats.length === 0) {
        setDiscoverError(
          "No chats found yet. Open Telegram, send any message to your bot, then try again."
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

  async function finish() {
    setSaveError(null);
    setSaving(true);
    try {
      await api.updateKeys({
        apify_key: apifyKey.trim(),
        gemini_key: geminiKey.trim(),
        telegram_bot_token: botToken.trim(),
        telegram_chat_id: chatId.trim(),
      });
      await refreshUser();
      navigate("/app", { replace: true });
    } catch (err) {
      setSaveError(
        err instanceof ApiError ? err.message : "Could not save your keys."
      );
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-aurora px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Logo />
          <span className="text-lg font-extrabold tracking-tight">Replier</span>
        </div>

        <div className="mb-8">
          <StepDots current={step} />
        </div>

        <Card>
          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Let's get you set up
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Replier runs on three services you already control. We'll walk
                you through connecting each one — it takes about three minutes.
              </p>

              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    What you'll connect
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                    <li>
                      <strong>Apify</strong> — fetches the latest posts from the
                      profiles you track.
                    </li>
                    <li>
                      <strong>Google Gemini</strong> — scores posts and writes
                      your comment drafts.
                    </li>
                    <li>
                      <strong>Telegram</strong> — where your finished drafts get
                      delivered each day.
                    </li>
                  </ul>
                </div>

                <Alert kind="info">
                  <strong>It's free.</strong> Replier itself costs nothing. You
                  pay only your own Apify and Gemini usage, which is tiny for
                  normal use — and often within their free tiers. Heavy use
                  across many profiles may need a paid tier on{" "}
                  <em>your</em> keys, but you stay in full control of the limits.
                </Alert>

                <Alert kind="warn">
                  <strong>Set spend limits.</strong> Before you finish, add a
                  monthly cap on both your Apify and Gemini accounts. Your keys
                  are encrypted here, but spend caps are your safety net no
                  matter what.
                </Alert>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={next}>Get started</Button>
              </div>
            </div>
          )}

          {/* Step 1 — Apify */}
          {step === 1 && (
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Connect Apify
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Apify is the scraper that pulls the newest posts from the
                profiles you track.
              </p>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <Steps
                  items={[
                    'Create a free account at <a class="font-medium text-brand-700 hover:underline" href="https://console.apify.com/sign-up" target="_blank" rel="noreferrer">console.apify.com</a>.',
                    'Open <a class="font-medium text-brand-700 hover:underline" href="https://console.apify.com/settings/integrations" target="_blank" rel="noreferrer">Settings &rarr; Integrations</a> and copy your <strong>Personal API token</strong>.',
                    'In <a class="font-medium text-brand-700 hover:underline" href="https://console.apify.com/billing/limits" target="_blank" rel="noreferrer">Billing &rarr; Limits</a>, set a monthly spend limit so usage can never surprise you.',
                    "Paste the token below.",
                  ]}
                />
              </div>

              <div className="mt-5">
                <Field
                  label="Apify API token"
                  hint="Starts with apify_api_…  Stored encrypted; never shown again."
                >
                  <Input
                    type="password"
                    value={apifyKey}
                    onChange={(e) => setApifyKey(e.target.value)}
                    placeholder="apify_api_..."
                    autoComplete="off"
                  />
                </Field>
              </div>

              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={back}>
                  Back
                </Button>
                <Button onClick={next} disabled={!apifyKey.trim()}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 2 — Gemini */}
          {step === 2 && (
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Connect Google Gemini
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Gemini reads each post, decides how relevant it is to you, and
                writes the drafts in your voice.
              </p>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <Steps
                  items={[
                    'Go to <a class="font-medium text-brand-700 hover:underline" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio &rarr; API keys</a>.',
                    'Click <strong>Create API key</strong> and copy it.',
                    'If you enable billing, set a budget alert in <a class="font-medium text-brand-700 hover:underline" href="https://console.cloud.google.com/billing" target="_blank" rel="noreferrer">Google Cloud Billing</a> to stay capped.',
                    "Paste the key below.",
                  ]}
                />
              </div>

              <div className="mt-5">
                <Field
                  label="Gemini API key"
                  hint="Starts with AIza…  Stored encrypted; never shown again."
                >
                  <Input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIza..."
                    autoComplete="off"
                  />
                </Field>
              </div>

              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={back}>
                  Back
                </Button>
                <Button onClick={next} disabled={!geminiKey.trim()}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 — Telegram */}
          {step === 3 && (
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Connect Telegram
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                This is where your drafts get delivered. You'll make a personal
                bot and let it message you.
              </p>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <Steps
                  items={[
                    'In Telegram, open <a class="font-medium text-brand-700 hover:underline" href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> and send <strong>/newbot</strong>. Follow the prompts.',
                    "BotFather gives you a <strong>bot token</strong> — paste it below.",
                    "Open a chat with your new bot and send it any message (e.g. “hi”). This lets it find you.",
                    'Click <strong>Find my chat</strong> and pick yourself from the list.',
                  ]}
                />
              </div>

              <div className="mt-5 space-y-4">
                <Field
                  label="Telegram bot token"
                  hint="From BotFather, looks like 123456789:AA…"
                >
                  <Input
                    type="password"
                    value={botToken}
                    onChange={(e) => {
                      setBotToken(e.target.value);
                      setChats([]);
                      setChatId("");
                    }}
                    placeholder="123456789:AA..."
                    autoComplete="off"
                  />
                </Field>

                <Button
                  variant="secondary"
                  onClick={discover}
                  loading={discovering}
                  disabled={!botToken.trim()}
                >
                  Find my chat
                </Button>

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
                          <span className="ml-2 text-slate-400">
                            {c.chat_id}
                          </span>
                        </span>
                        <Badge kind={chatId === c.chat_id ? "success" : "neutral"}>
                          {chatId === c.chat_id ? "Selected" : c.type}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}

                <Field
                  label="…or paste a chat ID manually"
                  hint="Optional — only if discovery didn't find you."
                >
                  <Input
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="e.g. 123456789"
                    autoComplete="off"
                  />
                </Field>
              </div>

              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={back}>
                  Back
                </Button>
                <Button
                  onClick={next}
                  disabled={!botToken.trim() || !chatId.trim()}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 4 — Finish */}
          {step === 4 && (
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                You're all set
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Save your keys to finish. They're encrypted before they touch
                the database. Next, add the profiles you want to track and pick
                a daily time.
              </p>

              <div className="mt-5 space-y-2">
                <SummaryRow label="Apify token" ok={!!apifyKey.trim()} />
                <SummaryRow label="Gemini key" ok={!!geminiKey.trim()} />
                <SummaryRow label="Telegram bot" ok={!!botToken.trim()} />
                <SummaryRow label="Telegram chat" ok={!!chatId.trim()} />
              </div>

              {saveError && (
                <div className="mt-4">
                  <Alert kind="error">{saveError}</Alert>
                </div>
              )}

              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={back}>
                  Back
                </Button>
                <Button onClick={finish} loading={saving}>
                  Save & continue
                </Button>
              </div>
            </div>
          )}
        </Card>

        {step > 0 && step < 4 && (
          <p className="mt-6 text-center text-xs text-slate-500">
            {discovering ? (
              <span className="inline-flex items-center gap-1.5">
                <Spinner small /> working…
              </span>
            ) : (
              "Your keys are encrypted at rest and never displayed again."
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5">
      <span className="text-sm text-slate-700">{label}</span>
      <Badge kind={ok ? "success" : "warn"}>{ok ? "Ready" : "Missing"}</Badge>
    </div>
  );
}
