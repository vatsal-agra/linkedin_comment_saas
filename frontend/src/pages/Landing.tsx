import { Link } from "react-router-dom";
import { Button } from "../components/ui";

function Logo() {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white text-sm font-bold">
      in
    </span>
  );
}

const STEPS = [
  {
    title: "Bring your own keys",
    body: "Connect your Apify, Gemini, and Telegram in a 3-minute guided setup. Your keys are encrypted and only ever used to run your own jobs.",
  },
  {
    title: "Pick who to track",
    body: "Add as many LinkedIn profiles as you like. Every day we fetch their newest posts and score each one for how relevant it is to you.",
  },
  {
    title: "Get drafts on Telegram",
    body: "At the time you choose, ready-to-paste comment drafts land in your Telegram — in your voice, on the posts worth engaging with.",
  },
];

const FEATURES = [
  {
    title: "Sounds like you",
    body: "Drafts are written from your profile and writing samples, so comments read like something you'd actually post.",
  },
  {
    title: "Only the good ones",
    body: "Posts are scored for relevance before anything is drafted. Low-signal posts are skipped automatically.",
  },
  {
    title: "Runs itself, daily",
    body: "Set a time once. Every day it fetches, scores, drafts, and delivers — no clicking, no dashboards to babysit.",
  },
  {
    title: "Your keys, your control",
    body: "You hold the API keys and the spend caps. Encrypted at rest, never shared, deletable anytime.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-aurora">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-extrabold tracking-tight">Replier</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link to="/signup">
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-20 text-center">
        <span className="inline-flex items-center rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-medium text-brand-700 backdrop-blur">
          Daily AI comment drafts for LinkedIn
        </span>
        <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Show up in the comments,
          <br />
          without the daily grind.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">
          Replier reads the people you follow, finds the posts worth engaging
          with, and writes comment drafts in your voice — delivered to your
          Telegram every day, ready to paste.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/signup">
            <Button className="px-6 py-3 text-base">Start for free</Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary" className="px-6 py-3 text-base">
              I already have an account
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Free to use. You bring your own API keys and set the spend limits.
        </p>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-card backdrop-blur"
            >
              <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                {i + 1}
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          Built to feel effortless
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
            >
              <h3 className="text-base font-semibold text-slate-900">
                {f.title}
              </h3>
              <p className="mt-1.5 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <div className="rounded-3xl border border-brand-200 bg-white p-10 shadow-card">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Ready in about three minutes
          </h2>
          <p className="mx-auto mt-3 max-w-md text-slate-600">
            Create an account, connect your keys, pick your profiles, and choose
            a time. Replier handles the rest, every day.
          </p>
          <div className="mt-6">
            <Link to="/signup">
              <Button className="px-6 py-3 text-base">Get started free</Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200/60 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-semibold text-slate-700">Replier</span>
          </div>
          <span>You write the relationships. We draft the openers.</span>
        </div>
      </footer>
    </div>
  );
}
