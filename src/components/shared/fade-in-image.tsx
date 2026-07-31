"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

/**
 * next/image that reveals with a short fade once decoded, so media appears
 * as part of its card instead of popping into an already-rendered box.
 * The container must reserve space (fill inside an aspect box, or fixed
 * width/height) exactly like a plain next/image.
 */
export function FadeInImage({ className, onLoad, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    // eslint-disable-next-line jsx-a11y/alt-text -- alt is required by ImageProps and arrives via the spread
    <Image
      {...props}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      className={cn(
        "transition-opacity duration-300",
        loaded ? "opacity-100" : "opacity-0",
        className
      )}
    />
  );
}
