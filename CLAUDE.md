# BrowserHook

## プロジェクト概要
ブラウザ上のあらゆるイベント（DOM変更、ページ遷移、クリック、フォーム送信）を
ノーコードでWebhookに変換するChrome拡張機能。

## 技術スタック
- Chrome Extension Manifest V3
- Popup UI: React 18 + TypeScript + Tailwind CSS 3.x
- Content Script: TypeScript (Vanilla DOM — 外部依存なし)
- Background: Service Worker (TypeScript)
- Build: Webpack 5 + ts-loader + PostCSS

## アーキテクチャ
- Popup (React) ↔ Service Worker (Background) ↔ Content Script (DOM)
- 設計書: 02_basic_design.md, 03_detailed_design.md を参照

## コーディング規約

### Popup UI（React）
- Tailwind CSS のみでスタイリング
- Atomic Design ベースのコンポーネント分割:
  - `popup/components/ui/` — Atoms
  - `popup/components/rules/` — ルール関連 Organisms
  - `popup/components/logs/` — ログ関連 Organisms
  - `popup/components/selector/` — 要素選択 Organisms
- 全コンポーネントで Props Interface を TypeScript で定義
- Chrome Storage操作はカスタムフック（`popup/hooks/`）に分離

### Content Script
- 外部ライブラリ依存なし（パフォーマンス最優先）
- ページDOMへの副作用は最小限
- CSS Selector生成は堅牢性重視

### Service Worker
- chrome.alarms API で定期チェック
- chrome.storage.local でルール・ログ永続化

## テスト
- ユニット: Jest + jest-chrome
- コンポーネント: React Testing Library
- E2E: Puppeteer（Phase 2）