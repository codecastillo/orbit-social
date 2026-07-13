import { O, aurora } from "@/lib/design/orbit";

export function DMBubble({
  outgoing,
  children,
  time,
}: {
  outgoing: boolean;
  children: React.ReactNode;
  time?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: outgoing ? "flex-end" : "flex-start",
        gap: 4,
        maxWidth: "68%",
        alignSelf: outgoing ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderRadius: outgoing ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
          background: outgoing ? aurora : O.glass2,
          border: outgoing ? "none" : `1px solid ${O.hair}`,
          color: outgoing ? "white" : O.ink,
          fontSize: 14,
          lineHeight: 1.45,
          wordBreak: "break-word",
          boxShadow: outgoing
            ? `0 6px 18px color-mix(in oklab, ${O.a2} 20%, transparent)`
            : "none",
        }}
      >
        {children}
      </div>
      {time && (
        <div
          style={{
            fontSize: 10.5,
            color: O.ink4,
            fontFamily: O.mono,
            letterSpacing: "0.04em",
          }}
        >
          {time}
        </div>
      )}
    </div>
  );
}
