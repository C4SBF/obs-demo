import { useRef, useState, useEffect, useMemo } from "react";
import CodeMirror, { type ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";

const readOnlyExtensions = [yaml(), EditorView.editable.of(false)];
const editableExtensions = [yaml()];

interface Props {
  value: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  autoFocus?: boolean;
}

export function YamlEditor({ value, editable = true, onChange, autoFocus }: Props) {
  const extensions = useMemo(() => editable ? editableExtensions : readOnlyExtensions, [editable]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cmProps: ReactCodeMirrorProps = {
    value,
    extensions,
    theme: oneDark,
    height: `${height}px`,
  };

  if (editable) {
    cmProps.onChange = onChange;
    cmProps.autoFocus = autoFocus;
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      {height > 0 && <CodeMirror {...cmProps} />}
    </div>
  );
}
