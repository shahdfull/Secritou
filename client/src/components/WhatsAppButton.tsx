import { useTranslation } from "react-i18next";

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined;

export function WhatsAppButton() {
  const { t } = useTranslation();

  if (!WHATSAPP_NUMBER) return null;

  const message = encodeURIComponent(t("whatsapp.prefilledMessage"));
  const href = `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${message}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsapp.ariaLabel")}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition-transform hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
    >
      {/* WhatsApp SVG icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        className="h-7 w-7 fill-white"
        aria-hidden
      >
        <path d="M16.003 2.667C8.636 2.667 2.667 8.636 2.667 16c0 2.35.636 4.549 1.748 6.447L2.667 29.333l7.07-1.727A13.28 13.28 0 0 0 16.003 29.333C23.367 29.333 29.333 23.364 29.333 16S23.367 2.667 16.003 2.667Zm0 2.4c5.875 0 10.93 5.057 10.93 10.933S21.878 26.933 16.003 26.933a10.9 10.9 0 0 1-5.517-1.498l-.393-.236-4.197 1.025 1.057-3.99-.258-.41A10.875 10.875 0 0 1 5.07 16c0-5.876 5.057-10.933 10.933-10.933Zm-3.594 5.6c-.228 0-.597.085-.91.427-.31.34-1.188 1.16-1.188 2.83s1.217 3.281 1.386 3.507c.172.227 2.394 3.655 5.805 4.982 2.85 1.093 3.43.876 4.048.822.619-.055 1.997-.817 2.278-1.605.283-.787.283-1.462.198-1.603-.085-.142-.311-.227-.652-.397-.34-.17-2.01-.992-2.32-1.106-.312-.113-.54-.17-.768.17-.227.34-.88 1.107-1.079 1.335-.198.227-.397.255-.737.085-.34-.17-1.437-.53-2.737-1.689-.96-.901-1.609-2.015-1.797-2.355-.19-.34-.02-.523.142-.692.146-.15.34-.397.51-.595.17-.198.226-.34.34-.567.113-.228.057-.427-.028-.596-.086-.17-.763-1.846-1.047-2.527-.275-.663-.557-.571-.768-.582l-.675-.013Z" />
      </svg>
    </a>
  );
}
