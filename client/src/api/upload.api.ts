import apiClient from "./axios";

export type UploadContext = "cv" | "portfolio" | "document" | "image";

export interface UploadResult {
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export const uploadApi = {
  /**
   * Upload a single file. Returns the S3 key and a (pre-signed) URL.
   * @param file     - File object from an <input type="file">
   * @param context  - Upload context controls allowed MIME types server-side
   */
  uploadFile: async (file: File, context: UploadContext): Promise<UploadResult> => {
    const formData = new FormData();
    // FormData automatically uses UTF-8 encoding and multipart/form-data
    formData.append("file", file);

    const response = await apiClient.post<{ data: UploadResult }>(
      `/upload/${context}`,
      formData
      // Let axios handle Content-Type with boundary for multipart/form-data
    );
    return response.data.data;
  },

  /**
   * Delete a stored file by its S3 object key.
   */
  deleteFile: async (key: string): Promise<void> => {
    await apiClient.delete("/upload", { data: { key } });
  },
};
