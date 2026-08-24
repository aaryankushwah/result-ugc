const workflow = [
  { number: "01", title: "Track", copy: "Keep every creator, post, deliverable, and performance signal in one place." },
  { number: "02", title: "Understand", copy: "Turn reference links into transcripts, hooks, scenes, and reusable insights." },
  { number: "03", title: "Adapt", copy: "Use AI to reshape winning ideas around Sodium's voice, product, and audience." },
  { number: "04", title: "Ship", copy: "Create briefs, coordinate creators in Discord, and follow work through delivery." },
];

const modules = [
  ["Content tracking", "Posts, creators, campaigns, and historical performance"],
  ["Reference intelligence", "Transcripts, patterns, hooks, and creative analysis"],
  ["Brief workspace", "Brand-aware concepts that become clear production briefs"],
  ["Creator operations", "Assignments, approvals, payouts, and Discord workflows"],
];

function StatusRow({ label, detail, status }: { label: string; detail: string; status: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 border-t border-zinc-200 py-4 first:border-0 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium text-zinc-950">{label}</p>
        <p className="mt-1 text-sm text-zinc-500">{detail}</p>
      </div>
      <span className="mt-0.5 h-fit rounded-full bg-lime-100 px-2.5 py-1 text-xs font-semibold text-lime-800">{status}</span>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f4ee] text-zinc-950">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-10">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-950 text-sm font-bold text-white">S</span>
          <div>
            <p className="text-sm font-semibold tracking-tight">Sodium UGC</p>
            <p className="text-xs text-zinc-500">Internal workspace</p>
          </div>
        </div>
        <span className="rounded-full border border-zinc-300 bg-white/70 px-3 py-1.5 text-xs font-medium text-zinc-600">Foundation online</span>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 pb-20 pt-16 lg:grid-cols-[1.35fr_0.65fr] lg:px-10 lg:pt-24">
        <div>
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.24em] text-lime-700">One creative operating system</p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-7xl">Make every reference video useful to the whole team.</h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-600">A single home for UGC tracking, creative intelligence, briefs, and creator operations—built around how Sodium actually works.</p>
        </div>

        <aside className="self-end rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_20px_70px_rgba(0,0,0,0.06)]">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Infrastructure</p>
          <StatusRow label="Web dashboard" detail="Vercel" status="Ready" />
          <StatusRow label="Discord worker" detail="Hetzner" status="Migrated" />
          <StatusRow label="Social data" detail="Provider adapter" status="Next" />
        </aside>
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl divide-y divide-zinc-200 px-6 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4 lg:px-10">
          {workflow.map((item) => (
            <article key={item.number} className="min-h-64 p-7 first:pl-0 sm:first:pl-7 lg:first:pl-0">
              <span className="font-mono text-xs text-zinc-400">{item.number}</span>
              <h2 className="mt-12 text-2xl font-semibold tracking-tight">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-500">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.65fr_1.35fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Workspace map</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">The system we&apos;re building</h2>
          </div>
          <div className="border-t border-zinc-300">
            {modules.map(([title, copy]) => (
              <div key={title} className="grid gap-2 border-b border-zinc-300 py-6 sm:grid-cols-[0.7fr_1.3fr]">
                <h3 className="font-medium">{title}</h3>
                <p className="text-sm leading-6 text-zinc-500">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
