import { MOCK_PERMISSIONS } from '@/lib/mockData';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-1 flex items-center gap-2" style={{ animation: 'fadeUp 0.7s ease both' }}>
        <p className="numeric text-[11px] uppercase tracking-[0.24em] text-ink-faint">Settings</p>
        <span className="numeric rounded-full border border-line px-2 py-0.5 text-[9px] tracking-[0.14em] text-ink-faint">
          PREVIEW
        </span>
      </div>
      <p className="mb-6 text-xs text-ink-faint">
        Sample permissions — real session-key scope arrives with F4. Read-only, always.
      </p>

      <ul className="space-y-3" style={{ animation: 'fadeUp 0.7s ease both 0.12s' }}>
        {MOCK_PERMISSIONS.map((p) => (
          <li key={p.sentence} className="rounded-2xl border border-line bg-surface/75 p-5 backdrop-blur-xl">
            <p className="text-sm text-ink">{p.sentence}</p>
            {p.expiresIn && <p className="numeric mt-1.5 text-xs text-ink-faint">{p.expiresIn}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
