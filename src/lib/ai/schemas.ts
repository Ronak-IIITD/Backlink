import { z } from "zod";

export const AIRecommendationSchema = z.object({
  issue_type: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  url: z.string(),
  reason: z.string(),
  recommendation: z.string(),
  proposed_fix: z.string().optional(),
  confidence: z.number().min(0).max(1),
  requires_approval: z.boolean(),
});

export const AIFixSchema = z.object({
  kind: z.string(),
  current: z.string().nullable(),
  proposed: z.string(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});

export const AIStrategySchema = z.object({
  bucket: z.enum(["DO_THIS_NOW", "DO_THIS_NEXT", "WATCH", "NO_ACTION"]),
  priority: z.number().min(0).max(100),
  whatWrong: z.string(),
  whyMatters: z.string(),
  whatToChange: z.string(),
  canAutomate: z.boolean(),
  needsApproval: z.string().nullable(),
});

export const StrategyRecSchema = z.object({
  category: z.string(),
  priority: z.number().min(0).max(100),
  bucket: z.enum(["DO_THIS_NOW", "DO_THIS_NEXT", "WATCH", "NO_ACTION"]),
  whatWrong: z.string().min(4),
  whyMatters: z.string().min(4),
  whatToChange: z.string().min(4),
  canAutomate: z.boolean(),
  needsApproval: z.string().nullable(),
  relatedIssueType: z.string().nullable(),
  affectedUrls: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
});

export const StrategyListSchema = z.object({
  recs: z.array(StrategyRecSchema).min(1).max(15),
});

export const FixSchema = z.object({
  kind: z.string(),
  current: z.string().nullable(),
  proposed: z.string().min(4).max(2000),
  reason: z.string().min(4),
});

export type AIRecommendation = z.infer<typeof AIRecommendationSchema>;
