# Edit Dedup Fix & Test Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a comprehensive test verifying that editing a rule replaces it (no duplicates), and create a demo HTML page for manually testing DOM change detection with BrowserHook.

**Architecture:** The `StorageHelper.saveRule` logic is correct (read-modify-write with findIndex). The existing edit tests use a weak mock that returns `{}` for all `get` calls, so `saveRule` always sees an empty rules array. We add a test with proper mocking that verifies replacement. The demo page is a standalone HTML file with JavaScript that simulates price changes.

**Tech Stack:** Jest 27, ts-jest, HTML/CSS/JS (vanilla), Python http.server for serving.

---

### Task 1: Add replacement test for edit flow

**Files:**
- Modify: `tests/popup/components/wizard/CreateRuleWizard.test.tsx`

**Step 1: Write the test**

Add to the end of `tests/popup/components/wizard/CreateRuleWizard.test.tsx`:

```tsx
test("editing a rule replaces it in storage, not duplicates it", async () => {
  const existingRule: Rule = { ...editRule };

  // Mock get to return existing rules when saveRule reads them
  (chrome.storage.local.get as jest.Mock).mockImplementation((key: string) => {
    if (key === "rules") return Promise.resolve({ rules: [existingRule] });
    return Promise.resolve({});
  });

  render(<CreateRuleWizard onDone={jest.fn()} editRule={existingRule} />);
  await act(async () => {});

  // Modify name
  fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "Updated Name" } });

  // Navigate to selector step
  fireEvent.click(screen.getByText("Next"));
  // Navigate to destination step
  fireEvent.click(screen.getByText("Next"));

  await act(async () => {
    fireEvent.click(screen.getByText("Update Rule"));
  });

  // Find the set call that wrote rules
  const savedCall = (chrome.storage.local.set as jest.Mock).mock.calls.find(
    (call: any[]) => call[0].rules
  );
  expect(savedCall).toBeTruthy();

  // CRITICAL: should be exactly 1 rule (replaced), not 2 (duplicated)
  const savedRules = savedCall[0].rules;
  expect(savedRules).toHaveLength(1);
  expect(savedRules[0].id).toBe("existing-rule-id");
  expect(savedRules[0].name).toBe("Updated Name");
});
```

**Step 2: Run test to verify it passes**

Run: `npx jest tests/popup/components/wizard/CreateRuleWizard.test.tsx --verbose`
Expected: 11 tests PASS (10 existing + 1 new).

**Step 3: Commit**

```bash
git add tests/popup/components/wizard/CreateRuleWizard.test.tsx
git commit -m "test: add replacement verification for rule editing"
```

---

### Task 2: Create demo HTML page for DOM change testing

**Files:**
- Create: `demo/index.html`

**Step 1: Create the demo page**

A standalone HTML page with:
- A price element (`#price`) that auto-updates every 10 seconds
- A stock status element (`.stock-status`) that toggles
- Manual buttons to trigger changes instantly
- Instructions for testing with BrowserHook

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BrowserHook DOM Change Test Page</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #1a1a2e; }
    .product { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .product h2 { margin-top: 0; }
    #price { font-size: 2rem; font-weight: bold; color: #e63946; }
    .stock-status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 0.875rem; font-weight: 600; }
    .stock-status.in-stock { background: #d4edda; color: #155724; }
    .stock-status.out-of-stock { background: #f8d7da; color: #721c24; }
    .controls { margin: 20px 0; display: flex; gap: 8px; flex-wrap: wrap; }
    button { padding: 8px 16px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: #f8f9fa; }
    button:hover { background: #e9ecef; }
    .instructions { background: #f0f7ff; border: 1px solid #b8daff; border-radius: 8px; padding: 16px; margin: 20px 0; }
    .instructions h3 { margin-top: 0; color: #004085; }
    .instructions code { background: #e2e8f0; padding: 2px 6px; border-radius: 3px; font-size: 0.875rem; }
    .log { font-size: 0.75rem; color: #666; margin-top: 4px; }
  </style>
</head>
<body>
  <h1>BrowserHook Test Page</h1>

  <div class="instructions">
    <h3>How to test DOM change detection</h3>
    <ol>
      <li>Load the BrowserHook extension in Chrome</li>
      <li>Open the extension popup and create a new rule</li>
      <li>Set trigger to <strong>DOM Change</strong></li>
      <li>Use <strong>Pick Element</strong> to select the price (<code>#price</code>) or stock status (<code>.stock-status</code>)</li>
      <li>Set a webhook URL (use <a href="https://webhook.site" target="_blank">webhook.site</a> for testing)</li>
      <li>Save the rule, then wait for price changes or click the buttons below</li>
    </ol>
  </div>

  <div class="product">
    <h2>Example Product</h2>
    <p>Wireless Bluetooth Headphones</p>
    <div>
      <span>Price: </span><span id="price">$49.99</span>
    </div>
    <div style="margin-top: 8px;">
      <span>Status: </span><span class="stock-status in-stock" id="stock">In Stock</span>
    </div>
    <p class="log" id="change-log">Last change: none</p>
  </div>

  <div class="controls">
    <button onclick="changePrice()">Change Price</button>
    <button onclick="toggleStock()">Toggle Stock Status</button>
    <button onclick="startAutoChange()">Start Auto-Change (10s)</button>
    <button onclick="stopAutoChange()">Stop Auto-Change</button>
  </div>

  <script>
    const prices = [29.99, 39.99, 49.99, 59.99, 69.99, 79.99, 19.99, 99.99];
    let autoInterval = null;

    function changePrice() {
      const el = document.getElementById('price');
      const current = el.textContent;
      let newPrice;
      do {
        newPrice = prices[Math.floor(Math.random() * prices.length)];
      } while ('$' + newPrice.toFixed(2) === current);
      el.textContent = '$' + newPrice.toFixed(2);
      logChange('Price changed to $' + newPrice.toFixed(2));
    }

    function toggleStock() {
      const el = document.getElementById('stock');
      if (el.classList.contains('in-stock')) {
        el.classList.remove('in-stock');
        el.classList.add('out-of-stock');
        el.textContent = 'Out of Stock';
      } else {
        el.classList.remove('out-of-stock');
        el.classList.add('in-stock');
        el.textContent = 'In Stock';
      }
      logChange('Stock status toggled to: ' + el.textContent);
    }

    function startAutoChange() {
      if (autoInterval) return;
      autoInterval = setInterval(() => {
        changePrice();
      }, 10000);
      logChange('Auto-change started (every 10s)');
    }

    function stopAutoChange() {
      if (autoInterval) {
        clearInterval(autoInterval);
        autoInterval = null;
        logChange('Auto-change stopped');
      }
    }

    function logChange(msg) {
      document.getElementById('change-log').textContent = 'Last change: ' + msg + ' (' + new Date().toLocaleTimeString() + ')';
    }
  </script>
</body>
</html>
```

**Step 2: Verify it opens in browser**

Run: `python3 -m http.server 8080 -d demo &`
Then open `http://localhost:8080` in Chrome to verify the page works.

**Step 3: Commit**

```bash
git add demo/index.html
git commit -m "feat: add demo page for testing DOM change detection"
```

---

### Task 3: Full verification

**Files:** None (verification only)

**Step 1: Run all tests**

Run: `npx jest --verbose`
Expected: All tests pass.

**Step 2: Run production build**

Run: `npm run build`
Expected: webpack compiled successfully.
