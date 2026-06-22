import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormSidebarExtension, Wrapper } from "@hygraph/app-sdk-react";
import { FocalPointPicker } from "@/components/FocalPointPicker";
import { useAssetImage } from "@/hooks/useAssetImage";
import {
  deriveSiblingFieldPath,
  modelHasField,
  writeFocalPointToForm,
} from "@/lib/form-fields";
import {
  buildFieldPathCandidates,
  DEFAULT_FOCAL_POINT,
  deriveFocalPointPath,
  isFocalPoint,
  resolveFieldPath,
  type FocalPoint,
} from "@/lib/focal-point";

type SidebarConfig = {
  focalPointField?: string;
  imageField?: string;
  useLocalization?: boolean;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SelectFocalPointSidebar() {
  const { extension, form, model, allLocales, selectedLocales, showToast } =
    useFormSidebarExtension();

  const config = extension.sidebarConfig as SidebarConfig;
  const focalPointField = config.focalPointField || "focalPoint";
  const imageField = config.imageField || "file";
  const useLocalization = config.useLocalization !== false;

  const activeLocale = useMemo(() => {
    const enabled = selectedLocales.find((locale) => locale.isEnabled);
    if (enabled) {
      return enabled.apiId;
    }
    return (
      allLocales.find((locale) => locale.isDefault)?.apiId ??
      allLocales[0]?.apiId
    );
  }, [allLocales, selectedLocales]);

  const focalPointCandidates = useMemo(
    () =>
      buildFieldPathCandidates(
        focalPointField,
        activeLocale,
        useLocalization,
        model.apiId,
      ),
    [activeLocale, focalPointField, model.apiId, useLocalization],
  );

  const { imageUrl, imagePath } = useAssetImage({
    form,
    imageField,
    activeLocale,
    useLocalization,
    modelApiId: model.apiId,
  });

  const [focalPointPath, setFocalPointPath] = useState<string | null>(null);
  const [position, setPosition] = useState<FocalPoint>(DEFAULT_FOCAL_POINT);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [schemaFieldExists, setSchemaFieldExists] = useState<boolean | null>(
    null,
  );
  const [lastTriedPaths, setLastTriedPaths] = useState<string[]>([]);

  useEffect(() => {
    void modelHasField(model, focalPointField).then(setSchemaFieldExists);
  }, [focalPointField, model]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribes: Array<() => void> = [];

    async function attach() {
      const resolved = await resolveFieldPath(form, focalPointCandidates);
      if (!cancelled && resolved) {
        setFocalPointPath(resolved.path);
        if (isFocalPoint(resolved.value)) {
          setPosition({
            x: Number(resolved.value.x),
            y: Number(resolved.value.y),
          });
        }
      }

      const subscriptions = await Promise.all(
        focalPointCandidates.map((path) =>
          form.subscribeToFieldState(
            path,
            ({ value }) => {
              if (isFocalPoint(value)) {
                setFocalPointPath(path);
                setPosition({
                  x: Number(value.x),
                  y: Number(value.y),
                });
              }
            },
            { value: true },
          ),
        ),
      );

      if (!cancelled) {
        unsubscribes = subscriptions;
      } else {
        subscriptions.forEach((unsubscribe) => unsubscribe());
      }
    }

    void attach();

    return () => {
      cancelled = true;
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [form, focalPointCandidates]);

  const preferredWritePaths = useMemo(() => {
    return [
      focalPointPath,
      imagePath
        ? deriveSiblingFieldPath(imagePath, imageField, focalPointField)
        : null,
      deriveFocalPointPath(
        imagePath,
        imageField,
        focalPointField,
        focalPointCandidates,
      ),
      ...focalPointCandidates,
    ].filter((path): path is string => Boolean(path));
  }, [
    focalPointCandidates,
    focalPointField,
    focalPointPath,
    imageField,
    imagePath,
  ]);

  const handleCommit = useCallback(
    async (next: FocalPoint) => {
      if (schemaFieldExists === false) {
        setSaveStatus("error");
        return;
      }

      setPosition(next);
      setSaveStatus("saving");

      const { path: writtenPath, tried } = await writeFocalPointToForm(
        form,
        focalPointField,
        next,
        preferredWritePaths,
      );
      setLastTriedPaths(tried);

      if (writtenPath) {
        setFocalPointPath(writtenPath);
        setSaveStatus("saved");
        void showToast({
          title: "Focal point saved",
          description: `Written to ${writtenPath}. Save the entry to persist.`,
          variantColor: "success",
        });
        return;
      }

      setSaveStatus("error");
      void showToast({
        title: "Could not save focal point",
        description:
          "Use the app's Focal point field element on the Asset model instead of a generic JSON field.",
        variantColor: "error",
      });
    },
    [
      focalPointField,
      form,
      preferredWritePaths,
      schemaFieldExists,
      showToast,
    ],
  );

  if (!activeLocale && useLocalization) {
    return (
      <div className="sidebar">
        <p className="sidebar-error">No active locale found for this entry.</p>
      </div>
    );
  }

  if (schemaFieldExists === false) {
    return (
      <div className="sidebar">
        <h2>Select focal point</h2>
        <p className="sidebar-error">
          No <code>{focalPointField}</code> field on the Asset model. Add the
          app&apos;s <strong>Focal point</strong> field element (not a generic
          JSON field), then reload.
        </p>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="sidebar">
        <h2>Select focal point</h2>
        <p>
          Upload or select an image in <code>{imageField}</code>
          {activeLocale ? ` (${activeLocale})` : ""} first.
        </p>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <h2>Select focal point</h2>
      <p className="sidebar-hint">
        For reliable saving, use the <strong>Focal point</strong> app field on
        the Asset form. The sidebar mirrors the picker but may not update a
        generic JSON field.
      </p>
      <FocalPointPicker
        imageUrl={imageUrl}
        position={position}
        onPositionChange={setPosition}
        onCommit={handleCommit}
      />
      {saveStatus === "saved" && focalPointPath ? (
        <p className="sidebar-success">
          Saved to <code>{focalPointPath}</code>. Now save the entry.
        </p>
      ) : null}
      {saveStatus === "error" ? (
        <div className="sidebar-error">
          <p>
            Could not update <code>{focalPointField}</code>. Add the
            app&apos;s <strong>Focal point</strong> field element to Asset
            (Schema → Add field → Apps → Focal point), remove any generic JSON
            field with the same API ID, then use the field in the main form.
          </p>
          {lastTriedPaths.length > 0 ? (
            <p className="sidebar-hint">Tried: {lastTriedPaths.join(", ")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SdkFallback({ state }: { state: string }) {
  return (
    <div className="sdk-fallback">
      {state === "error"
        ? "SDK connection error. Open this page from within Hygraph."
        : "Connecting to Hygraph…"}
    </div>
  );
}

export default function SelectFocalPointPage() {
  return (
    <Wrapper fallback={SdkFallback}>
      <SelectFocalPointSidebar />
    </Wrapper>
  );
}
