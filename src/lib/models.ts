export type ModelTier = "flagship" | "smart" | "fast" | "free";

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  tier: ModelTier;
  context: string;
  maxOutput: string;
}

export const MODELS: ModelOption[] = [
  {
    id: "glm-5.1",
    name: "GLM-5.1",
    description: "Latest flagship · SOTA coding & reasoning",
    tier: "flagship",
    context: "200K",
    maxOutput: "128K",
  },
  {
    id: "glm-5-turbo",
    name: "GLM-5-Turbo",
    description: "Enhanced for long agent tasks",
    tier: "smart",
    context: "200K",
    maxOutput: "128K",
  },
  {
    id: "glm-4.7",
    name: "GLM-4.7",
    description: "High intelligence, strong tool calling",
    tier: "smart",
    context: "200K",
    maxOutput: "128K",
  },
  {
    id: "glm-4.6",
    name: "GLM-4.6",
    description: "Strong performance, great for agents",
    tier: "smart",
    context: "200K",
    maxOutput: "128K",
  },
  {
    id: "glm-4.5-airx",
    name: "GLM-4.5-AirX",
    description: "Fast inference, balanced quality",
    tier: "fast",
    context: "128K",
    maxOutput: "96K",
  },
  {
    id: "glm-4-flashx-250414",
    name: "GLM-4-FlashX",
    description: "Ultra fast, low latency",
    tier: "fast",
    context: "128K",
    maxOutput: "16K",
  },
  {
    id: "glm-4.7-flash",
    name: "GLM-4.7-Flash",
    description: "Free · Latest base capability",
    tier: "free",
    context: "200K",
    maxOutput: "128K",
  },
  {
    id: "glm-4-flash-250414",
    name: "GLM-4-Flash",
    description: "Free · Fast & reliable",
    tier: "free",
    context: "128K",
    maxOutput: "16K",
  },
];

export const DEFAULT_MODEL = "glm-4.5-airx";

export const TIER_LABELS: Record<ModelTier, { label: string; color: string }> = {
  flagship: { label: "Flagship", color: "text-amber-400/80 bg-amber-400/10" },
  smart: { label: "Smart", color: "text-[#88fff7]/70 bg-[#88fff7]/10" },
  fast: { label: "Fast", color: "text-blue-400/70 bg-blue-400/10" },
  free: { label: "Free", color: "text-emerald-400/70 bg-emerald-400/10" },
};
