import packageJson from "../../package.json";

function About() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">About Chronoface</h1>
      <p className="text-slate-300">
        Chronoface runs entirely on your computer. It never uploads photos or metadata and performs
        all face detection and clustering on the CPU using open source models.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          <h2 className="text-lg font-semibold text-white">Version</h2>
          <p>Frontend {packageJson.version}</p>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
          <h2 className="text-lg font-semibold text-white">License</h2>
          <p>MIT License. Models distributed under Apache-2.0 (YuNet, SFace).</p>
        </div>
      </div>
      <div className="rounded border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-white">Privacy</h2>
        <p>
          Chronoface reads only the folders you explicitly choose. Outputs are written to the
          <code className="mx-1 rounded bg-slate-800 px-1">output</code> directory and static assets
          served from <code className="mx-1 rounded bg-slate-800 px-1">output/static</code>.
        </p>
      </div>
      <div className="rounded border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-white">Third-party notices</h2>
        <p>
          YuNet and SFace models are © OpenCV Team, Apache License 2.0. See
          <code className="mx-1 rounded bg-slate-800 px-1">backend/models/THIRD_PARTY_NOTICES.md</code>
          for details.
        </p>
      </div>
    </section>
  );
}

export default About;
