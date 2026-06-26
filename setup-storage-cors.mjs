/**
 * setup-storage-cors.mjs
 *
 * Run this ONCE to configure Firebase Storage CORS so the PDF viewer
 * can use the full PDF.js canvas renderer (book-spread mode etc.).
 *
 * Usage:
 *   node setup-storage-cors.mjs
 *
 * Requirements:
 *   npm install @google-cloud/storage   (run once, dev-only)
 *   A service account JSON key with Storage Admin permissions,
 *   OR: set GOOGLE_APPLICATION_CREDENTIALS env var to the key file path.
 *
 * Without a service account key:
 *   1. Go to Firebase Console → Project Settings → Service Accounts
 *   2. Click "Generate new private key" → save as serviceAccountKey.json
 *   3. set GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
 *   4. node setup-storage-cors.mjs
 */

import { Storage } from '@google-cloud/storage';

const BUCKET = 'samrtboard.firebasestorage.app';

const CORS_CONFIG = [
  {
    origin: ['*'],
    method: ['GET', 'HEAD', 'OPTIONS'],
    responseHeader: ['Content-Type', 'Range', 'Accept-Ranges', 'Content-Length'],
    maxAgeSeconds: 3600,
  },
];

async function main() {
  console.log('Configuring CORS on Firebase Storage bucket:', BUCKET);
  const storage = new Storage();
  const bucket = storage.bucket(BUCKET);
  await bucket.setCorsConfiguration(CORS_CONFIG);
  const [metadata] = await bucket.getMetadata();
  console.log('✅ CORS configured successfully!');
  console.log('Current CORS:', JSON.stringify(metadata.cors, null, 2));
}

main().catch((err) => {
  console.error('❌ Failed:', err.message);
  console.error('\nMake sure GOOGLE_APPLICATION_CREDENTIALS points to a valid service account key.');
  process.exit(1);
});
