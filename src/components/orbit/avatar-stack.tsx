import { O } from "@/lib/design/orbit";
import { UserAvatar } from "@/components/shared/user-avatar";

type AvatarUser = {
  id?: string;
  avatar_url?: string | null;
  display_name?: string | null;
  username?: string | null;
};

export function AvatarStack({
  users,
  size = 28,
  max = 5,
  plus,
}: {
  users: AvatarUser[];
  size?: number;
  max?: number;
  plus?: number;
}) {
  const shown = users.slice(0, max);
  const overflow = typeof plus === "number" ? plus : Math.max(users.length - max, 0);
  const sizeAsUserAvatar =
    size <= 24 ? "sm" : size <= 36 ? "md" : size <= 48 ? "lg" : "xl";

  return (
    <div style={{ display: "inline-flex", alignItems: "center" }}>
      {shown.map((u, i) => (
        <div
          key={u.id || i}
          style={{
            marginLeft: i === 0 ? 0 : -8,
            padding: 2,
            background: O.bg2,
            borderRadius: "50%",
            display: "inline-flex",
          }}
        >
          <UserAvatar
            src={u.avatar_url || undefined}
            fallback={u.display_name || u.username || "U"}
            size={sizeAsUserAvatar as "sm" | "md" | "lg" | "xl"}
          />
        </div>
      ))}
      {overflow > 0 && (
        <span
          style={{
            marginLeft: 8,
            fontFamily: O.mono,
            fontSize: 11,
            color: O.ink3,
            letterSpacing: "0.04em",
          }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
