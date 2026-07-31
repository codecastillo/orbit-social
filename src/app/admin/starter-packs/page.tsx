"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Plus,
  Search,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { searchUsers } from "@/lib/queries/social";
import {
  addPackMember,
  createStarterPack,
  deleteStarterPack,
  getAllStarterPacks,
  removePackMember,
  reorderPackMembers,
  reorderStarterPacks,
  updateStarterPack,
  type StarterPack,
} from "@/lib/queries/starter-packs";

const PACKS_KEY = ["admin-starter-packs"];

export default function AdminStarterPacksPage() {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: packs, isLoading, isError, refetch } = useQuery({
    queryKey: PACKS_KEY,
    queryFn: getAllStarterPacks,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: PACKS_KEY });

  const createMutation = useMutation({
    mutationFn: () =>
      createStarterPack({
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        sort_order: packs?.length ?? 0,
      }),
    onSuccess: () => {
      setNewTitle("");
      setNewDescription("");
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStarterPack,
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: reorderStarterPacks,
    onSuccess: invalidate,
  });

  const movePack = (index: number, direction: -1 | 1) => {
    if (!packs) return;
    const ids = packs.map((p) => p.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Starter Packs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Curated follow bundles shown at the end of onboarding
        </p>
      </div>

      {/* Create */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">New pack</h2>
        <div className="mt-3 space-y-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Pack title, e.g. Photography favorites"
          />
          <Textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Short description shown on the pack card"
            rows={2}
          />
          <Button
            size="sm"
            disabled={!newTitle.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <Plus className="h-3.5 w-3.5" />
            Create pack
          </Button>
        </div>
      </div>

      {/* Pack list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          Couldn&apos;t load starter packs.{" "}
          <button
            onClick={() => refetch()}
            className="cursor-pointer font-semibold text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      ) : packs && packs.length > 0 ? (
        <div className="space-y-3">
          {packs.map((pack, idx) => (
            <PackCard
              key={pack.id}
              pack={pack}
              expanded={expandedId === pack.id}
              onToggle={() =>
                setExpandedId(expandedId === pack.id ? null : pack.id)
              }
              onDelete={() => deleteMutation.mutate(pack.id)}
              onMoveUp={() => movePack(idx, -1)}
              onMoveDown={() => movePack(idx, 1)}
              canMoveUp={idx > 0}
              canMoveDown={idx < packs.length - 1}
              onChanged={invalidate}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={UsersRound}
          title="No starter packs yet"
          description="Create the first pack so new users get follow suggestions during onboarding."
        />
      )}
    </div>
  );
}

function PackCard({
  pack,
  expanded,
  onToggle,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onChanged,
}: {
  pack: StarterPack;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(pack.title);
  const [description, setDescription] = useState(pack.description ?? "");

  const updateMutation = useMutation({
    mutationFn: (updates: Parameters<typeof updateStarterPack>[1]) =>
      updateStarterPack(pack.id, updates),
    onSuccess: onChanged,
  });

  const detailsDirty =
    title.trim() !== pack.title || description.trim() !== (pack.description ?? "");

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <div className="flex items-center gap-3 bg-card p-3">
        <div className="flex flex-col">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            aria-label="Move pack up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            aria-label="Move pack down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{pack.title}</span>
              {!pack.is_active && (
                <Badge variant="outline" className="text-[10px]">
                  Hidden
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {pack.members.length}{" "}
              {pack.members.length === 1 ? "member" : "members"}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={pack.is_active}
            disabled={updateMutation.isPending}
            onCheckedChange={(checked) =>
              updateMutation.mutate({ is_active: checked })
            }
            aria-label="Pack visible in onboarding"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            aria-label="Delete pack"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-foreground/5 bg-card p-4">
          <div className="space-y-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Pack title"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={2}
            />
            {detailsDirty && (
              <Button
                size="sm"
                disabled={!title.trim() || updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    title: title.trim(),
                    description: description.trim() || null,
                  })
                }
              >
                Save details
              </Button>
            )}
          </div>

          <PackMembers pack={pack} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

function PackMembers({
  pack,
  onChanged,
}: {
  pack: StarterPack;
  onChanged: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: results } = useQuery({
    queryKey: ["admin-pack-user-search", debouncedQuery],
    queryFn: () => searchUsers(debouncedQuery, 8),
    enabled: debouncedQuery.trim().length > 0,
  });

  const addMutation = useMutation({
    mutationFn: (userId: string) =>
      addPackMember(pack.id, userId, pack.members.length),
    onSuccess: () => {
      setSearchQuery("");
      onChanged();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removePackMember(pack.id, userId),
    onSuccess: onChanged,
  });

  const reorderMutation = useMutation({
    mutationFn: (userIds: string[]) => reorderPackMembers(pack.id, userIds),
    onSuccess: onChanged,
  });

  const moveMember = (index: number, direction: -1 | 1) => {
    const ids = pack.members.map((m) => m.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  };

  const memberIds = new Set(pack.members.map((m) => m.id));
  const candidates = (results ?? []).filter((u) => !memberIds.has(u.id));

  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Members
      </h3>

      <div className="relative mt-2">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users to add..."
          className="pl-9"
        />
      </div>

      {candidates.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-lg ring-1 ring-foreground/10">
          {candidates.map((u, idx) => (
            <div
              key={u.id}
              className={cn(
                "flex items-center gap-3 bg-surface p-2.5",
                idx !== 0 && "border-t border-foreground/5",
              )}
            >
              <UserAvatar src={u.avatar_url} fallback={u.display_name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {u.display_name}
                </div>
                <div className="text-xs text-muted-foreground">@{u.username}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={addMutation.isPending}
                onClick={() => addMutation.mutate(u.id)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          ))}
        </div>
      )}

      {pack.members.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-lg ring-1 ring-foreground/10">
          {pack.members.map((m, idx) => (
            <div
              key={m.id}
              className={cn(
                "flex items-center gap-3 bg-surface p-2.5",
                idx !== 0 && "border-t border-foreground/5",
              )}
            >
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={idx === 0 || reorderMutation.isPending}
                  onClick={() => moveMember(idx, -1)}
                  aria-label="Move member up"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={
                    idx === pack.members.length - 1 || reorderMutation.isPending
                  }
                  onClick={() => moveMember(idx, 1)}
                  aria-label="Move member down"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              <UserAvatar src={m.avatar_url} fallback={m.display_name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {m.display_name}
                </div>
                <div className="text-xs text-muted-foreground">@{m.username}</div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(m.id)}
                aria-label="Remove member"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          No members yet. Search above to add people.
        </p>
      )}
    </div>
  );
}
