interface FolderPickerProps {
  value: string;
  onChange: (value: string) => void;
}

function FolderPicker({ value, onChange }: FolderPickerProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-300">Photo folder</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="/path/to/photos"
        className="w-full rounded border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      <p className="text-xs text-slate-500">
        Enter an absolute path on your machine. Chronoface never uploads your files.
      </p>
    </div>
  );
}

export default FolderPicker;
