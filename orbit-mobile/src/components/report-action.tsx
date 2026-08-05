import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ReportSheet } from "@/components/report-sheet";
import { reportEntityLabel } from "@/lib/report-entities";
import { useAuth } from "@/providers/auth-provider";
import { colors } from "@/lib/theme";

/**
 * The overflow button that opens a report sheet, for surfaces whose only
 * overflow action is reporting. Surfaces that already have a menu should add
 * a report row to it instead of stacking a second button beside it.
 *
 * Renders nothing when the viewer owns the content: there is no reason to
 * report yourself, and an inert button invites the tap anyway.
 */
export function ReportAction({
  entityType,
  entityId,
  reportedUserId,
  size = 22,
  color = colors.foreground,
  style,
}: {
  entityType: string;
  entityId: string;
  /** Author of the reported thing. Omitted for content with no single author. */
  reportedUserId?: string;
  size?: number;
  color?: string;
  style?: React.ComponentProps<typeof View>["style"];
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user || (reportedUserId && reportedUserId === user.id)) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Report this ${reportEntityLabel(entityType)}`}
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={({ pressed }) => [
          styles.button,
          style,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Ionicons name="ellipsis-horizontal" size={size} color={color} />
      </Pressable>
      {open ? (
        <ReportSheet
          visible
          onClose={() => setOpen(false)}
          entityType={entityType}
          entityId={entityId}
          reportedUserId={reportedUserId}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
});
