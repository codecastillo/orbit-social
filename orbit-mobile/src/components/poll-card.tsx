import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatNumber } from "@/lib/format";
import { getUserPollVote, votePoll, type PollData } from "@/lib/queries/posts";
import { colors, radii, spacing } from "@/lib/theme";

interface PollCardProps {
  postId: string;
  pollData: PollData;
  currentUserId: string;
}

// Forward-looking counterpart of formatTimeAgo for the "Ends in X" line.
function formatTimeRemaining(iso: string): string {
  const seconds = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (seconds < 60) return "less than a minute";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Poll body for a post card: tap an option to vote, then the rows fill
 * with result bars. Mirrors the web PollDisplay: one vote per user (the
 * web never honors multi_select), results revealed after voting or when
 * the poll ends, and tallies read from the denormalized poll_data counts.
 */
export function PollCard({ postId, pollData: pollDataProp, currentUserId }: PollCardProps) {
  const queryClient = useQueryClient();
  const voteKey = ["poll-vote", currentUserId, postId];

  // The viewer's existing vote lives in poll_votes, same source the web
  // reads via loadUserPollVote.
  const { data: serverVote } = useQuery({
    queryKey: voteKey,
    queryFn: () => getUserPollVote(currentUserId, postId),
    staleTime: 60 * 1000,
  });

  // Optimistic local state seeded from the post row; the prop reference
  // only changes when a refetch delivers a fresh post, which reseeds.
  const [pollData, setPollData] = useState(pollDataProp);
  const [seed, setSeed] = useState(pollDataProp);
  if (seed !== pollDataProp) {
    setSeed(pollDataProp);
    setPollData(pollDataProp);
  }

  const [optimisticVote, setOptimisticVote] = useState<number | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  const userVote = optimisticVote ?? serverVote ?? null;
  const hasVoted = userVote !== null;
  const isEnded = pollData.ends_at ? new Date(pollData.ends_at) < new Date() : false;
  const showResults = hasVoted || isEnded;
  const totalVotes = pollData.options.reduce((sum, opt) => sum + opt.votes, 0);

  const handleVote = (optionIndex: number) => {
    if (hasVoted || isEnded || isVoting) return;

    setIsVoting(true);
    setVoteError(null);
    setOptimisticVote(optionIndex);
    setPollData((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) =>
        i === optionIndex ? { ...opt, votes: opt.votes + 1 } : opt,
      ),
    }));

    votePoll(currentUserId, postId, optionIndex)
      .then(() => {
        queryClient.setQueryData(voteKey, optionIndex);
      })
      .catch((err: unknown) => {
        setPollData((prev) => ({
          ...prev,
          options: prev.options.map((opt, i) =>
            i === optionIndex ? { ...opt, votes: Math.max(0, opt.votes - 1) } : opt,
          ),
        }));
        if (err instanceof Error && err.message === "Already voted") {
          // The server already holds a vote (stale cache); refetch it so
          // the card settles on the real pick instead of this tap.
          setOptimisticVote(null);
          queryClient.invalidateQueries({ queryKey: voteKey });
          setVoteError("You already voted on this poll.");
          return;
        }
        setOptimisticVote(null);
        setVoteError("Vote failed. Try again.");
      })
      .finally(() => setIsVoting(false));
  };

  return (
    <View style={styles.wrap}>
      {pollData.options.map((option, index) => {
        const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
        const isSelected = userVote === index;

        return (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={
              showResults
                ? `${option.text}, ${percentage} percent`
                : `Vote for ${option.text}`
            }
            disabled={showResults || isVoting}
            onPress={() => handleVote(index)}
            style={({ pressed }) => [
              styles.option,
              isSelected && styles.optionSelected,
              pressed && !showResults && { opacity: 0.7 },
            ]}
          >
            {showResults ? (
              <View
                style={[
                  styles.fill,
                  isSelected && styles.fillSelected,
                  { width: `${percentage}%` },
                ]}
              />
            ) : null}
            <View style={styles.optionRow}>
              <Text
                style={[styles.optionText, isSelected && styles.optionTextSelected]}
                numberOfLines={2}
              >
                {option.text}
              </Text>
              {showResults ? (
                <Text style={[styles.percent, isSelected && styles.percentSelected]}>
                  {percentage}%
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}

      <Text style={styles.footer}>
        {formatNumber(totalVotes)} {totalVotes === 1 ? "vote" : "votes"}
        {pollData.ends_at
          ? ` · ${isEnded ? "Final results" : `Ends in ${formatTimeRemaining(pollData.ends_at)}`}`
          : ""}
      </Text>

      {voteError ? <Text style={styles.errorText}>{voteError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing(2.5),
    gap: spacing(2),
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  optionSelected: {
    borderColor: colors.primary,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surfaceElevated,
  },
  fillSelected: {
    backgroundColor: "rgba(172, 119, 250, 0.18)",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(2),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  optionText: {
    color: colors.foreground,
    fontSize: 14,
    flexShrink: 1,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: "600",
  },
  percent: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  percentSelected: {
    color: colors.primary,
  },
  footer: {
    color: colors.mutedForeground,
    fontSize: 12.5,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 12,
  },
});
