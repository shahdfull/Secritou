import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUpload } from "@/hooks/useUpload";
import type { UploadContext, UploadResult } from "@/api/upload.api";

interface FileUploadFieldProps {
  context: UploadContext;
  accept?: string;
  label?: string;
  currentFileName?: string;
  // Support both modes:
  // Mode 1: onUploaded(File) - new mode for forms that submit files with data
  // Mode 2: onUploaded(UploadResult) - old mode for immediate upload
  onUploaded: ((file: File | UploadResult) => void) | undefined;
  disabled?: boolean;
  className?: string;
  // Set this to true to use old upload-immediately behavior
  uploadImmediately?: boolean;
}

export function FileUploadField({
  context,
  accept,
  label,
  currentFileName,
  onUploaded,
  disabled,
  className,
  uploadImmediately = false,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Mode 1: Immediate upload (old behavior)
  const { upload, result, isUploading, deleteUploaded } = useUpload({
    context,
    onSuccess: (uploadResult) => {
      onUploaded?.(uploadResult);
    },
  });

  const displayName =
    (uploadImmediately ? result?.originalName : selectedFile?.name) ?? currentFileName;
  const hasFile = Boolean(displayName);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic validation
    const acceptedTypes = accept?.split(",").map((t) => t.trim()) ?? [];
    const fileExt = "." + file.name.split(".").pop()?.toLowerCase();

    if (acceptedTypes.length > 0 && !acceptedTypes.includes(fileExt)) {
      toast.error(`Fichier non accepté. Types acceptés: ${accept}`);
      return;
    }

    if (uploadImmediately) {
      // Mode 1: Upload immediately
      await upload(file);
    } else {
      // Mode 2: Store file in memory only (for form submission)
      setSelectedFile(file);
      onUploaded?.(file);
    }

    // Reset input so the same file can be re-selected if needed
    e.target.value = "";
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (uploadImmediately && result?.key) {
      await deleteUploaded(result.key);
    } else {
      setSelectedFile(null);
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading) inputRef.current?.click();
  };

  return (
    <div className={cn("w-full", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isUploading}
        className={cn(
          "relative w-full rounded-xl border-2 border-dashed p-6 text-center transition-colors",
          "hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          hasFile ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-border bg-muted/30",
          (disabled || isUploading) && "cursor-not-allowed opacity-60"
        )}
      >
        {uploadImmediately && isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading…</p>
          </div>
        ) : hasFile ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              <span className="truncate text-sm font-medium">{displayName}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-7 w-7"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {label ?? "Click to upload a file"}
            </p>
          </div>
        )}
      </button>
    </div>
  );
}
