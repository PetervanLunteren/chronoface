import { Link } from "react-router-dom";

function Home() {
  return (
    <section className="space-y-6">
      <h1 className="text-4xl font-bold text-white">Chronoface</h1>
      <p className="max-w-2xl text-slate-300">
        Chronoface groups the faces across your photo library into friendly time buckets. Run the
        scanner locally, review detections, and export printable collages in minutes — all without
        leaving your machine.
      </p>
      <div className="flex gap-3">
        <Link className="rounded bg-primary px-4 py-2 text-white" to="/scan">
          Start a scan
        </Link>
        <Link className="rounded border border-slate-700 px-4 py-2" to="/about">
          Learn more
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {["Scan photos", "Review faces", "Export collages", "Stay private"].map((feature) => (
          <div key={feature} className="rounded border border-slate-800 bg-slate-900/70 p-4">
            <h3 className="text-lg font-semibold text-slate-100">{feature}</h3>
            <p className="text-sm text-slate-400">
              {feature === "Scan photos"
                ? "Walk any folder recursively, read EXIF timestamps, and prepare thumbnails."
                : feature === "Review faces"
                  ? "Accept, reject, merge, and split clusters with instant feedback."
                  : feature === "Export collages"
                    ? "Render dense grids for each bucket with custom layouts."
                    : "Chronoface never uploads your photos or metadata."}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Home;
