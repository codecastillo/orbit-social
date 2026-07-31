import { Text } from "react-native";
import { Centered } from "@/components/ui";
import { colors } from "@/lib/theme";

export default function Placeholder() {
  return (
    <Centered>
      <Text style={{ color: colors.mutedForeground }}>Coming together.</Text>
    </Centered>
  );
}
