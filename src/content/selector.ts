import { SelectorGenerator } from "@/lib/selector-generator";

class ElementSelector {
  private active = false;
  private overlay: HTMLDivElement | null = null;
  private highlightedElement: Element | null = null;

  activate(): void {
    if (this.active) return;
    this.active = true;
    this.createOverlay();
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("click", this.onClick, true);
    document.addEventListener("keydown", this.onKeyDown);
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    this.removeOverlay();
    this.highlightedElement = null;
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("keydown", this.onKeyDown);
  }

  private createOverlay(): void {
    this.overlay = document.createElement("div");
    this.overlay.id = "browserhook-selector-overlay";
    this.overlay.style.cssText =
      "position:fixed;pointer-events:none;border:2px solid #4a90d9;background:rgba(74,144,217,0.1);z-index:2147483647;transition:all 0.1s ease;display:none;";
    document.body.appendChild(this.overlay);
  }

  private removeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private highlightElement(el: Element): void {
    if (!this.overlay) return;
    const rect = el.getBoundingClientRect();
    this.overlay.style.top = `${rect.top}px`;
    this.overlay.style.left = `${rect.left}px`;
    this.overlay.style.width = `${rect.width}px`;
    this.overlay.style.height = `${rect.height}px`;
    this.overlay.style.display = "block";
    this.highlightedElement = el;
  }

  private onMouseMove = (e: MouseEvent): void => {
    const target = e.target as Element;
    if (target === this.overlay) return;
    this.highlightElement(target);
  };

  private onClick = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    if (!this.highlightedElement) return;

    const selector = SelectorGenerator.generate(this.highlightedElement);
    const textContent = this.highlightedElement.textContent ?? "";
    const textPreview = textContent.trim().substring(0, 200);

    chrome.runtime.sendMessage({
      type: "ELEMENT_SELECTED",
      payload: { selector, textPreview, url: window.location.href },
    });

    this.deactivate();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      this.deactivate();
    }
  };
}

// Listen for activation messages from popup/background
const selector = new ElementSelector();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "ACTIVATE_SELECTOR") {
    selector.activate();
    sendResponse({ success: true });
  } else if (message.type === "DEACTIVATE_SELECTOR") {
    selector.deactivate();
    sendResponse({ success: true });
  }
});
