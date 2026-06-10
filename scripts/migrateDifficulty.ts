#!/usr/bin/env node
/**
 * Migration: clamp snippet difficulty to 5
 * Usage: npx tsx scripts/migrateDifficulty.ts
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const SA_PATH = resolve(process.cwd(), "scripts/serviceAccount.json");

if (!existsSync(SA_PATH)) {
  console.error("❌  scripts/serviceAccount.json not found.");
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(SA_PATH, "utf8"))) });
const db = getFirestore();

async function main() {
  console.log("🔍  Loading snippets...");
  const snap = await db.collection("snippets").get();

  const toFix = snap.docs.filter((d) => Number(d.data().difficulty) > 5);
  console.log(`  Found ${toFix.length} snippet(s) with difficulty > 5 (out of ${snap.size} total).`);

  if (toFix.length === 0) {
    console.log("✓  Nothing to do.");
    return;
  }

  // Firestore batches max 500 writes each
  const BATCH_SIZE = 499;
  let updated = 0;

  for (let i = 0; i < toFix.length; i += BATCH_SIZE) {
    const chunk = toFix.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const doc of chunk) {
      batch.update(doc.ref, { difficulty: 5, updatedAt: new Date() });
    }
    await batch.commit();
    updated += chunk.length;
    console.log(`  Updated ${updated}/${toFix.length}...`);
  }

  console.log(`\n✓  Done. ${updated} snippet(s) set to difficulty 5.`);
}

main().catch((err) => {
  console.error("❌  Fatal:", err);
  process.exit(1);
});
