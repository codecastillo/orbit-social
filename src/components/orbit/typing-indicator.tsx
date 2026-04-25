"use client";

import { O } from "@/lib/design/orbit";

export function TypingIndicator() {
  return (
    <>
      <style>{`@keyframes orbit-typing-bounce{0%,80%,100%{transform:translateY(0);opacity:0.4}40%{transform:translateY(-4px);opacity:1}}`}</style>
      <div
        style={{
          display: "inline-flex",
          gap: 4,
          padding: "10px 14px",
          borderRadius: "20px 20px 20px 6px",
          background: O.glass2,
          border: `1px solid ${O.hair}`,
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: O.ink3,
              animation: `orbit-typing-bounce 1.4s ${i * 0.2}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
    </>
  );
}
