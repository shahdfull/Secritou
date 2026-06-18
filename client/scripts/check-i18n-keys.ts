#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const I18N_DIR = path.resolve(__dirname, "../client/src/i18n/locales");
const LANGS = ["en", "fr"];

function getNestedKeys(obj: any, prefix: string = ""): string[] {
  let keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      keys = keys.concat(getNestedKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

async function checkI18nKeys() {
  console.log("🔍 Checking i18n keys...");
  
  const translations: Record<string, any> = {};
  const allKeys: Set<string> = new Set();

  // Load all translations
  for (const lang of LANGS) {
    const filePath = path.join(I18N_DIR, lang, "translation.json");
    const content = await fs.readFile(filePath, "utf8");
    translations[lang] = JSON.parse(content);
    const keys = getNestedKeys(translations[lang]);
    keys.forEach(key => allKeys.add(key));
  }

  // Check for missing keys in each language
  let hasErrors = false;
  for (const lang of LANGS) {
    const langKeys = new Set(getNestedKeys(translations[lang]));
    const missingKeys: string[] = [];
    const extraKeys: string[] = [];

    for (const key of allKeys) {
      if (!langKeys.has(key)) {
        missingKeys.push(key);
      }
    }

    for (const key of langKeys) {
      if (!allKeys.has(key)) {
        extraKeys.push(key);
      }
    }

    if (missingKeys.length > 0) {
      console.error(`❌ [${lang}] Missing keys:`, missingKeys);
      hasErrors = true;
    }
    if (extraKeys.length > 0) {
      console.warn(`⚠️  [${lang}] Extra keys:`, extraKeys);
    }
  }

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log("✅ All i18n keys are consistent!");
  }
}

checkI18nKeys().catch(err => {
  console.error("Error checking i18n keys:", err);
  process.exit(1);
});
