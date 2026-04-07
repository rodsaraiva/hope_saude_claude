import { useState, useCallback } from 'react';

type GridSelection = {
  day: string;
  start: string;
  end: string;
};

export function useGridSelection(onSelect?: (day: string, start: string, end: string) => void) {
  const [selection, setSelection] = useState<GridSelection | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((day: string, time: string) => {
    setSelection({ day, start: time, end: time });
    setIsDragging(true);
  }, []);

  const handleMouseEnter = useCallback(
    (day: string, time: string) => {
      if (isDragging && selection && day === selection.day) {
        setSelection((prev) => (prev ? { ...prev, end: time } : null));
      }
    },
    [isDragging, selection],
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging && selection) {
      if (onSelect) {
        const [hStart] = selection.start.split(':').map(Number);
        const [hEnd] = selection.end.split(':').map(Number);

        if (hStart > hEnd) {
          onSelect(selection.day, selection.end, selection.start);
        } else {
          onSelect(selection.day, selection.start, selection.end);
        }
      }
    }
    setSelection(null);
    setIsDragging(false);
  }, [isDragging, selection, onSelect]);

  return {
    selection,
    isDragging,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
  };
}
