import { useEffect, useMemo, useState } from "react";
import { useFieldExtension, Wrapper } from "@hygraph/app-sdk-react";
import { FocalPointPicker } from "@/components/FocalPointPicker";
import { useAssetImage } from "@/hooks/useAssetImage";
import { DEFAULT_FOCAL_POINT, isFocalPoint, type FocalPoint } from "@/lib/focal-point";

type FieldConfig = {
  imageField?: string;
};

function FocalPointField() {
  const {
    value,
    onChange,
    form,
    locale,
    field,
    model,
    isReadOnly,
    name,
    extension,
  } = useFieldExtension();

  const fieldConfig = (extension.fieldConfig ?? {}) as FieldConfig;
  const imageField = fieldConfig.imageField || "file";

  const [position, setPosition] = useState<FocalPoint>(DEFAULT_FOCAL_POINT);

  const { imageUrl } = useAssetImage({
    form,
    imageField,
    activeLocale: locale,
    useLocalization: Boolean(field.isLocalized),
    modelApiId: model.apiId,
  });

  useEffect(() => {
    if (isFocalPoint(value)) {
      setPosition({ x: Number(value.x), y: Number(value.y) });
    }
  }, [value]);

  const validationError = useMemo(() => {
    if (model.apiId !== "Asset") {
      return "This field is intended for the Asset model.";
    }
  }, [model.apiId]);

  const handleCommit = (next: FocalPoint) => {
    setPosition(next);
    void onChange(next);
  };

  if (validationError) {
    return <p className="sidebar-error">{validationError}</p>;
  }

  if (!imageUrl) {
    return (
      <div className="sidebar">
        <p>
          Upload an image in <code>{imageField}</code>
          {locale ? ` (${locale})` : ""} to pick a focal point.
        </p>
        <p className="sidebar-hint">Field name: <code>{name}</code></p>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <p className="sidebar-hint">
        Pick below. Saves directly to <code>{field.apiId}</code>.
      </p>
      <FocalPointPicker
        imageUrl={imageUrl}
        position={position}
        onPositionChange={setPosition}
        onCommit={handleCommit}
      />
      {isReadOnly ? (
        <p className="sidebar-hint">Read-only view</p>
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

export default function FocalPointFieldPage() {
  return (
    <Wrapper fallback={SdkFallback}>
      <FocalPointField />
    </Wrapper>
  );
}
