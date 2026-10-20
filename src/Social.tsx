import { Instagram, Phone, Globe } from "lucide-react";
import { useStore } from "./store";
export function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.52 3.48A11.85 11.85 0 0 0 12.06 0C5.47 0 .1 5.37.1 11.96c0 2.11.55 4.17 1.6 5.99L0 24l6.2-1.63a11.93 11.93 0 0 0 5.86 1.5h.01c6.59 0 11.96-5.37 11.96-11.96 0-3.2-1.25-6.2-3.51-8.43ZM12.06 21.85a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.68.97.98-3.59-.24-.37a9.92 9.92 0 1 1 8.34 4.58Zm5.44-7.43c-.3-.15-1.77-.88-2.05-.98-.27-.1-.47-.15-.67.15-.2.3-.77.98-.94 1.18-.17.2-.35.22-.65.07-.3-.15-1.26-.47-2.4-1.48-.89-.8-1.49-1.78-1.66-2.08-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}
export function TikTokIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M16.6 0h-4.1v16.45a3.25 3.25 0 1 1-2.8-3.22V9.08a7.37 7.37 0 1 0 6.9 7.37V8.09A10.1 10.1 0 0 0 22.5 10V5.88A5.9 5.9 0 0 1 16.6 0Z" />
    </svg>
  );
}
export function SocialLinks() {
  const { settings: s } = useStore();
  if (!s) return null;
  return (
    <nav className="social-icons" aria-label="Follow QADAM FLEX">
      {s.instagram && (
        <a
          href={`https://www.instagram.com/${s.instagram.replace(/^@/, "")}`}
          aria-label="Qadam Flex on Instagram"
          title="Instagram"
          target="_blank"
          rel="noreferrer"
        >
          <Instagram size={19} />
        </a>
      )}
      {s.tiktok && (
        <a
          href={`https://www.tiktok.com/@${s.tiktok.replace(/^@/, "")}`}
          aria-label="Qadam Flex on TikTok"
          title="TikTok"
          target="_blank"
          rel="noreferrer"
        >
          <TikTokIcon size={19} />
        </a>
      )}
      {s.whatsapp && (
        <a
          href={`https://wa.me/${s.whatsapp}`}
          aria-label="Chat with Qadam Flex on WhatsApp"
          title="WhatsApp"
          target="_blank"
          rel="noreferrer"
        >
          <WhatsAppIcon size={19} />
        </a>
      )}
    </nav>
  );
}
export { Instagram, Phone, Globe };
