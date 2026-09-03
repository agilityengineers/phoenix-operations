// Line-icon set traced from the design files (24×24 viewBox, 1.6 stroke).

type IconProps = { size?: number };

function Svg({ size = 34, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* Frustration selector icons */
export const CompassIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="15.5,8.5 13.5,13.5 8.5,15.5 10.5,10.5" fill="currentColor" stroke="none" />
  </Svg>
);

export const ProfitIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="13" width="3" height="7" />
    <rect x="10" y="9" width="3" height="11" />
    <rect x="16" y="5" width="3" height="15" />
    <path d="M4 8 L14 3" />
    <path d="M14 3 l-3.5 0.5 M14 3 l-0.5 3.5" />
  </Svg>
);

export const PeopleIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19 c0-3 2.5-5 5.5-5 s5.5 2 5.5 5" />
    <circle cx="16.5" cy="9" r="2.4" />
    <path d="M16 14.2 c2.8 0.2 4.5 2 4.5 4.4" />
  </Svg>
);

export const CeilingIcon = ({ size = 34, accent }: IconProps & { accent?: boolean }) => (
  <Svg size={size}>
    <path d="M3 20 L10 8 L14 14 L17 9 L21 20 Z" />
    <path d="M17 9 V4" />
    <path d="M17 4 h4 l-1.5 1.5 L21 7 h-4" fill={accent ? "#D96C2C" : "currentColor"} stroke="none" />
  </Svg>
);

export const RepeatIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 12 a8 8 0 1 1-2.3-5.6" />
    <path d="M20 3 v4 h-4" />
  </Svg>
);

/* Who We Help trait icons */
export const FounderIcon = (p: IconProps) => (
  <Svg size={p.size ?? 38}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5 c0-4 3.3-6.5 7.5-6.5 s7.5 2.5 7.5 6.5" />
  </Svg>
);

export const GrowthIcon = (p: IconProps) => (
  <Svg size={p.size ?? 38}>
    <circle cx="7.5" cy="7" r="2.5" />
    <circle cx="12" cy="5.5" r="2.5" />
    <circle cx="16.5" cy="7" r="2.5" />
    <path d="M3 19 c0-3.5 2-5.5 4.5-5.5 M9 18 c0-3 1.3-4.8 3-4.8 s3 1.8 3 4.8 M16.5 13.5 c2.5 0 4.5 2 4.5 5.5" />
  </Svg>
);

export const ResultsIcon = (p: IconProps) => (
  <Svg size={p.size ?? 38}>
    <rect x="5" y="14" width="2.6" height="6" />
    <rect x="10" y="11" width="2.6" height="9" />
    <rect x="15" y="8" width="2.6" height="12" />
    <path d="M5 9 C10 8 14 6 19 3" stroke="#D96C2C" />
    <path d="M19 3 l-3.6 0.4 M19 3 l-0.6 3.6" stroke="#D96C2C" />
  </Svg>
);

export const PracticalIcon = (p: IconProps) => (
  <Svg size={p.size ?? 38}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="12,6.5 14.2,12 12,17.5 9.8,12" fill="#D96C2C" stroke="none" />
  </Svg>
);

/* How-it-works step icons */
export const CalendarCheckIcon = (p: IconProps) => (
  <Svg size={p.size ?? 30}>
    <rect x="4" y="5" width="16" height="16" rx="2" />
    <path d="M8 3 v4 M16 3 v4 M4 10 h16" />
    <path d="M9.5 15 l2 2 3.5-4" stroke="#D96C2C" />
  </Svg>
);

export const ChatIcon = (p: IconProps) => (
  <Svg size={p.size ?? 30}>
    <path d="M21 12 a8 7 0 0 1-8 7 c-1.2 0-2.3-0.2-3.3-0.6 L5 20 l1.2-3.4 A7 7 0 0 1 5 12 a8 7 0 0 1 8-7 a8 7 0 0 1 8 7 Z" />
    <circle cx="9.5" cy="12" r="0.8" fill="#D96C2C" stroke="none" />
    <circle cx="13" cy="12" r="0.8" fill="#D96C2C" stroke="none" />
    <circle cx="16.5" cy="12" r="0.8" fill="#D96C2C" stroke="none" />
  </Svg>
);

export const IdeaIcon = (p: IconProps) => (
  <Svg size={p.size ?? 30}>
    <path d="M9 18 h6 M10 21 h4" />
    <path d="M12 3 a6 6 0 0 1 3.5 10.8 c-0.8 0.7-1 1.4-1 2.2 h-5 c0-0.8-0.2-1.5-1-2.2 A6 6 0 0 1 12 3 Z" />
  </Svg>
);

export const ShieldIcon = (p: IconProps) => (
  <Svg size={p.size ?? 40}>
    <path d="M12 3 l7 2.5 v5.5 c0 4.5-3 8-7 10 c-4-2-7-5.5-7-10 V5.5 Z" />
    <path d="M9 12 l2 2 4-4.5" stroke="#D96C2C" />
  </Svg>
);

/* Guide experience pillar icons */
export const BuildingIcon = (p: IconProps) => (
  <Svg size={p.size ?? 40}>
    <path d="M3 21 h18 M5 21 V7 l7-4 7 4 v14 M9 21 v-4 h6 v4" />
    <path d="M9 10 h.01 M12 10 h.01 M15 10 h.01 M9 13 h.01 M12 13 h.01 M15 13 h.01" />
  </Svg>
);

export const GearIcon = (p: IconProps) => (
  <Svg size={p.size ?? 40}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2 v3 M12 19 v3 M2 12 h3 M19 12 h3 M4.9 4.9 l2.1 2.1 M17 17 l2.1 2.1 M19.1 4.9 L17 7 M7 17 l-2.1 2.1" />
  </Svg>
);
