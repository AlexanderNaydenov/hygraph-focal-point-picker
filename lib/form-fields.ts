import type { Form } from "@hygraph/app-sdk";
import type { Model } from "@hygraph/app-sdk/dist/type-helpers/model";
import {
  assetUrlFromValue,
  isFocalPoint,
  type FocalPoint,
} from "@/lib/focal-point";

export function getNestedValue(
  source: Record<string, unknown> | undefined,
  path: string,
): unknown {
  if (!source) {
    return undefined;
  }

  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, source);
}

export function listAllFormPaths(
  source: Record<string, unknown> | undefined,
  prefix = "",
): string[] {
  if (!source) {
    return [];
  }

  const paths: string[] = [];

  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);

    if (value && typeof value === "object" && !Array.isArray(value)) {
      paths.push(
        ...listAllFormPaths(value as Record<string, unknown>, path),
      );
    }
  }

  return paths;
}

export function collectPathsForKey(
  source: Record<string, unknown> | undefined,
  keyName: string,
  prefix = "",
): string[] {
  if (!source) {
    return [];
  }

  const paths: string[] = [];

  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (key === keyName) {
      paths.push(path);
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      paths.push(
        ...collectPathsForKey(
          value as Record<string, unknown>,
          keyName,
          path,
        ),
      );
    }
  }

  return paths;
}

export function findPathsForFieldApiId(
  source: Record<string, unknown> | undefined,
  fieldApiId: string,
): string[] {
  if (!source) {
    return [];
  }

  const exact = collectPathsForKey(source, fieldApiId);
  const fuzzy = listAllFormPaths(source).filter((path) => {
    const leaf = path.split(".").pop() ?? path;
    return leaf === fieldApiId || path.includes(fieldApiId);
  });

  return [...new Set([...exact, ...fuzzy])];
}

export function findPathWithImageUrl(
  source: Record<string, unknown> | undefined,
  imageFieldApiId: string,
): string | null {
  if (!source) {
    return null;
  }

  for (const path of collectPathsForKey(source, imageFieldApiId)) {
    if (assetUrlFromValue(getNestedValue(source, path))) {
      return path;
    }
  }

  function walk(
    node: Record<string, unknown>,
    prefix: string,
  ): string | null {
    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (assetUrlFromValue(value) && /file|image|asset|url|upload|media|photo/i.test(key)) {
        return path;
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const nested = walk(value as Record<string, unknown>, path);
        if (nested) {
          return nested;
        }
      }
    }
    return null;
  }

  return walk(source, "");
}

export function findMatchingFocalPointPath(
  source: Record<string, unknown> | undefined,
  expected: FocalPoint,
): string | null {
  if (!source) {
    return null;
  }

  function walk(
    node: Record<string, unknown>,
    prefix: string,
  ): string | null {
    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (
        isFocalPoint(value) &&
        value.x === expected.x &&
        value.y === expected.y
      ) {
        return path;
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const nested = walk(value as Record<string, unknown>, path);
        if (nested) {
          return nested;
        }
      }
    }
    return null;
  }

  return walk(source, "");
}

export function deriveSiblingFieldPath(
  sourcePath: string,
  fromApiId: string,
  toApiId: string,
): string | null {
  if (sourcePath.endsWith(`.${fromApiId}`)) {
    return sourcePath.slice(0, -(fromApiId.length + 1)) + `.${toApiId}`;
  }

  const suffixMatch = sourcePath.match(
    new RegExp(`^${escapeRegExp(fromApiId)}_(.+)$`),
  );
  if (suffixMatch) {
    return `${toApiId}_${suffixMatch[1]}`;
  }

  if (sourcePath === fromApiId) {
    return toApiId;
  }

  return null;
}

export async function modelHasField(
  model: Model,
  apiId: string,
): Promise<boolean> {
  const fields = await model.getFields();
  return fields.some((field) => field.apiId === apiId);
}

async function verifyFocalPointWrite(
  form: Form,
  expected: FocalPoint,
): Promise<string | null> {
  const state = await form.getState();
  const values = state.values as Record<string, unknown> | undefined;
  return findMatchingFocalPointPath(values, expected);
}

async function tryChangeAtPath(
  form: Form,
  path: string,
  value: FocalPoint,
): Promise<string | null> {
  const payloads: unknown[] = [value, JSON.stringify(value)];

  for (const payload of payloads) {
    await form.change(path, payload);
    const verified = await verifyFocalPointWrite(form, value);
    if (verified) {
      return verified;
    }

    const fieldState = await form.getFieldState(path);
    if (isFocalPoint(fieldState?.value)) {
      return path;
    }
  }

  const lastDot = path.lastIndexOf(".");
  if (lastDot > 0) {
    const parentPath = path.slice(0, lastDot);
    const fieldKey = path.slice(lastDot + 1);
    const state = await form.getState();
    const parentValue = getNestedValue(
      state.values as Record<string, unknown>,
      parentPath,
    );

    const parentObject =
      parentValue && typeof parentValue === "object" && !Array.isArray(parentValue)
        ? { ...(parentValue as Record<string, unknown>) }
        : {};

    parentObject[fieldKey] = value;
    await form.change(parentPath, parentObject);

    const verifiedParent = await verifyFocalPointWrite(form, value);
    if (verifiedParent) {
      return verifiedParent;
    }
  }

  await form.changeBulk({ [path]: value });
  return verifyFocalPointWrite(form, value);
}

export async function discoverFocalPointWritePaths(
  form: Form,
  fieldApiId: string,
  preferredPaths: string[],
): Promise<string[]> {
  const state = await form.getState();
  const values = state.values as Record<string, unknown> | undefined;
  const discovered = findPathsForFieldApiId(values, fieldApiId);

  return [...new Set([...preferredPaths, ...discovered])];
}

export async function writeFocalPointToForm(
  form: Form,
  fieldApiId: string,
  value: FocalPoint,
  preferredPaths: Array<string | null | undefined>,
): Promise<{ path: string | null; tried: string[] }> {
  const paths = await discoverFocalPointWritePaths(
    form,
    fieldApiId,
    preferredPaths.filter((path): path is string => Boolean(path)),
  );

  for (const path of paths) {
    const verified = await tryChangeAtPath(form, path, value);
    if (verified) {
      return { path: verified, tried: paths };
    }
  }

  return { path: null, tried: paths };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
