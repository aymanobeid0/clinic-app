export function Icon({ name }: { name: "dashboard" | "settings" | "patients" }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "dashboard" ? (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      ) : name === "patients" ? (
        <>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
          <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.9 2.6 2.6 3 5.2" />
        </>
      ) : (
        <>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="8" cy="6" r="2" fill="var(--color-surface)" />
          <circle cx="16" cy="12" r="2" fill="var(--color-surface)" />
          <circle cx="10" cy="18" r="2" fill="var(--color-surface)" />
        </>
      )}
    </svg>
  );
}
