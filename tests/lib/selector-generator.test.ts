import { SelectorGenerator } from "@/lib/selector-generator";

// Mock CSS.escape since jsdom doesn't have it
if (typeof CSS === "undefined") {
  (global as any).CSS = { escape: (s: string) => s.replace(/([^\w-])/g, "\\$1") };
}

describe("SelectorGenerator.generate", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("returns id selector when element has id", () => {
    document.body.innerHTML = '<div id="price">$10</div>';
    const el = document.getElementById("price")!;
    expect(SelectorGenerator.generate(el)).toBe("#price");
  });

  test("returns data-testid selector when present", () => {
    document.body.innerHTML = '<span data-testid="total">$20</span>';
    const el = document.querySelector('[data-testid="total"]')!;
    expect(SelectorGenerator.generate(el)).toBe('[data-testid="total"]');
  });

  test("returns data-cy selector when present (no data-testid)", () => {
    document.body.innerHTML = '<span data-cy="amount">$30</span>';
    const el = document.querySelector('[data-cy="amount"]')!;
    expect(SelectorGenerator.generate(el)).toBe('[data-cy="amount"]');
  });

  test("prefers id over data-testid", () => {
    document.body.innerHTML = '<div id="main" data-testid="main-div">content</div>';
    const el = document.getElementById("main")!;
    expect(SelectorGenerator.generate(el)).toBe("#main");
  });

  test("returns tag+class selector when unique", () => {
    document.body.innerHTML = '<p class="unique-class">text</p>';
    const el = document.querySelector(".unique-class")!;
    expect(SelectorGenerator.generate(el)).toBe("p.unique-class");
  });

  test("falls back to nth-child when class not unique", () => {
    document.body.innerHTML = '<ul><li class="item">A</li><li class="item">B</li></ul>';
    const el = document.querySelectorAll(".item")[1];
    const result = SelectorGenerator.generate(el);
    // Should contain nth-child since .item is not unique
    expect(result).toContain("li");
  });

  test("builds nth-child path for deeply nested element", () => {
    document.body.innerHTML = "<div><section><p>hello</p></section></div>";
    const el = document.querySelector("p")!;
    const result = SelectorGenerator.generate(el);
    expect(result).toContain("p");
    expect(result).toContain(">");
  });
});
