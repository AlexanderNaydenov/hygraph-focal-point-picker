import type { Form } from "@hygraph/app-sdk";

export type FocalPoint = { x: number; y: number };

export const DEFAULT_FOCAL_POINT: FocalPoint = { x: 50, y: 50 };

export function clampFocalPoint(x: number, y: number): FocalPoint {
  return {
    x: Math.max(0, Math.min(100, Math.round(x))),
    y: Math.max(0, Math.min(100, Math.round(y))),
  };
}

export function assetUrlFromValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value.startsWith("http") ? value : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = assetUrlFromValue(item);
      if (url) {
        return url;
      }
    }
    return null;
  }

  const record = value as Record<string, unknown>;

  for (const key of ["url", "src", "secure_url"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.startsWith("http")) {
      return candidate;
    }
  }

  if (typeof record.handle === "string" && record.handle.length > 0) {
    return `https://media.graphassets.com/${record.handle}`;
  }

  for (const key of ["file", "asset", "image"]) {
    if (key in record) {
      const nested = assetUrlFromValue(record[key]);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export function buildFieldPathCandidates(
  apiId: string,
  locale: string | undefined,
  useLocalization: boolean,
  modelApiId?: string,
): string[] {
  const paths: string[] = [];

  if (useLocalization && locale) {
    paths.push(`localization_${locale}.${apiId}`);
    paths.push(`${apiId}_${locale}`);
    paths.push(`localizations.${locale}.${apiId}`);
  }

  paths.push(apiId);

  if (modelApiId === "Asset") {
    if (useLocalization && locale) {
      paths.push(`localization_${locale}.url`);
      paths.push(`url_${locale}`);
    }
    paths.push("url");
  }

  return [...new Set(paths)];
}

export function findImageUrlInFormValues(
  values: Record<string, unknown> | undefined,
  depth = 0,
): string | null {
  if (!values || depth > 6) {
    return null;
  }

  for (const [key, value] of Object.entries(values)) {
    const url = assetUrlFromValue(value);
    if (
      url &&
      /file|image|asset|url|upload|media|photo|picture/i.test(key)
    ) {
      return url;
    }

    if (value && typeof value === "object") {
      const nested = findImageUrlInFormValues(
        value as Record<string, unknown>,
        depth + 1,
      );
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export async function resolveFieldPath(
  form: Form,
  candidates: string[],
): Promise<{ path: string; value: unknown } | null> {
  for (const path of candidates) {
    const state = await form.getFieldState(path);
    if (state?.value !== undefined && state.value !== null && state.value !== "") {
      return { path, value: state.value };
    }
  }

  return null;
}

/** Find a form field that exists, even when its value is still empty. */
export async function findRegisteredFieldPath(
  form: Form,
  candidates: string[],
): Promise<string | null> {
  for (const path of candidates) {
    const state = await form.getFieldState(path);
    if (state !== undefined) {
      return path;
    }
  }

  return null;
}

/** Mirror the image field path pattern for the focal point JSON field. */
export function deriveFocalPointPath(
  imagePath: string | null,
  imageField: string,
  focalPointField: string,
  fallbackCandidates: string[],
): string | null {
  if (!imagePath) {
    return fallbackCandidates[0] ?? null;
  }

  const localizationMatch = imagePath.match(
    new RegExp(`^localization_([^.]+)\\.${escapeRegExp(imageField)}$`),
  );
  if (localizationMatch) {
    return `localization_${localizationMatch[1]}.${focalPointField}`;
  }

  const localizationsMatch = imagePath.match(
    new RegExp(`^localizations\\.([^.]+)\\.${escapeRegExp(imageField)}$`),
  );
  if (localizationsMatch) {
    return `localizations.${localizationsMatch[1]}.${focalPointField}`;
  }

  const suffixMatch = imagePath.match(
    new RegExp(`^${escapeRegExp(imageField)}_([a-zA-Z0-9_-]+)$`),
  );
  if (suffixMatch) {
    return `${focalPointField}_${suffixMatch[1]}`;
  }

  if (imagePath === imageField) {
    return focalPointField;
  }

  if (imagePath.endsWith(`.${imageField}`)) {
    return imagePath.slice(0, -(imageField.length + 1)) + `.${focalPointField}`;
  }

  return fallbackCandidates[0] ?? null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isFocalPoint(value: unknown): value is FocalPoint {
  return (
    !!value &&
    typeof value === "object" &&
    "x" in value &&
    "y" in value &&
    !Number.isNaN(Number((value as FocalPoint).x)) &&
    !Number.isNaN(Number((value as FocalPoint).y))
  );
}
