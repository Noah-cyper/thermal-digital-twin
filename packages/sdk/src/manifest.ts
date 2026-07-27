// @idtp/sdk — plugin manifest schema (doc 03 §3). Validate lúc nạp plugin.
import { z } from 'zod';

export const LocalizedText = z.object({
  vi: z.string().min(1),
  en: z.string().min(1),
});
export type LocalizedText = z.infer<typeof LocalizedText>;

export const EngineName = z.enum([
  'tag',
  'alarm',
  'historian',
  'graphics',
  'sim',
  'control',
  'report',
  'faceplate',
  'navigation',
  'maintenance',
  'ai',
]);
export type EngineName = z.infer<typeof EngineName>;

export const PluginManifest = z.object({
  plugin: z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    engineApi: z.string(), // semver range, vd "^1.0.0"
    domain: z.string().regex(/^[a-z0-9.]+$/),
    displayName: LocalizedText,
  }),
  provides: z.object({
    assetModel: z.string(),
    tagRegistry: z.string(),
    alarms: z.string().optional(),
    simulation: z.string().optional(),
    control: z.string().optional(),
    graphics: z.string(),
    symbols: z.string().optional(),
    faceplates: z.string().optional(),
    navigation: z.string(),
    reports: z.string().optional(),
    kpi: z.string().optional(),
    sop: z.string().optional(),
    i18n: z.string(),
    scenarios: z.string().optional(),
  }),
  requires: z.object({
    engines: z.array(EngineName),
    protocols: z.array(z.string()),
    minTagCapacity: z.number().int().positive(),
  }),
});
export type PluginManifest = z.infer<typeof PluginManifest>;
