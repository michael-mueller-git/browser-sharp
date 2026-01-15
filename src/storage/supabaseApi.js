/**
 * Supabase API helpers for bucket exploration
 * 
 * Standalone functions to list and inspect bucket contents
 * before creating a full source connection.
 */

import { createClient } from '@supabase/supabase-js';
import { getSupportedExtensions } from '../formats/index.js';

// Reuse clients to avoid GoTrue multi-instance warnings
const clientCache = new Map();

const getClient = (url, key) => {
  const cacheKey = `${url}::${key}`;
  if (!clientCache.has(cacheKey)) {
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    clientCache.set(cacheKey, client);
  }
  return clientCache.get(cacheKey);
};

/**
 * List all collection folders in the bucket under `collections/`
 * Returns array of { id, name, assetCount, hasManifest }
 */
export async function listExistingCollections({ supabaseUrl, anonKey, bucket }) {
  if (!supabaseUrl || !anonKey || !bucket) {
    return { success: false, error: 'Missing Supabase configuration', collections: [] };
  }

  try {
    const client = getClient(supabaseUrl, anonKey);
    const storage = client.storage.from(bucket);

    // List top-level folders under collections/
    const { data: folders, error: listError } = await storage.list('collections', {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (listError) {
      return { success: false, error: listError.message, collections: [] };
    }

    if (!folders || folders.length === 0) {
      return { success: true, collections: [] };
    }

    const supportedExtensions = getSupportedExtensions();
    const collections = [];

    for (const folder of folders) {
      // Skip if it's a file, not a folder (folders have no metadata.size)
      if (folder.metadata && typeof folder.metadata.size === 'number') {
        continue;
      }

      const collectionId = folder.name;
      const basePath = `collections/${collectionId}`;

      // Check for manifest
      const { data: manifestData } = await storage.download(`${basePath}/manifest.json`);
      const hasManifest = !!manifestData;

      let assetCount = 0;
      let collectionName = collectionId;

      if (hasManifest) {
        try {
          const text = await manifestData.text();
          const manifest = JSON.parse(text);
          assetCount = manifest.assets?.length || 0;
          if (manifest.name) collectionName = manifest.name;
        } catch {
          // ignore parse errors
        }
      } else {
        // Count assets in assets/ folder
        const { data: assetFiles } = await storage.list(`${basePath}/assets`, { limit: 500 });
        if (assetFiles) {
          assetCount = assetFiles.filter((f) => {
            if (!f.name) return false;
            const ext = f.name.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
            return supportedExtensions.includes(ext);
          }).length;
        }
      }

      collections.push({
        id: collectionId,
        name: collectionName,
        assetCount,
        hasManifest,
      });
    }

    return { success: true, collections };
  } catch (err) {
    return { success: false, error: err.message, collections: [] };
  }
}

/**
 * Test bucket connection with current settings
 */
export async function testBucketConnection({ supabaseUrl, anonKey, bucket }) {
  if (!supabaseUrl || !anonKey || !bucket) {
    return { success: false, error: 'Missing configuration' };
  }

  try {
    const client = getClient(supabaseUrl, anonKey);
    const storage = client.storage.from(bucket);
    const { error } = await storage.list('', { limit: 1 });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
