import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Form } from "@hygraph/app-sdk";
import {
  assetUrlFromValue,
  buildFieldPathCandidates,
  findImageUrlInFormValues,
  resolveFieldPath,
} from "@/lib/focal-point";
import { findPathWithImageUrl, getNestedValue } from "@/lib/form-fields";

export function useAssetImage({
  form,
  imageField,
  activeLocale,
  useLocalization,
  modelApiId,
}: {
  form: Form;
  imageField: string;
  activeLocale?: string;
  useLocalization: boolean;
  modelApiId: string;
}) {
  const imageCandidates = useMemo(
    () =>
      buildFieldPathCandidates(
        imageField,
        activeLocale,
        useLocalization,
        modelApiId,
      ),
    [activeLocale, imageField, modelApiId, useLocalization],
  );

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);

  const handleResolve = useCallback((value: unknown, path: string | null) => {
    const url = assetUrlFromValue(value);
    if (url) {
      setImageUrl(url);
    }
    if (path) {
      setImagePath(path);
    }
  }, []);

  const handleResolveRef = useRef(handleResolve);
  handleResolveRef.current = handleResolve;

  useEffect(() => {
    let cancelled = false;
    let unsubscribes: Array<() => void> = [];
    let unsubscribeForm: (() => void) | undefined;

    async function attach() {
      const state = await form.getState();
      const values = state.values as Record<string, unknown> | undefined;

      const resolved = await resolveFieldPath(form, imageCandidates);
      if (!cancelled && resolved) {
        handleResolveRef.current(resolved.value, resolved.path);
      }

      const discoveredImagePath = findPathWithImageUrl(values, imageField);
      if (!cancelled && discoveredImagePath) {
        handleResolveRef.current(
          getNestedValue(values, discoveredImagePath),
          discoveredImagePath,
        );
      } else if (!cancelled) {
        const url = findImageUrlInFormValues(values);
        if (url) {
          handleResolveRef.current({ url }, null);
        }
      }

      const subscriptions = await Promise.all(
        imageCandidates.map((path) =>
          form.subscribeToFieldState(
            path,
            ({ value }) => handleResolveRef.current(value, path),
            { value: true },
          ),
        ),
      );

      if (cancelled) {
        subscriptions.forEach((unsubscribe) => unsubscribe());
        return;
      }

      unsubscribes = subscriptions;

      unsubscribeForm = await form.subscribeToFormState(
        (formState) => {
          const formValues = formState.values as Record<string, unknown> | undefined;
          const discoveredPath = findPathWithImageUrl(formValues, imageField);
          if (discoveredPath) {
            handleResolveRef.current(
              getNestedValue(formValues, discoveredPath),
              discoveredPath,
            );
            return;
          }

          const url = findImageUrlInFormValues(formValues);
          if (url) {
            handleResolveRef.current({ url }, null);
          }
        },
        { values: true },
      );
    }

    void attach();

    return () => {
      cancelled = true;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      unsubscribeForm?.();
    };
  }, [form, imageCandidates, imageField]);

  return { imageUrl, imagePath, imageCandidates };
}
