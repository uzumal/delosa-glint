import React from "react";
import { Card } from "@/ui/Card";
import { Button } from "@/ui/Button";
import { MousePointerClick, Crosshair, Send, ArrowRight } from "lucide-react";

const steps = [
  {
    number: 1,
    title: "トリガーを選ぶ",
    icon: MousePointerClick,
    description: "監視したいブラウザイベントの種類を選択します。",
    items: [
      { label: "page_visit", text: "特定のURLにアクセスしたとき" },
      { label: "dom_change", text: "ページ上の要素が変化したとき" },
      { label: "click", text: "指定した要素がクリックされたとき" },
      { label: "form_submit", text: "フォームが送信されたとき" },
      { label: "periodic_check", text: "一定間隔で定期的にチェック" },
    ],
  },
  {
    number: 2,
    title: "要素を選択",
    icon: Crosshair,
    description:
      "ビジュアルピッカーを使って、監視対象の要素をページ上で直接クリックして選択できます。CSSセレクターが自動生成されるので、コードを書く必要はありません。",
    items: [],
  },
  {
    number: 3,
    title: "Webhook を設定",
    icon: Send,
    description: "イベント発生時にデータを送信する先のURLを設定します。",
    items: [
      {
        label: "Generic",
        text: "JSON形式で詳細なペイロードを送信（汎用API向け）",
      },
      {
        label: "Text",
        text: "シンプルなテキストメッセージを送信（Slack・Discord向け）",
      },
    ],
  },
];

export function Onboarding() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <header className="animate-fade-in px-6 pb-16 pt-20 text-center">
        <img
          src="../icons/logo.png"
          alt="Delosa Glint"
          className="mx-auto mb-6 h-16 w-16 rounded-2xl shadow-lg"
        />
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Delosa Glint へようこそ
        </h1>
        <p className="mx-auto max-w-xl text-lg text-gray-500">
          ブラウザ上のあらゆるイベントを、ノーコードで Webhook に変換する
          Chrome 拡張機能
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* Overview */}
        <section className="animate-slide-up py-20 text-center">
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900">
            Delosa Glint とは？
          </h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-500">
            DOM の変更、ページ遷移、クリック、フォーム送信などのブラウザイベントを検知し、
            任意の Webhook エンドポイントへ自動送信します。
            プログラミング不要で、ブラウザ操作の自動化・通知を実現できます。
          </p>
        </section>

        {/* Step Guide */}
        <section className="py-20">
          <h2 className="mb-16 text-center text-4xl font-bold tracking-tight text-gray-900">
            3ステップで始める
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <Card
                  key={step.number}
                  className="!rounded-3xl !border-transparent !p-8 shadow-md transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg animate-slide-up"
                  style={{ animationDelay: `${step.number * 0.15}s` }}
                >
                  <div className="mb-5 inline-flex items-center justify-center rounded-2xl bg-gray-100 p-3">
                    <Icon className="h-6 w-6 text-gray-700" />
                  </div>
                  <p className="mb-1 text-sm font-medium text-gray-400">
                    Step {step.number}
                  </p>
                  <h3 className="mb-3 text-xl font-bold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="mb-4 text-sm leading-relaxed text-gray-500">
                    {step.description}
                  </p>
                  {step.items.length > 0 && (
                    <ul className="space-y-2">
                      {step.items.map((item) => (
                        <li
                          key={item.label}
                          className="flex items-start gap-2 text-sm"
                        >
                          <span className="shrink-0 font-medium text-gray-700">
                            {item.label}
                          </span>
                          <span className="text-gray-500">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 text-center">
          <h2 className="mb-3 text-3xl font-bold text-gray-900">
            準備ができましたか？
          </h2>
          <p className="mb-8 text-gray-500">
            ツールバーの Delosa Glint アイコンをクリックして、最初のルールを作成しましょう。
          </p>
          <Button
            onClick={() => window.close()}
            className="!rounded-full !px-8 !py-3"
          >
            最初のルールを作成する
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </section>
      </main>
    </div>
  );
}
