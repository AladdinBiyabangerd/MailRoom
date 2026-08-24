import { Node, mergeAttributes } from "@tiptap/core";
import { SALAM_PLACEHOLDER } from "@/lib/emailGreeting";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    salamPlaceholder: {
      insertSalamPlaceholder: () => ReturnType;
    };
  }
}

/** Inline atom so "{{salam}}" is not HTML-parsed or split by the visual editor. */
export const SalamPlaceholder = Node.create({
  name: "salamPlaceholder",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  parseHTML() {
    return [
      { tag: "span[data-mailroom-salam]" },
      {
        tag: "span",
        getAttrs: (el) => {
          if (typeof el === "string") return false;
          return el.textContent?.trim() === SALAM_PLACEHOLDER ? {} : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-mailroom-salam": "1",
        class: "mailroom-salam-placeholder",
      }),
      SALAM_PLACEHOLDER,
    ];
  },

  addCommands() {
    return {
      insertSalamPlaceholder:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});
