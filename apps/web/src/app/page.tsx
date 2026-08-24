const workflow = [
  { number: "01", title: "Track", copy: "Creators, posts, deliverables, and performance in one system.", state: "Foundation" },
  { number: "02", title: "Understand", copy: "Transcripts, hooks, scenes, and patterns from every reference.", state: "Next" },
  { number: "03", title: "Adapt", copy: "Winning ideas rewritten around Result's voice and audience.", state: "Planned" },
  { number: "04", title: "Ship", copy: "Briefs, assignments, approvals, and Discord coordination.", state: "Connected" },
];

const modules = [
  ["Content tracking", "Capture posts and maintain an accurate performance history."],
  ["Reference intelligence", "Convert links into transcripts and structured creative analysis."],
  ["Brief workspace", "Turn useful patterns into brand-aware production briefs."],
  ["Creator operations", "Move assignments and approvals through Discord without losing context."],
];

function Arrow() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-none stroke-current stroke-[1.5]">
      <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" />
    </svg>
  );
}

function StatusDot({ active = false }: { active?: boolean }) {
  return <span className={`size-1.5 rounded-full ${active ? "bg-[#85ed75] shadow-[0_0_10px_#85ed75]" : "bg-white/30"}`} />;
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#101010] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_68%_-15%,rgba(133,237,117,0.12),transparent_48%)]" />

      <nav className="relative mx-auto mt-4 flex max-w-7xl items-center justify-between border border-white/10 bg-[#161616]/90 px-4 py-3 backdrop-blur-xl sm:mt-6 sm:rounded-2xl sm:px-5">
        <a href="#" className="font-result text-lg tracking-[0.04em]">RESULT</a>
        <div className="hidden items-center gap-7 text-xs text-white/55 md:flex">
          <a href="#system" className="transition-colors hover:text-white">System</a>
          <a href="#workflow" className="transition-colors hover:text-white">Workflow</a>
          <a href="#infrastructure" className="transition-colors hover:text-white">Infrastructure</a>
        </div>
        <button className="flex items-center gap-2 rounded-full bg-[#85ed75] px-4 py-2 text-xs font-semibold text-[#101010] transition-transform hover:-translate-y-0.5">
          Open workspace <Arrow />
        </button>
      </nav>

      <section className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-24 lg:grid-cols-[1.35fr_0.65fr] lg:px-0 lg:pb-32 lg:pt-32">
        <div>
          <div className="mb-7 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#85ed75]">
            <StatusDot active /> Internal system online
          </div>
          <h1 className="max-w-5xl text-[clamp(3.4rem,7vw,7rem)] font-normal leading-[0.92] tracking-[-0.065em]">
            Every creative signal. <span className="text-white/35">One operating system.</span>
          </h1>
          <p className="mt-8 max-w-xl text-base leading-7 text-white/55 sm:text-lg">
            Result UGC brings tracking, video intelligence, briefs, and creator operations into one command center for the whole team.
          </p>
        </div>

        <aside id="infrastructure" className="self-end border-t border-white/15 pt-5">
          <div className="mb-6 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">Infrastructure</p>
            <span className="text-[10px] text-white/30">24 AUG 2026</span>
          </div>
          {[
            ["Web dashboard", "Vercel", true],
            ["Discord worker", "Hetzner", true],
            ["Social data", "Provider adapter", false],
          ].map(([label, detail, active]) => (
            <div key={String(label)} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/10 py-4">
              <StatusDot active={Boolean(active)} />
              <div>
                <p className="text-sm">{label}</p>
                <p className="mt-0.5 text-xs text-white/35">{detail}</p>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/35">{active ? "Ready" : "Next"}</span>
            </div>
          ))}
        </aside>
      </section>

      <section id="workflow" className="border-y border-white/10 bg-[#0e0e0e]">
        <div className="mx-auto grid max-w-7xl sm:grid-cols-2 lg:grid-cols-4">
          {workflow.map((item) => (
            <article key={item.number} className="group min-h-72 border-b border-white/10 p-6 transition-colors hover:bg-[#161616] sm:border-r lg:border-b-0 lg:p-8">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">
                <span>{item.number}</span>
                <span>{item.state}</span>
              </div>
              <h2 className="mt-20 text-2xl font-normal tracking-[-0.035em]">{item.title}</h2>
              <p className="mt-3 max-w-xs text-sm leading-6 text-white/40 transition-colors group-hover:text-white/60">{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="system" className="mx-auto max-w-7xl px-6 py-24 lg:px-0 lg:py-32">
        <div className="grid gap-16 lg:grid-cols-[0.65fr_1.35fr]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85ed75]">System map</p>
            <h2 className="mt-5 max-w-sm text-4xl font-normal leading-[1.05] tracking-[-0.05em] sm:text-5xl">Built to turn inputs into output.</h2>
          </div>
          <div className="border-t border-white/15">
            {modules.map(([title, copy], index) => (
              <div key={title} className="group grid gap-4 border-b border-white/10 py-6 sm:grid-cols-[3rem_0.7fr_1.3fr] sm:items-start">
                <span className="font-mono text-[10px] text-white/25">0{index + 1}</span>
                <h3 className="text-sm text-white/90">{title}</h3>
                <p className="max-w-md text-sm leading-6 text-white/40 transition-colors group-hover:text-white/60">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#0e0e0e]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-0">
          <span className="font-result text-xl tracking-[0.04em] text-white/80">RESULT UGC</span>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/25">Track · Understand · Adapt · Ship</p>
        </div>
      </footer>
    </main>
  );
}
