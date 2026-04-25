import { O } from "@/lib/design/orbit";

export function HashtagPill({ tag }: { tag: string }) {
  const clean = tag.startsWith("#") ? tag.slice(1) : tag;
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 99,
        fontSize: 10.5,
        fontWeight: 600,
        background: O.glass,
        border: `1px solid ${O.hair}`,
        color: O.ink2,
        fontFamily: O.mono,
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      #{clean}
    </span>
  );
}
