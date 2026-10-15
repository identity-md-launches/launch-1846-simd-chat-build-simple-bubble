export type IconName =
  | "arrow"
  | "plus"
  | "minus"
  | "close"
  | "search"
  | "filter"
  | "refresh"
  | "download"
  | "expand"
  | "help"
  | "network"
  | "wallet"
  | "token"
  | "chevron"
  | "check"
  | "copy"
  | "external"
  | "clock"
  | "settings"
  | "info";
const paths: Record<IconName, React.ReactNode> = {
  arrow: (
    <>
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  filter: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="var(--surface)" />
      <circle cx="15" cy="17" r="2" fill="var(--surface)" />
    </>
  ),
  refresh: (
    <>
      <path d="M19 8a8 8 0 1 0 1 7M19 3v5h-5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" />
    </>
  ),
  expand: <path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9a2.8 2.8 0 1 1 4 2.5c-1.2.6-1.3 1-1.3 2M12 17h.01" />
    </>
  ),
  network: (
    <>
      <path d="m7 6 10 3-5 9-5-12" />
      <circle cx="7" cy="6" r="3" fill="var(--icon-bg, currentColor)" />
      <circle cx="17" cy="9" r="3" fill="var(--icon-bg, currentColor)" />
      <circle cx="12" cy="18" r="3" fill="var(--icon-bg, currentColor)" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 8H5a2 2 0 0 1 0-4h13v4M4 6v13a1 1 0 0 0 1 1h15V8m0 4h-5v4h5" />
      <path d="M17 14h.01" />
    </>
  ),
  token: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="m4 7.5 8 5 8-5m-8 5V21" />
    </>
  ),
  chevron: <path d="m8 10 4 4 4-4" />,
  check: <path d="m5 12 4 4L19 6" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V4H4v12h4" />
    </>
  ),
  external: <path d="M14 4h6v6m0-6L10 14m0-10H4v16h16v-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  settings: (
    <>
      <path d="M5 5h14v14H5zM9 5v14M9 10h10" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10h.01" />
    </>
  ),
};
export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
