import type { BucketSize } from "../api/types";

interface BucketSelectorProps {
  value: BucketSize;
  onChange: (value: BucketSize) => void;
}

const OPTIONS: { value: BucketSize; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" }
];

function BucketSelector({ value, onChange }: BucketSelectorProps) {
  return (
    <div className="flex w-full flex-wrap gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-4 py-2 text-sm transition-colors ${
            value === option.value
              ? "bg-primary text-white shadow"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default BucketSelector;
