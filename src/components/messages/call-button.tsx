"use client";

import { Phone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CallButtonProps {
  onVoiceCall: () => void;
  onVideoCall: () => void;
}

export function CallButton({ onVoiceCall, onVideoCall }: CallButtonProps) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        onClick={onVoiceCall}
        className="h-9 w-9 rounded-full hover:bg-white/[0.06] transition-colors"
        title="Voice call"
      >
        <Phone className="h-4 w-4 text-muted-foreground" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onVideoCall}
        className="h-9 w-9 rounded-full hover:bg-white/[0.06] transition-colors"
        title="Video call"
      >
        <Video className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}
