const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: {
    "service-worker": "./src/background/service-worker.ts",
    "popup/popup": "./src/popup/index.tsx",
    "content/selector": "./src/content/selector.ts",
    "content/observer": "./src/content/observer.ts",
    "options/options": "./src/options/index.tsx",
    "onboarding/onboarding": "./src/onboarding/index.tsx",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader"],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css",
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "public/manifest.json", to: "manifest.json" },
        { from: "public/icons", to: "icons", noErrorOnMissing: true },
      ],
    }),
    new HtmlWebpackPlugin({
      template: "./src/popup/popup.html",
      filename: "popup/popup.html",
      chunks: ["popup/popup"],
    }),
    new HtmlWebpackPlugin({
      template: "./src/options/options.html",
      filename: "options/options.html",
      chunks: ["options/options"],
    }),
    new HtmlWebpackPlugin({
      template: "./src/onboarding/onboarding.html",
      filename: "onboarding/onboarding.html",
      chunks: ["onboarding/onboarding"],
    }),
  ],
};
