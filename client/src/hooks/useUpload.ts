import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { uploadApi, type UploadContext, type UploadResult } from "@/api/upload.api";
import i18n from "@/i18n";

export interface UseUploadOptions {
  context: UploadContext;
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: Error) => void;
}

export interface UseUploadReturn {
  upload: (file: File) => Promise<UploadResult | null>;
  deleteUploaded: (key: string) => Promise<void>;
  result: UploadResult | null;
  isUploading: boolean;
  isDeleting: boolean;
  reset: () => void;
}

export function useUpload({ context, onSuccess, onError }: UseUploadOptions): UseUploadReturn {
  const [result, setResult] = useState<UploadResult | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadApi.uploadFile(file, context),
    onSuccess: (data) => {
      setResult(data);
      onSuccess?.(data);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Upload failed");
      onError?.(err);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => uploadApi.deleteFile(key),
    onError: () => {
      // Non-fatal : just warn
      toast.warning(i18n.t("toasts.previousFileRemoveWarning"));
    },
  });

  const upload = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      // Delete the previous file from S3 before uploading a new one
      if (result?.key) {
        await deleteMutation.mutateAsync(result.key).catch(() => {});
      }
      return uploadMutation.mutateAsync(file).catch(() => null);
    },
    [result, uploadMutation, deleteMutation]
  );

  const deleteUploaded = useCallback(
    async (key: string) => {
      await deleteMutation.mutateAsync(key);
      setResult(null);
    },
    [deleteMutation]
  );

  const reset = useCallback(() => {
    setResult(null);
    uploadMutation.reset();
  }, [uploadMutation]);

  return {
    upload,
    deleteUploaded,
    result,
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
    reset,
  };
}
