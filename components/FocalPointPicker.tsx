import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampFocalPoint,
  type FocalPoint,
} from "@/lib/focal-point";

type Props = {
  imageUrl: string;
  position: FocalPoint;
  onPositionChange: (position: FocalPoint) => void;
  onCommit: (position: FocalPoint) => void;
};

function percent(value: number, total: number) {
  return (value / total) * 100;
}

function fromPercent(percent: number, total: number) {
  return (percent / 100) * total;
}

export function FocalPointPicker({
  imageUrl,
  position,
  onPositionChange,
  onCommit,
}: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const dragging = useRef(false);
  const latest = useRef(position);
  const [layoutKey, setLayoutKey] = useState(0);

  const refreshLayout = useCallback(() => {
    setLayoutKey((key) => key + 1);
  }, []);

  useEffect(() => {
    latest.current = position;
  }, [position]);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const rect = imageRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const next = clampFocalPoint(
        percent(clientX - rect.x, rect.width),
        percent(clientY - rect.y, rect.height),
      );
      latest.current = next;
      onPositionChange(next);
    },
    [onPositionChange],
  );

  const onPointerDown = (event: React.PointerEvent) => {
    dragging.current = true;
    updateFromPointer(event.clientX, event.clientY);
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragging.current) {
        return;
      }
      updateFromPointer(event.clientX, event.clientY);
    };

    const onUp = () => {
      if (!dragging.current) {
        return;
      }
      dragging.current = false;
      onCommit(latest.current);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onCommit, updateFromPointer]);

  const rect = imageRef.current?.getBoundingClientRect();
  void layoutKey;
  const dotLeft = rect
    ? fromPercent(position.x, rect.width) - 8
    : "calc(50% - 8px)";
  const dotTop = rect
    ? fromPercent(position.y, rect.height) - 8
    : "calc(50% - 8px)";

  return (
    <div className="picker">
      <div className="picker-image" onPointerDown={onPointerDown}>
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Pick focal point"
          draggable={false}
          onLoad={refreshLayout}
        />
        <span
          className="picker-dot"
          style={{ left: dotLeft, top: dotTop }}
        />
      </div>
      <p className="picker-coords">{JSON.stringify(position)}</p>
    </div>
  );
}
