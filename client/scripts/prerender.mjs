/**
 * Post-build prerender of the public marketing routes.
 *
 * Serves dist/ locally, renders each public route in headless Chrome, and
 * writes the fully-rendered HTML to dist/<route>/index.html. Social crawlers
 * (LinkedIn, Facebook, WhatsApp — none of which execute JavaScript) then see
 * the real per-page <title>/OG tags, and Googlebot gets full HTML on first
 * fetch. The React app hydrates on top; /app and /client stay a pure SPA.
 *
 * Usage: npm run build && node scripts/prerender.mjs
 */
import { createServer } from "node:http";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import sirv from "sirv";

const PUBLIC_ROUTES = [
  "/",
  "/services",
  "/solutions",
  "/case-studies",
  "/contact",
  "/rejoindre",
  "/mentions-legales",
  "/confidentialite",
  "/404", // matches the "*" route → prerendered NotFoundPage for the host's error_page
];

const PORT = 4174;
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");

if (!existsSync(join(DIST, "index.html"))) {
  console.error("dist/index.html not found — run `npm run build` first.");
  process.exit(1);
}

// `single: true` = SPA fallback, mirrors production rewrite behaviour.
const serve = sirv(DIST, { single: true, dev: true });
const server = createServer(serve).listen(PORT);

const browser = await puppeteer.launch();

try {
  const page = await browser.newPage();
  // Force French: headless Chrome reports navigator.language = en-US, which
  // would flip the i18n detector (localStorage → navigator) to English and
  // produce EN snapshots with FR meta tags.
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem("lang", "fr");
    } catch {
      /* ignore */
    }
  });
  // Block third-party analytics so snapshots are deterministic and fast.
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (/googletagmanager|google-analytics|posthog/.test(url)) return req.abort();
    return req.continue();
  });

  for (const route of PUBLIC_ROUTES) {
    await page.goto(`http://localhost:${PORT}${route}`, {
      waitUntil: "networkidle0",
      timeout: 60_000,
    });
    // Let the SEO effect + i18n settle.
    await page.waitForFunction(() => document.title.length > 0);
    const html = await page.content();

    const file = route === "/" ? join(DIST, "index.html") : join(DIST, route, "index.html");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "<!doctype html>\n" + html.replace(/^<!doctype html>/i, "").trimStart());
    console.log(`✓ prerendered ${route.padEnd(20)} → ${file.slice(DIST.length + 1)}`);
  }

  // Canonicals/OG URLs are baked from VITE_SITE_URL at build time: a dev .env
  // produces localhost URLs that must never be deployed.
  const homeHtml = await page.evaluate(() => document.head.innerHTML);
  if (/localhost|127\.0\.0\.1/.test(homeHtml.match(/rel="canonical" href="([^"]*)"/)?.[1] ?? "")) {
    console.warn(
      "\n⚠️  Canonical URLs point to localhost — rebuild with VITE_SITE_URL=https://secritou.tn before deploying this dist/."
    );
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\nDone. ${PUBLIC_ROUTES.length} routes prerendered into dist/.`);
