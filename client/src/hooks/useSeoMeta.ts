import { useEffect } from "react";

interface SeoMetaProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

export function useSeoMeta({ title, description, image, url }: SeoMetaProps) {
  useEffect(() => {
    document.title = title;

    const updateMeta = (name: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let element = document.querySelector(selector);

      if (!element) {
        element = document.createElement("meta");
        if (isProperty) {
          element.setAttribute("property", name);
        } else {
          element.setAttribute("name", name);
        }
        document.head.appendChild(element);
      }

      element.setAttribute("content", content);
    };

    updateMeta("description", description);
    updateMeta("og:title", title, true);
    updateMeta("og:description", description, true);
    updateMeta("og:type", "website", true);

    if (image) {
      updateMeta("og:image", image, true);
    }

    if (url) {
      updateMeta("og:url", url, true);

      let canonicalLink = document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
      if (!canonicalLink) {
        canonicalLink = document.createElement("link") as HTMLLinkElement;
        canonicalLink.rel = "canonical";
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = url;
    }
  }, [title, description, image, url]);
}
