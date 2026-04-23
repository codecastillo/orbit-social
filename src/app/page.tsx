import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/utils/constants";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />

      <div className="relative z-10 text-center space-y-8 max-w-2xl">
        <div className="space-y-4">
          <h1 className="text-6xl sm:text-7xl font-bold tracking-tight">
            <span className="text-gradient">{APP_NAME}</span>
          </h1>
          <p className="text-xl sm:text-2xl text-muted-foreground leading-relaxed">
            Connect with friends. Share your moments.
            <br />
            Discover what&apos;s happening right now.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <Button size="lg" className="text-base px-8 w-full">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="text-base px-8 w-full">
              Sign In
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-center gap-8 text-muted-foreground text-sm pt-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">Feed</div>
            <div>Posts & Stories</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">Reels</div>
            <div>Short Videos</div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">Live</div>
            <div>Streaming</div>
          </div>
        </div>
      </div>
    </div>
  );
}
