/** CMS auto-apply adapters. Approval-gated: only called with status=approved actions. */

export interface ApplyRequest {
  actionId: string;
  projectId: string;
  websiteUrl: string;
  kind: string; // meta_fix | title_fix | h1_fix | ...
  currentValue: string | null;
  proposedValue: string;
  targetUrls: string[];
  payload?: any;
}

export interface ApplyResult {
  applied: boolean;
  adapter: string;
  message: string;
  detail?: string;
}

export interface CmsAdapter {
  name: string;
  isConfigured(): boolean;
  whyNotConfigured(): string | null;
  apply(req: ApplyRequest): Promise<ApplyResult>;
}
