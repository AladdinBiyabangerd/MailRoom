import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Placeholder from "@tiptap/extension-placeholder";
import FontFamily from "@tiptap/extension-font-family";
import { useTranslation } from "react-i18next";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  Upload,
  List,
  ListOrdered,
  Minus,
  Palette,
  Quote,
  Redo2,
  Strikethrough,
  SubscriptIcon,
  SuperscriptIcon,
  TableIcon,
  UnderlineIcon,
  Undo2,
} from "lucide-react";
import { FontSize } from "@/lib/tiptap-font-size";
import { altFromFileName, EDITOR_IMAGE_ACCEPT, fileToEditorImageSrc } from "@/lib/editor-image";
import {
  asFullHtmlDocument,
  collapseEmbeddedImages,
  expandEmbeddedImages,
  isFullHtmlDocument,
  looksLikeHtmlSource,
  shouldUseDocumentEditor,
} from "@/lib/html-source";
import { toast } from "sonner";
import { FullHtmlCanvas, type FullHtmlCanvasHandle } from "@/components/email/FullHtmlCanvas";
import { EmailPreviewFrame } from "@/components/email/EmailPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
];

const FONT_SIZES = ["10px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px"];

const TEXT_COLORS = [
  "#000000",
  "#434343",
  "#666666",
  "#999999",
  "#b7b7b7",
  "#cc0000",
  "#e69138",
  "#f1c232",
  "#6aa84f",
  "#45818e",
  "#3c78d8",
  "#674ea7",
  "#a64d79",
];

const HIGHLIGHT_COLORS = [
  "#ffff00",
  "#ffd966",
  "#fce5cd",
  "#d9ead3",
  "#cfe2f3",
  "#d9d2e9",
  "#f4cccc",
  "#ffffff",
];

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8 shrink-0", active && "bg-accent text-accent-foreground")}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );
}

async function insertImageFiles(
  editor: Editor | null,
  files: File[],
  t: (key: string, options?: { name: string }) => string,
) {
  if (!editor) return;
  const images = files.filter((file) => file.type.startsWith("image/"));
  for (const file of images) {
    try {
      const src = await fileToEditorImageSrc(file);
      editor.chain().focus().setImage({ src, alt: altFromFileName(file.name) }).run();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "read-failed";
      if (reason === "too-large") {
        toast.error(t("emails.editor.imageTooLarge", { name: file.name }));
      } else if (reason === "not-image") {
        toast.error(t("emails.editor.imageInvalid", { name: file.name }));
      } else {
        toast.error(t("emails.editor.imageReadFailed", { name: file.name }));
      }
    }
  }
}

function ImageInsertButton({ editor }: { editor: Editor }) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("https://");

  const insertFromUrl = () => {
    const url = imageUrl.trim();
    if (!url || url === "https://") return;
    editor.chain().focus().setImage({ src: url, alt: "image" }).run();
    setImageUrl("https://");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title={t("emails.editor.image")}>
          <ImageIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3 p-3" align="start">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("emails.editor.imageUpload")}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {t("emails.editor.imageFromComputer")}
          </Button>
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
              void insertImageFiles(editor, files, t).then(() => setOpen(false));
            }}
          />
          <p className="text-xs text-muted-foreground">{t("emails.editor.imageHint")}</p>
        </div>
        <Separator />
        <div className="space-y-1.5">
          <Label htmlFor="editor-image-url" className="text-xs">
            {t("emails.editor.imageFromUrl")}
          </Label>
          <div className="flex gap-1.5">
            <Input
              id="editor-image-url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  insertFromUrl();
                }
              }}
              placeholder="https://"
              className="h-8"
            />
            <Button type="button" size="sm" className="h-8 shrink-0" onClick={insertFromUrl}>
              {t("emails.editor.imageInsert")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const { t } = useTranslation();

  const setLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t("emails.editor.linkPrompt"), previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor, t]);

  const insertTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1.5">
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title={t("emails.editor.undo")}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title={t("emails.editor.redo")}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Select
        value={editor.getAttributes("textStyle").fontFamily ?? "default"}
        onValueChange={(value) => {
          if (value === "default") {
            editor.chain().focus().unsetFontFamily().run();
          } else {
            editor.chain().focus().setFontFamily(value).run();
          }
        }}
      >
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue placeholder={t("emails.editor.fontFamily")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">{t("emails.editor.defaultFont")}</SelectItem>
          {FONT_FAMILIES.map((f) => (
            <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={editor.getAttributes("textStyle").fontSize ?? "default"}
        onValueChange={(value) => {
          if (value === "default") {
            editor.chain().focus().unsetFontSize().run();
          } else {
            editor.chain().focus().setFontSize(value).run();
          }
        }}
      >
        <SelectTrigger className="h-8 w-[72px] text-xs">
          <SelectValue placeholder={t("emails.editor.fontSize")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">{t("emails.editor.defaultSize")}</SelectItem>
          {FONT_SIZES.map((size) => (
            <SelectItem key={size} value={size}>
              {size.replace("px", "")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
        title={t("emails.editor.heading1")}
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title={t("emails.editor.heading2")}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title={t("emails.editor.heading3")}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title={t("emails.editor.bold")}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title={t("emails.editor.italic")}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title={t("emails.editor.underline")}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title={t("emails.editor.strikethrough")}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        active={editor.isActive("subscript")}
        title={t("emails.editor.subscript")}
      >
        <SubscriptIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        active={editor.isActive("superscript")}
        title={t("emails.editor.superscript")}
      >
        <SuperscriptIcon className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title={t("emails.editor.textColor")}>
            <Palette className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-6 gap-1">
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="h-6 w-6 rounded border border-border"
                style={{ backgroundColor: color }}
                title={color}
                onClick={() => editor.chain().focus().setColor(color).run()}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-xs"
            onClick={() => editor.chain().focus().unsetColor().run()}
          >
            {t("emails.editor.resetColor")}
          </Button>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title={t("emails.editor.highlight")}>
            <Highlighter className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-4 gap-1">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="h-6 w-6 rounded border border-border"
                style={{ backgroundColor: color }}
                title={color}
                onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-xs"
            onClick={() => editor.chain().focus().unsetHighlight().run()}
          >
            {t("emails.editor.resetHighlight")}
          </Button>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        title={t("emails.editor.alignLeft")}
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        title={t("emails.editor.alignCenter")}
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        title={t("emails.editor.alignRight")}
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        active={editor.isActive({ textAlign: "justify" })}
        title={t("emails.editor.alignJustify")}
      >
        <AlignJustify className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title={t("emails.editor.bulletList")}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title={t("emails.editor.orderedList")}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title={t("emails.editor.blockquote")}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        title={t("emails.editor.codeBlock")}
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton onClick={setLink} active={editor.isActive("link")} title={t("emails.editor.link")}>
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      <ImageInsertButton editor={editor} />
      <ToolbarButton onClick={insertTable} title={t("emails.editor.table")}>
        <TableIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title={t("emails.editor.horizontalRule")}
      >
        <Minus className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarButton
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title={t("emails.editor.clearFormatting")}
      >
        <Eraser className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** Always use Preview / Edit / HTML — templates must keep image drag after save. */
  layout?: "auto" | "document";
  /** Hide the in-canvas image button when the host renders it elsewhere. */
  hideDocumentImageBar?: boolean;
}

export type RichTextEditorHandle = {
  insertImages: (files: File[]) => void;
};

type EditorMode = "visual" | "html" | "preview";

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { value, onChange, placeholder, minHeight = 420, layout = "auto", hideDocumentImageBar = false },
  ref,
) {
  const { t } = useTranslation();
  const editorRef = useRef<Editor | null>(null);
  const canvasRef = useRef<FullHtmlCanvasHandle>(null);
  const pendingImages = useRef<File[] | null>(null);
  const [mode, setMode] = useState<EditorMode>("visual");
  const [htmlDraft, setHtmlDraft] = useState("");
  const embeddedImageMapRef = useRef(new Map<string, string>());
  const useDocumentEditor = layout === "document" || shouldUseDocumentEditor(value);
  const documentEditorRef = useRef(useDocumentEditor);
  documentEditorRef.current = useDocumentEditor;

  const commitHtmlDraft = useCallback(
    (draft: string) => {
      const { collapsed, map } = collapseEmbeddedImages(draft, embeddedImageMapRef.current);
      embeddedImageMapRef.current = map;
      setHtmlDraft(collapsed);
      onChange(expandEmbeddedImages(collapsed, map));
    },
    [onChange],
  );

  const applyHtmlSource = useCallback(
    (html: string) => {
      const source = html.trim();
      if (layout === "document" || isFullHtmlDocument(source) || shouldUseDocumentEditor(source)) {
        onChange(asFullHtmlDocument(source));
        setMode("visual");
        return;
      }
      const current = editorRef.current;
      if (current) {
        current.chain().focus().insertContent(source).run();
        return;
      }
      onChange(source);
    },
    [layout, onChange],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Subscript,
      Superscript,
      Placeholder.configure({
        placeholder: placeholder ?? t("emails.editor.placeholder"),
      }),
    ],
    content: useDocumentEditor ? "" : value,
    onUpdate: ({ editor: ed }) => {
      if (documentEditorRef.current) {
        return;
      }
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: "tiptap-editor-content outline-none px-4 py-3",
        style: `min-height: ${minHeight}px`,
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
          file.type.startsWith("image/"),
        );
        if (files.length) {
          event.preventDefault();
          void insertImageFiles(editorRef.current, files, t);
          return true;
        }
        const plain = event.clipboardData?.getData("text/plain") ?? "";
        if (looksLikeHtmlSource(plain)) {
          event.preventDefault();
          applyHtmlSource(plain);
          return true;
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
          file.type.startsWith("image/"),
        );
        if (!files.length) return false;
        event.preventDefault();
        void insertImageFiles(editorRef.current, files, t);
        return true;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor || mode !== "visual" || documentEditorRef.current) {
      return;
    }
    const current = editor.getHTML();
    if (value !== current && value !== (current === "<p></p>" ? "" : current)) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, mode, value]);

  const switchMode = (next: EditorMode) => {
    if (next === mode) return;
    if (next === "html") {
      const { collapsed, map } = collapseEmbeddedImages(value, embeddedImageMapRef.current);
      embeddedImageMapRef.current = map;
      setHtmlDraft(collapsed);
    } else if (mode === "html") {
      commitHtmlDraft(htmlDraft);
    }
    if (next === "visual" && !documentEditorRef.current && editor) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    setMode(next);
  };

  useImperativeHandle(ref, () => ({
    insertImages: (files: File[]) => {
      if (!documentEditorRef.current || !files.length) return;
      if (mode !== "visual" || !canvasRef.current) {
        pendingImages.current = files;
        if (mode !== "visual") switchMode("visual");
        return;
      }
      canvasRef.current.insertImages(files);
    },
  }));

  useEffect(() => {
    if (!pendingImages.current || mode !== "visual") return;
    const files = pendingImages.current;
    pendingImages.current = null;
    canvasRef.current?.insertImages(files);
  }, [mode]);

  if (!editor) return null;

  const canvasHtml = asFullHtmlDocument(value);

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex items-center justify-end gap-1 border-b bg-muted/30 px-1.5 py-1">
        {useDocumentEditor && (
          <Button
            type="button"
            size="sm"
            variant={mode === "preview" ? "secondary" : "ghost"}
            onClick={() => switchMode("preview")}
          >
            {t("emails.editor.modePreview")}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant={mode === "visual" ? "secondary" : "ghost"}
          onClick={() => switchMode("visual")}
        >
          {useDocumentEditor ? t("emails.editor.modeEdit") : t("emails.editor.modeVisual")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "html" ? "secondary" : "ghost"}
          onClick={() => switchMode("html")}
        >
          {t("emails.editor.modeHtml")}
        </Button>
      </div>
      {useDocumentEditor && mode === "preview" ? (
        <div className="p-2">
          <EmailPreviewFrame
            html={canvasHtml}
            emptyLabel={t("emails.emptyBody")}
            heightClassName="min-h-[420px] h-[min(70vh,640px)]"
          />
        </div>
      ) : useDocumentEditor && mode === "visual" ? (
        <FullHtmlCanvas
          ref={canvasRef}
          html={canvasHtml}
          onChange={onChange}
          minHeight={minHeight}
          showImageBar={!hideDocumentImageBar}
        />
      ) : mode === "visual" ? (
        <>
          <EditorToolbar editor={editor} />
          <EditorContent editor={editor} />
        </>
      ) : (
        <div className="space-y-2 p-2">
          <Textarea
            value={htmlDraft}
            onChange={(event) => commitHtmlDraft(event.target.value)}
            placeholder={placeholder ?? t("emails.editor.htmlPlaceholder")}
            className="min-h-[240px] font-mono text-xs leading-5"
            style={{ minHeight }}
            spellCheck={false}
          />
          <p className="px-1 text-xs text-muted-foreground">
            {useDocumentEditor ? t("emails.editor.documentHtmlHint") : t("emails.editor.htmlHint")}
          </p>
        </div>
      )}
    </div>
  );
});
