"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Calendar,
  ChevronDown,
  ChevronUp,
  Shield,
  Lock,
  MoreHorizontal,
  Trash2,
  Camera,
  ImagePlus,
  Pencil,
  Link2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CommunityMembersDialog } from "@/components/communities/members-dialog";
import { ImageCropper } from "@/components/shared/image-cropper";
import { useAuth } from "@/lib/hooks/use-auth";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { createClient } from "@/lib/supabase/client";
import {
  joinCommunity,
  leaveCommunity,
  deleteCommunity,
  getMyJoinRequestStatus,
  updateCommunity,
  uploadCommunityImage,
  type Community,
  type CommunityMember,
} from "@/lib/queries/communities";

interface CommunityHeaderProps {
  community: Community;
  members: CommunityMember[];
  userRole: "owner" | "moderator" | "member" | null;
  onMembershipChange: () => void;
}

export function CommunityHeader({
  community,
  members,
  userRole,
  onMembershipChange,
}: CommunityHeaderProps) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [joining, setJoining] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [requestStatus, setRequestStatus] = useState<
    "pending" | "approved" | "rejected" | null
  >(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(community.name);
  const [editDescription, setEditDescription] = useState(
    community.description || "",
  );
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<"avatar" | "cover" | null>(
    null
  );
  const [pendingCrop, setPendingCrop] = useState<{
    kind: "avatar" | "cover";
    file: File;
  } | null>(null);
  const avatarFileRef = useRef<HTMLInputElement | null>(null);
  const coverFileRef = useRef<HTMLInputElement | null>(null);

  const handleFilePick =
    (kind: "avatar" | "cover") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be under 5MB");
        return;
      }
      setPendingCrop({ kind, file });
      if (e.target) e.target.value = "";
    };

  const handleCropComplete = async (blob: Blob) => {
    if (!pendingCrop || !user) return;
    const { kind } = pendingCrop;
    const cropped = new File([blob], `${kind}.jpg`, { type: "image/jpeg" });
    setUploadingKind(kind);
    try {
      const url = await uploadCommunityImage(
        user.id,
        community.id,
        kind,
        cropped
      );
      await updateCommunity(community.id, {
        [kind === "avatar" ? "avatarUrl" : "coverUrl"]: url,
      });
      toast.success(
        kind === "avatar" ? "Updated room avatar" : "Updated room cover"
      );
      queryClient.invalidateQueries({
        queryKey: ["community", community.slug],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      console.error("Community image upload failed:", err);
      toast.error(msg);
    } finally {
      setUploadingKind(null);
    }
  };

  // Treat the row's `created_by` as authoritative for ownership, handles
  // legacy / broken rooms where the owner membership row was never inserted
  // (so `userRole` is null even though the user actually created the room).
  const isCreator = !!user && user.id === community.created_by;
  const isMember = userRole !== null || isCreator;
  const isOwner = userRole === "owner" || isCreator;
  const policy = community.join_policy ?? "public";

  // Realtime: live member_count + roster updates.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`community-${community.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "communities",
          filter: `id=eq.${community.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["community", community.slug] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "community_members",
          filter: `community_id=eq.${community.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["community", community.slug] });
          queryClient.invalidateQueries({
            queryKey: ["community-members", community.id],
          });
          queryClient.invalidateQueries({
            queryKey: ["community-membership", community.id],
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [community.id, community.slug, queryClient]);

  // If the user has a pending request, show that state.
  useEffect(() => {
    if (!user || isMember || policy !== "approval") {
      setRequestStatus(null);
      return;
    }
    let cancelled = false;
    getMyJoinRequestStatus(community.id, user.id)
      .then((s) => {
        if (!cancelled) setRequestStatus(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, community.id, isMember, policy]);
  const rules = community.rules as
    | { title: string; description: string }[]
    | null;
  const createdDate = new Date(community.created_at).toLocaleDateString(
    "en-US",
    {
      month: "short",
      year: "numeric",
    }
  );

  const handleJoinToggle = async () => {
    if (!requireAuth() || !user) return;
    if (isOwner) {
      toast.error("You can't leave a community you own");
      return;
    }

    setJoining(true);
    try {
      if (isMember) {
        await leaveCommunity(community.id, user.id);
        toast.success(`Left ${community.name}`);
      } else {
        const result = await joinCommunity(community.id);
        if (result === "joined") {
          toast.success(`Joined ${community.name}`);
        } else if (result === "requested") {
          setRequestStatus("pending");
          toast.success("Request sent, waiting on approval");
        } else {
          toast.error("This room is invite-only");
        }
      }
      onMembershipChange();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setJoining(false);
    }
  };

  const buttonLabel = (() => {
    if (joining) return "...";
    if (isOwner) return "Owner";
    if (isMember) return "Leave";
    if (policy === "invite") return "Invite Only";
    if (policy === "approval") {
      if (requestStatus === "pending") return "Pending approval";
      return "Request to Join";
    }
    return "Join Community";
  })();

  const buttonDisabled =
    joining ||
    isOwner ||
    (!isMember &&
      (policy === "invite" || requestStatus === "pending"));

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCommunity(community.id);
      toast.success(`Deleted ${community.name}`);
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      setConfirmDelete(false);
      router.push("/communities");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't delete the room";
      console.error("Delete community failed:", err);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border-b border-border">
      {/* Cover image, locked to a 4:1 aspect so the visible region of the
          uploaded crop stays consistent across viewport widths. */}
      <div
        className="relative w-full overflow-hidden group"
        style={{ aspectRatio: "4 / 1", maxHeight: 280 }}
      >
        {community.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={community.cover_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/40 via-purple-500/30 to-pink-500/20" />
        )}
        {isOwner && (
          <>
            <input
              ref={coverFileRef}
              type="file"
              accept="image/*"
              onChange={handleFilePick("cover")}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => coverFileRef.current?.click()}
              disabled={uploadingKind !== null}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur px-3 py-1.5 text-xs text-white border border-white/15 hover:bg-black/80 transition-colors disabled:opacity-50"
              aria-label="Change cover"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {uploadingKind === "cover"
                ? "Uploading…"
                : community.cover_url
                  ? "Change cover"
                  : "Add cover"}
            </button>
          </>
        )}
      </div>

      {/* Community info */}
      <div className="px-4 pb-4">
        {/* Avatar overlapping cover */}
        <div className="-mt-8 mb-3 flex items-end justify-between">
          <div className="relative ring-4 ring-background rounded-full">
            {community.avatar_url ? (
              <UserAvatar
                src={community.avatar_url}
                fallback={community.name}
                size="xl"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/60 to-purple-500/60 flex items-center justify-center border-4 border-background">
                <span className="text-3xl font-bold text-white">
                  {community.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {isOwner && (
              <>
                <input
                  ref={avatarFileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFilePick("avatar")}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarFileRef.current?.click()}
                  disabled={uploadingKind !== null}
                  className="absolute bottom-1 right-1 inline-flex items-center justify-center h-7 w-7 rounded-full bg-black/70 backdrop-blur border border-white/15 text-white hover:bg-black/90 transition-colors disabled:opacity-50"
                  aria-label="Change avatar"
                  title={uploadingKind === "avatar" ? "Uploading…" : "Change avatar"}
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

          <div className="mt-10 flex items-center gap-2">
            <Button
              variant={isMember ? "outline" : "default"}
              onClick={handleJoinToggle}
              disabled={buttonDisabled}
            >
              {policy === "invite" && !isMember && !isOwner && (
                <Lock className="h-3.5 w-3.5" />
              )}
              {buttonLabel}
            </Button>
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Room options"
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background hover:bg-accent transition-colors"
                  )}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                  <DropdownMenuItem
                    className="cursor-pointer rounded-lg"
                    onClick={() => {
                      setEditName(community.name);
                      setEditDescription(community.description || "");
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer rounded-lg"
                    onClick={() => setMembersOpen(true)}
                  >
                    <UsersRound className="mr-2 h-4 w-4" />
                    Manage members
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer rounded-lg"
                    onClick={() => {
                      const url = `${window.location.origin}/communities/${community.slug || community.id}`;
                      void navigator.clipboard.writeText(url);
                      toast.success("Room link copied");
                    }}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Copy room link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    className="cursor-pointer rounded-lg"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete room
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <h1 className="text-xl font-bold">{community.name}</h1>

        {community.description && (
          <p className="text-muted-foreground mt-1 text-sm">
            {community.description}
          </p>
        )}

        {/* Created date sits directly under the description, on its own
            line, separate from the members-with-avatars row below. */}
        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>Created {createdDate}</span>
        </div>

        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            className="flex items-center gap-2 hover:text-foreground transition-colors"
            aria-label="See all members"
          >
            <div className="flex -space-x-2">
              {members.slice(0, 4).map((member) => (
                <div
                  key={member.user_id}
                  className="ring-2 ring-background rounded-full"
                  title={member.profiles.display_name || member.profiles.username}
                >
                  <UserAvatar
                    src={member.profiles.avatar_url}
                    fallback={member.profiles.display_name || member.profiles.username}
                    size="sm"
                  />
                </div>
              ))}
              {members.length === 0 && (
                <div className="h-8 w-8 rounded-full bg-muted/40 ring-2 ring-background flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
              {community.member_count > 4 && (
                <div className="h-8 w-8 rounded-full bg-muted/60 ring-2 ring-background flex items-center justify-center text-[10px] font-mono font-semibold text-foreground">
                  +{Math.max(community.member_count - 4, 0)}
                </div>
              )}
            </div>
            <span className="text-sm">
              {formatNumber(community.member_count)}{" "}
              {community.member_count === 1 ? "member" : "members"}
            </span>
          </button>
        </div>

        {/* Rules section */}
        {rules && rules.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setRulesOpen(!rulesOpen)}
              className={cn(
                "flex items-center gap-2 w-full text-sm font-medium",
                "text-muted-foreground hover:text-foreground transition-colors"
              )}
            >
              <Shield className="h-4 w-4" />
              <span>Community Rules ({rules.length})</span>
              {rulesOpen ? (
                <ChevronUp className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-auto" />
              )}
            </button>

            {rulesOpen && (
              <div className="mt-2 space-y-2">
                {rules.map((rule, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-muted/50 p-3 text-sm"
                  >
                    <p className="font-medium">
                      {i + 1}. {rule.title}
                    </p>
                    {rule.description && (
                      <p className="text-muted-foreground mt-0.5">
                        {rule.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CommunityMembersDialog
        open={membersOpen}
        onOpenChange={setMembersOpen}
        communityId={community.id}
        isOwner={isOwner}
        currentUserId={user?.id}
      />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this room?</DialogTitle>
            <DialogDescription>
              This permanently removes <strong>{community.name}</strong>, all
              of its members, and any pending join requests. Posts in this
              room will be detached but not deleted. You can&apos;t undo this.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit room details, owner-only quick edit for name + description.
          Avatar + cover have their own Change buttons on the header. */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit room</DialogTitle>
            <DialogDescription>
              Update the room name and description. Members will see the
              change immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <label className="text-xs text-muted-foreground">Name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={60}
              className="rounded-xl bg-white/[0.04] border border-white/[0.06] focus:border-white/20 focus:outline-none px-3 py-2 text-sm"
            />
            <label className="text-xs text-muted-foreground mt-2">
              Description
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              maxLength={300}
              rows={3}
              className="rounded-xl bg-white/[0.04] border border-white/[0.06] focus:border-white/20 focus:outline-none px-3 py-2 text-sm resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={savingEdit || !editName.trim()}
              onClick={async () => {
                setSavingEdit(true);
                try {
                  await updateCommunity(community.id, {
                    name: editName.trim(),
                    description: editDescription.trim(),
                  });
                  await queryClient.invalidateQueries({
                    queryKey: ["community", community.id],
                  });
                  await queryClient.invalidateQueries({
                    queryKey: ["communities"],
                  });
                  toast.success("Room updated");
                  setEditOpen(false);
                } catch (e) {
                  console.error("updateCommunity failed", e);
                  const msg = e instanceof Error ? e.message : "";
                  if (
                    msg.includes("communities_name_lower_unique") ||
                    /name.*already exists/i.test(msg)
                  ) {
                    toast.error(
                      "Another room already uses that name. Try a more specific variation.",
                    );
                  } else {
                    toast.error("Couldn't save changes");
                  }
                } finally {
                  setSavingEdit(false);
                }
              }}
            >
              {savingEdit ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageCropper
        open={!!pendingCrop}
        file={pendingCrop?.file ?? null}
        aspectRatio={pendingCrop?.kind === "cover" ? 4 : 1}
        circular={pendingCrop?.kind === "avatar"}
        outputWidth={pendingCrop?.kind === "cover" ? 1600 : 512}
        title={pendingCrop?.kind === "cover" ? "Crop cover" : "Crop avatar"}
        onClose={() => setPendingCrop(null)}
        onComplete={handleCropComplete}
      />
    </div>
  );
}
