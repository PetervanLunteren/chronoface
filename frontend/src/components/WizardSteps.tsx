interface Step {
  number: number;
  title: string;
}

interface WizardStepsProps {
  currentStep: number;
  steps: Step[];
}

function WizardSteps({ currentStep, steps }: WizardStepsProps) {
  return (
    <div className="mb-8 border-b border-slate-800 pb-6">
      <div className="mx-auto max-w-4xl">
        <div className="relative flex items-center">
          {/* Connecting line */}
          <div className="absolute left-6 right-6 top-6 h-0.5 bg-slate-800 z-0" />

          {/* Steps */}
          <div className="relative z-10 flex w-full justify-between items-start">
            {steps.map((step, index) => {
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              const isFirst = index === 0;
              const isMiddle = index === 1;

              return (
                <div
                  key={step.number}
                  className="flex flex-col items-center"
                >
                  <div
                    className={`mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 font-semibold transition-colors ${
                      isCompleted
                        ? "border-slate-600 bg-slate-800 text-slate-400"
                        : isActive
                        ? "border-primary bg-primary text-white"
                        : "border-slate-700 bg-slate-900 text-slate-500"
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.number
                    )}
                  </div>
                  <div className="text-center">
                    <div
                      className={`text-sm font-semibold ${
                        isActive ? "text-white" : isCompleted ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {step.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WizardSteps;
