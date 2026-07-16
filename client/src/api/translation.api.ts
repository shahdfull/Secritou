import apiClient from "./axios";

export const translationApi = {
  /** Admin — translates French text to English via the server's MyMemory-backed helper. */
  frToEn: async (text: string): Promise<string> => {
    const res = await apiClient.post<{ data: { translatedText: string } }>("/admin/translate/fr-to-en", { text });
    return res.data.data.translatedText;
  },
};
