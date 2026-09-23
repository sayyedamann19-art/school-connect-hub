import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { initials } from "@/components/common/student-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { removeStudentPhoto, uploadStudentPhoto } from "@/lib/school.functions";

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 3 * 1024 * 1024;

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That image could not be read"));
    reader.readAsDataURL(file);
  });
}

/** Avatar plus simple upload / replace / remove controls for a linked child. */
export function StudentPhotoEditor({
  studentId,
  name,
  photoUrl,
}: {
  studentId: string;
  name: string;
  photoUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ dataUrl: string; contentType: string } | null>(null);
  const queryClient = useQueryClient();
  const upload = useServerFn(uploadStudentPhoto);
  const remove = useServerFn(removeStudentPhoto);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["student", studentId, "overview"] });
    await queryClient.invalidateQueries({ queryKey: ["parent"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!preview) return;
      const base64 = preview.dataUrl.split(",")[1] ?? "";
      await upload({ data: { studentId, contentType: preview.contentType, base64 } });
    },
    onSuccess: async () => {
      setPreview(null);
      await refresh();
      toast.success("Photo updated");
    },
    onError: (error: Error) => {
      toast.error("Photo not saved", { description: error.message });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      await remove({ data: { studentId } });
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Photo removed");
    },
    onError: (error: Error) => {
      toast.error("Could not remove photo", { description: error.message });
    },
  });

  const busy = saveMutation.isPending || removeMutation.isPending;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type.toLowerCase())) {
      toast.error("Unsupported file", {
        description: "Please choose a JPG, PNG or WebP image under 3 MB.",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image too large", { description: "Please choose an image under 3 MB." });
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      setPreview({ dataUrl, contentType: file.type.toLowerCase() });
    } catch (error) {
      toast.error("That image could not be read", { description: (error as Error).message });
    }
  };

  const shown = preview?.dataUrl ?? photoUrl;

  return (
    <div className="flex flex-col items-center gap-3 sm:items-start">
      <Avatar className="size-16 border border-border">
        {shown ? <AvatarImage src={shown} alt={name} className="object-cover" /> : null}
        <AvatarFallback className="bg-primary-soft text-base font-semibold text-primary">
          {initials(name)}
        </AvatarFallback>
      </Avatar>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {preview ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            size="sm"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            Save photo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => setPreview(null)}
          >
            <X className="mr-2 size-4" />
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="mr-2 size-4" />
            {photoUrl ? "Change photo" : "Upload photo"}
          </Button>
          {photoUrl ? (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-danger sm:w-auto"
              disabled={busy}
              onClick={() => {
                if (!window.confirm("Remove this photo?")) return;
                removeMutation.mutate();
              }}
            >
              {removeMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Remove
            </Button>
          ) : null}
        </div>
      )}
      <p className="text-xs text-muted-foreground">JPG, PNG or WebP · up to 3 MB</p>
    </div>
  );
}
