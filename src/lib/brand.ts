import gateAsset from "@/assets/dawn-breakers-gate.jpg.asset.json";
import logoAsset from "@/assets/dawn-breakers-logo.jpg.asset.json";

export const schoolName = "Dawn Breakers School";
export const schoolMotto = "Morality Before Materiality";
// These CDN assets are not files in public/ or the build output. Resolve them
// against the project's asset-serving origin, not the current deployment:
// external hosts (including Pages) do not implement /__l5e/assets-v1/.
const assetOrigin = "https://id-preview--e2d9199d-8106-4437-bb9b-5fe7dc4b640e.lovable.app";
export const logoUrl = new URL(logoAsset.url, assetOrigin).href;
export const gateUrl = new URL(gateAsset.url, assetOrigin).href;
