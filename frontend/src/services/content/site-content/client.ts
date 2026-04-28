import type {
  SiteContentBlock,
  SiteContentBlockDraft,
  SiteContentBlockKey,
} from './types';
import { adminApiFetch } from '@/services/admin/apiClient';
import { getApiBaseUrl } from '@/utils/network/apiBase';

type SiteContentBlockResponse = {
  block: SiteContentBlock;
};

export async function getSiteContentBlock(
  key: SiteContentBlockKey
): Promise<SiteContentBlock | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/site-content/${key}`, {
      cache: 'no-cache',
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      data?: SiteContentBlockResponse;
    };
    return json.data?.block ?? null;
  } catch {
    return null;
  }
}

export async function getAdminSiteContentBlock(
  key: SiteContentBlockKey
): Promise<SiteContentBlock | null> {
  const result = await adminApiFetch<SiteContentBlockResponse>(
    `/admin/${key}`,
    {
      pathPrefix: '/api/v1/site-content',
    }
  );
  if (!result.ok) {
    throw new Error(result.error || 'Failed to load site content block');
  }
  return result.data?.block ?? null;
}

export async function saveSiteContentBlock(
  key: SiteContentBlockKey,
  draft: SiteContentBlockDraft
): Promise<SiteContentBlock> {
  const result = await adminApiFetch<SiteContentBlockResponse>(
    `/admin/${key}`,
    {
      pathPrefix: '/api/v1/site-content',
      method: 'PUT',
      body: draft,
    }
  );
  if (!result.ok || !result.data?.block) {
    throw new Error(result.error || 'Failed to save site content block');
  }
  return result.data.block;
}
