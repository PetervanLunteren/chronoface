import Scan from "./routes/Scan";
import Review from "./routes/Review";
import Configure from "./routes/Configure";
import Arrange from "./routes/Arrange";
import Collage from "./routes/Collage";
import WizardSteps from "./components/WizardSteps";
import Toasts from "./components/Toasts";
import { useRunStore } from "./state/useRunStore";

const STEPS = [
  { number: 1, title: "Upload" },
  { number: 2, title: "Select" },
  { number: 3, title: "Configure" },
  { number: 4, title: "Arrange" },
  { number: 5, title: "Create" },
];

function App() {
  const currentStep = useRunStore((state) => state.currentStep);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Chronoface" className="h-10 w-10" />
            <div className="text-3xl font-semibold" style={{
              background: 'linear-gradient(to right, #05a4ff, #0069ca)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Chronoface
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <WizardSteps currentStep={currentStep} steps={STEPS} />

        {currentStep === 1 && <Scan />}
        {currentStep === 2 && <Review />}
        {currentStep === 3 && <Configure />}
        {currentStep === 4 && <Arrange />}
        {currentStep === 5 && <Collage />}
      </main>
      <Toasts />
    </div>
  );
}

export default App;
