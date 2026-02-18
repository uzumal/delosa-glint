export class SelectorGenerator {
  static generate(element: Element): string {
    // Priority 1: id attribute
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }

    // Priority 2: data-testid or data-cy
    const testId = element.getAttribute("data-testid") ?? element.getAttribute("data-cy");
    if (testId) {
      const attr = element.hasAttribute("data-testid") ? "data-testid" : "data-cy";
      return `[${attr}="${CSS.escape(testId)}"]`;
    }

    // Priority 3: unique class combination
    if (element.classList.length > 0) {
      const classSelector = Array.from(element.classList)
        .map((c) => `.${CSS.escape(c)}`)
        .join("");
      const tag = element.tagName.toLowerCase();
      const candidate = `${tag}${classSelector}`;
      if (document.querySelectorAll(candidate).length === 1) {
        return candidate;
      }
    }

    // Priority 4: nth-child path
    return this.buildNthChildPath(element);
  }

  private static buildNthChildPath(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.documentElement) {
      const tag = current.tagName.toLowerCase();
      const parent: Element | null = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }

      const currentTag = current.tagName;
      const siblings = Array.from(parent.children).filter(
        (el: Element) => el.tagName === currentTag,
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        parts.unshift(`${tag}:nth-child(${index})`);
      } else {
        parts.unshift(tag);
      }

      current = parent;
    }

    return parts.join(" > ");
  }
}
