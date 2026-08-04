import { Alert } from "react-native";
import type { WhoCanComment } from "@/lib/queries/posts";

// "People you follow" is the author's side of the follow graph: only
// accounts the author follows may reply.
export const WHO_CAN_COMMENT_OPTIONS: {
  value: WhoCanComment;
  label: string;
}[] = [
  { value: "everyone", label: "Everyone" },
  { value: "following", label: "People you follow" },
  { value: "nobody", label: "No one" },
];

/** Composer chip copy; "everyone" is the default and shows no chip. */
export const WHO_CAN_COMMENT_SUMMARY: Record<WhoCanComment, string> = {
  everyone: "Everyone can comment",
  following: "Only people you follow can comment",
  nobody: "Comments turned off",
};

/**
 * Native chooser for the setting, shared by the composer toolbar and the
 * author's post menu so both offer the same three choices.
 */
export function promptWhoCanComment(
  current: WhoCanComment,
  onSelect: (value: WhoCanComment) => void,
) {
  Alert.alert("Who can comment", undefined, [
    ...WHO_CAN_COMMENT_OPTIONS.filter((option) => option.value !== current).map(
      (option) => ({
        text: option.label,
        onPress: () => onSelect(option.value),
      }),
    ),
    { text: "Cancel", style: "cancel" as const },
  ]);
}
