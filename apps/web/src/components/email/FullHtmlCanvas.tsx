import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, Upload } from "lucide-react";
import { toast } from "sonner";
import { altFromFileName, EDITOR_IMAGE_ACCEPT, fileToEditorImageSrc } from "@/lib/editor-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function serializeDocument(doc: Document): string {
  const clone = doc.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("style[data-mailroom-editor]").forEach((node) => node.remove());
  clone.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));
  const name = doc.doctype?.name ?? "html";
  return `<!DOCTYPE ${name}>\n${clone.outerHTML}`;
}

function rangeFromPoint(doc: Document, clientX: number, clientY: number): Range | null {
  const withCaret = doc as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (withCaret.caretRangeFromPoint) {
    return withCaret.caretRangeFromPoint(clientX, clientY);
  }
  const position = withCaret.caretPositionFromPoint?.(clientX, clientY);
  if (!position) return null;
  const range = doc.createRange();
  range.setStart(position.offsetNode, position.offset);
  range.collapse(true);
  return range;
}

function isNodeInside(node: Node | null, ancestor: Node): boolean {
  let current = node;
  while (current) {
    if (current === ancestor) return true;
    current = current.parentNode;
  }
  return false;
}

function moveImage(doc: Document, image: HTMLImageElement, clientX: number, clientY: number): boolean {
  const range = rangeFromPoint(doc, clientX, clientY);
  if (!range || isNodeInside(range.startContainer, image)) {
    return false;
  }
  const marker = doc.createTextNode("");
  range.insertNode(marker);
  image.remove();
  marker.parentNode?.insertBefore(image, marker);
  marker.remove();
  return true;
}

function placeImage(doc: Document, src: string, alt: string, range: Range | null) {
  const image = doc.createElement("img");
  image.setAttribute("src", src);
  image.setAttribute("alt", alt);
  image.setAttribute("width", "620");
  image.setAttribute("draggable", "false");
  image.style.maxWidth = "100%";
  image.style.height = "auto";
  image.style.display = "block";
  image.style.border = "0";
  const target = range ?? doc.createRange();
  if (!range) {
    const body = doc.body;
    target.selectNodeContents(body);
    target.collapse(false);
  }
  target.insertNode(image);
  const after = doc.createRange();
  after.setStartAfter(image);
  after.collapse(true);
  doc.getSelection()?.removeAllRanges();
  doc.getSelection()?.addRange(after);
}

function isHtmlImage(node: EventTarget | null): node is HTMLImageElement {
  return !!node && (node as Node).nodeName === "IMG";
}

function isFileDrag(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export type FullHtmlCanvasHandle = {
  insertImages: (files: File[]) => void;
};

export const FullHtmlCanvas = forwardRef<
  FullHtmlCanvasHandle,
  {
    html: string;
    onChange: (html: string) => void;
    minHeight: number;
    showImageBar?: boolean;
  }
>(function FullHtmlCanvas({ html, onChange, minHeight, showImageBar = true }, ref) {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appliedHtml = useRef<string | null>(null);
  const lastRange = useRef<Range | null>(null);
  const pendingInsert = useRef<File[] | null>(null);
  const tRef = useRef(t);
  const onChangeRef = useRef(onChange);
  tRef.current = t;
  onChangeRef.current = onChange;

  const emit = useCallback((doc: Document) => {
    const next = serializeDocument(doc);
    appliedHtml.current = next;
    onChangeRef.current(next);
  }, []);

  const insertFiles = useCallback(
    async (files: File[], range: Range | null) => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const images = files.filter((file) => file.type.startsWith("image/"));
      let insertRange = range;
      for (const file of images) {
        try {
          const src = await fileToEditorImageSrc(file);
          placeImage(doc, src, altFromFileName(file.name), insertRange);
          insertRange = null;
        } catch (error) {
          const reason = error instanceof Error ? error.message : "read-failed";
          const translate = tRef.current;
          if (reason === "too-large") {
            toast.error(translate("emails.editor.imageTooLarge", { name: file.name }));
          } else if (reason === "not-image") {
            toast.error(translate("emails.editor.imageInvalid", { name: file.name }));
          } else {
            toast.error(translate("emails.editor.imageReadFailed", { name: file.name }));
          }
        }
      }
      emit(doc);
    },
    [emit],
  );

  useImperativeHandle(
    ref,
    () => ({
      insertImages: (files: File[]) => {
        const doc = iframeRef.current?.contentDocument;
        if (!doc?.body) {
          pendingInsert.current = files;
          return;
        }
        void insertFiles(files, lastRange.current);
      },
    }),
    [insertFiles],
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const bind = () => {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;

      doc.body.setAttribute("contenteditable", "true");
      if (!doc.head.querySelector("style[data-mailroom-editor]")) {
        const style = doc.createElement("style");
        style.setAttribute("data-mailroom-editor", "");
        style.textContent =
          "img { cursor: grab; user-select: none; -webkit-user-drag: none; } img[data-mailroom-dragging] { cursor: grabbing; opacity: 0.55; }";
        doc.head.appendChild(style);
      }
      doc.querySelectorAll("img").forEach((img) => img.setAttribute("draggable", "false"));

      let drag: { image: HTMLImageElement; x: number; y: number } | null = null;

      const rememberRange = () => {
        const selection = doc.getSelection();
        if (selection && selection.rangeCount > 0) {
          lastRange.current = selection.getRangeAt(0).cloneRange();
        }
      };

      const onInput = () => emit(doc);
      const onDragOver = (event: DragEvent) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      };
      const onDrop = (event: DragEvent) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
          file.type.startsWith("image/"),
        );
        if (!files.length) return;
        event.preventDefault();
        const range = rangeFromPoint(doc, event.clientX, event.clientY);
        void insertFiles(files, range);
      };
      const onPaste = (event: ClipboardEvent) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
          file.type.startsWith("image/"),
        );
        if (!files.length) return;
        event.preventDefault();
        void insertFiles(files, lastRange.current);
      };
      const onMouseDown = (event: MouseEvent) => {
        const target = event.target;
        if (!isHtmlImage(target)) return;
        drag = { image: target, x: event.clientX, y: event.clientY };
        target.setAttribute("data-mailroom-dragging", "");
        event.preventDefault();
      };
      const onMouseUp = (event: MouseEvent) => {
        if (!drag) return;
        const { image, x, y } = drag;
        drag = null;
        image.removeAttribute("data-mailroom-dragging");
        const distSq = (event.clientX - x) ** 2 + (event.clientY - y) ** 2;
        if (distSq < 64) return;
        if (moveImage(doc, image, event.clientX, event.clientY)) {
          emit(doc);
        }
      };

      doc.addEventListener("mousedown", onMouseDown, true);
      doc.addEventListener("mouseup", rememberRange);
      doc.addEventListener("mouseup", onMouseUp);
      doc.addEventListener("keyup", rememberRange);
      doc.addEventListener("input", onInput);
      doc.addEventListener("drop", onDrop, true);
      doc.addEventListener("dragover", onDragOver, true);
      doc.addEventListener("paste", onPaste);

      if (pendingInsert.current) {
        const files = pendingInsert.current;
        pendingInsert.current = null;
        void insertFiles(files, lastRange.current);
      }
    };

    iframe.addEventListener("load", bind);
    if (appliedHtml.current !== html) {
      appliedHtml.current = html;
      iframe.srcdoc = html;
    }
    return () => iframe.removeEventListener("load", bind);
  }, [emit, html, insertFiles]);

  return (
    <div className={cn("p-2", showImageBar && "space-y-2")}>
      {showImageBar ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={EDITOR_IMAGE_ACCEPT}
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (!files.length) return;
              void insertFiles(files, lastRange.current);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {t("emails.editor.documentImageAdd")}
            </Button>
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
              {t("emails.editor.documentEditHint")}
            </p>
          </div>
        </>
      ) : null}
      <iframe
        ref={iframeRef}
        title="email-html-edit"
        sandbox="allow-same-origin"
        className="w-full rounded-md border bg-white"
        style={{ minHeight }}
      />
    </div>
  );
});
