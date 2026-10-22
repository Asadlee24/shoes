import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useStore } from "./store";
import { pageMetadata } from "../shared/seo.mjs";

export function SiteMetadata() {
  const { pathname } = useLocation();
  const { loading, products } = useStore();
  useEffect(() => {
    if (loading) return;
    const metadata = pageMetadata(pathname, products);
    document.title = metadata.title;
    const meta = (
      attribute: "name" | "property",
      name: string,
      content: string,
    ) => {
      let element = document.head.querySelector<HTMLMetaElement>(
        `meta[${attribute}="${name}"]`,
      );
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.append(element);
      }
      element.content = content;
    };
    meta("name", "description", metadata.description);
    meta("name", "robots", metadata.robots);
    for (const [name, value] of Object.entries({
      title: metadata.title,
      description: metadata.description,
      url: metadata.canonical,
      image: metadata.image,
      type: metadata.type,
    }))
      meta("property", `og:${name}`, value);
    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = metadata.canonical;
    document.getElementById("qf-product-schema")?.remove();
    if (metadata.structuredData) {
      const script = document.createElement("script");
      script.id = "qf-product-schema";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(metadata.structuredData);
      document.head.append(script);
    }
  }, [pathname, loading, products]);
  return null;
}
