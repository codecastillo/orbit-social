"use client";

import { useState, useRef } from "react";
import { ImagePlusIcon, XIcon, Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  createListing,
  uploadListingImage,
} from "@/lib/queries/marketplace";

const CATEGORIES = ["Electronics", "Clothing", "Home", "Sports", "Other"];
const CONDITIONS = ["New", "Like New", "Good", "Fair", "Poor"];

interface CreateListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateListingDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateListingDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [condition, setCondition] = useState(CONDITIONS[0]);
  const [location, setLocation] = useState("");

  function resetForm() {
    setTitle("");
    setDescription("");
    setPrice("");
    setCategory(CATEGORIES[0]);
    setCondition(CONDITIONS[0]);
    setLocation("");
    setImages([]);
    setPreviews([]);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - images.length;
    const toAdd = files.slice(0, remaining);

    setImages((prev) => [...prev, ...toAdd]);

    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !title.trim() || !price) return;

    setLoading(true);
    try {
      const imageUrls: string[] = [];
      for (const file of images) {
        const url = await uploadListingImage(user.id, file);
        imageUrls.push(url);
      }

      await createListing(user.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        price: parseFloat(price),
        category,
        condition,
        location: location.trim() || undefined,
        imageUrls,
      });

      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error("Failed to create listing:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Listing</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image upload */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Photos ({images.length}/5)
            </label>
            <div className="flex gap-2 flex-wrap">
              {previews.map((src, i) => (
                <div
                  key={i}
                  className="relative h-20 w-20 rounded-lg overflow-hidden border border-white/10"
                >
                  <img
                    src={src}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 w-20 rounded-lg border border-dashed border-white/10 flex items-center justify-center text-muted-foreground hover:border-white/20 hover:text-foreground transition-colors"
                >
                  <ImagePlusIcon className="h-5 w-5" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What are you selling?"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Price
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Location
            </label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, State"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your item..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading || !title.trim() || !price}>
              {loading && <Loader2Icon className="h-4 w-4 animate-spin" />}
              {loading ? "Posting..." : "Post Listing"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
