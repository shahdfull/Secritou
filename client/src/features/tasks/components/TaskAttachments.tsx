import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUploadField } from "@/components/common/FileUploadField";
import { ConfirmDeleteDialog } from "@/components/shared/crud/ConfirmDeleteDialog";
import { useDocuments, useCreateDocument, useDeleteDocument, useDownloadDocument } from "@/hooks/useDocuments";
import type { UploadResult } from "@/api/upload.api";
import { Paperclip, ExternalLink, Trash2, Upload, Loader2 } from "lucide-react";

interface TaskAttachmentsProps {
  taskId: string;
  projectId: string;
  clientId: string | undefined;
  // SEC-063 (découverte incidente, session 2026-07-19) : POST /documents est authorize("ADMIN",
  // "MANAGER") seul côté serveur — un FREELANCER y recevrait systématiquement 403. Tant que ce
  // bug préexistant (hors périmètre de SEC-060) n'est pas corrigé, l'upload n'est proposé qu'à
  // ADMIN/MANAGER ; un FREELANCER peut seulement consulter/télécharger les pièces déjà jointes.
  canUpload: boolean;
}

export function TaskAttachments({ taskId, projectId, clientId, canUpload }: TaskAttachmentsProps) {
  const { data: documentsResult, isLoading } = useDocuments({ taskId, page: 1, pageSize: 50 });
  const { mutate: createDocument, isPending: isUploading } = useCreateDocument();
  const { mutate: deleteDocument, isPending: isDeleting } = useDeleteDocument();
  const downloadMutation = useDownloadDocument();

  const [attachmentName, setAttachmentName] = useState("");
  const uploadedFile = useRef<UploadResult | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const attachments = documentsResult?.data ?? [];

  const handleUpload = () => {
    if (!uploadedFile.current || !attachmentName.trim()) return;
    createDocument(
      {
        name: attachmentName.trim(),
        title: attachmentName.trim(),
        type: "OTHER",
        accessLevel: "ADMIN_FREELANCER",
        url: uploadedFile.current.url,
        fileUrl: uploadedFile.current.url,
        fileKey: uploadedFile.current.key,
        projectId,
        taskId,
        clientId,
      },
      {
        onSuccess: () => {
          setAttachmentName("");
          uploadedFile.current = null;
        },
      }
    );
  };

  const confirmDelete = () => {
    if (!deletingDocId) return;
    deleteDocument(deletingDocId, { onSuccess: () => setDeletingDocId(null) });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Paperclip className="h-4 w-4" />
        Pièces jointes
      </h3>

      {canUpload && (
        <div className="space-y-2">
          <Input
            placeholder="Nom de la pièce jointe"
            value={attachmentName}
            onChange={(e) => setAttachmentName(e.target.value)}
          />
          <FileUploadField
            context="document"
            label="Choisir un fichier"
            uploadImmediately={true}
            onUploaded={(result) => {
              if (result && "key" in result) {
                uploadedFile.current = result as UploadResult;
              }
            }}
          />
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={!attachmentName.trim() || isUploading}
            className="gap-1"
          >
            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Joindre le fichier
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : attachments.length > 0 ? (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {attachments.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between px-3 py-2 gap-2">
              <span className="text-sm truncate">{doc.name}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => downloadMutation.mutate(doc.id, { onSuccess: ({ url }) => window.open(url, "_blank") })}
                >
                  <ExternalLink className="h-3 w-3" />
                  Ouvrir
                </Button>
                {canUpload && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                    aria-label="Supprimer"
                    onClick={() => setDeletingDocId(doc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">Aucune pièce jointe.</p>
      )}

      <ConfirmDeleteDialog
        open={!!deletingDocId}
        onOpenChange={(open) => { if (!open) setDeletingDocId(null); }}
        onConfirm={confirmDelete}
        title="Supprimer cette pièce jointe ?"
        description="Cette action est irréversible."
        isDeleting={isDeleting}
      />
    </div>
  );
}
