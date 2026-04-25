import { O } from "@/lib/design/orbit";

export function OnlineIndicator({
  size = 10,
  position = "bottom-right",
}: {
  size?: number;
  position?: "bottom-right" | "top-right";
}) {
  return (
    <span
      aria-label="online"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#7dffa3",
        border: `2.5px solid ${O.bg2}`,
        boxShadow: "0 0 10px rgba(125,255,163,0.7)",
        bottom: position === "bottom-right" ? 0 : undefined,
        top: position === "top-right" ? 0 : undefined,
        right: 0,
      }}
    />
  );
}
