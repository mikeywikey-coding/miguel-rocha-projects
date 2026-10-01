import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "projects/build-lab/research/**",
      "projects/workout-tracker/app/media/**",
    ],
  },
  js.configs.recommended,
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
    },
  },
  {
    files: [
      "eslint.config.js",
      "**/*.config.{js,mjs}",
      "projects/build-lab/tests/**",
      "extensions/tests/**",
      "projects/workout-tracker/tests/**",
    ],
    languageOptions: { globals: globals.node },
  },
  {
    // Playwright evaluates some callbacks inside the page.
    files: ["projects/build-lab/tests/ui/**"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["projects/build-lab/**/*.{js,jsx}"],
    ignores: ["projects/build-lab/tests/**", "projects/build-lab/*.config.{js,mjs}"],
    ...react.configs.flat.recommended,
    ...react.configs.flat["jsx-runtime"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: globals.browser,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off",
    },
  },
  {
    files: ["projects/workout-tracker/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["projects/workout-tracker/app/sw.js"],
    languageOptions: { sourceType: "script", globals: globals.serviceworker },
  },
  {
    files: ["projects/job-compass/web/**/*.js"],
    languageOptions: { sourceType: "script", globals: globals.browser },
  },
  {
    // The companion's scripts share top-level functions through one global scope:
    // the popup loads them with script tags and the service worker with importScripts.
    files: ["projects/job-compass/extension/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        ...globals.webextensions,
        fillForm: "readonly",
        registerDiscovery: "readonly",
        sameApplication: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { vars: "local", argsIgnorePattern: "^_", caughtErrors: "none" }],
      "no-redeclare": ["error", { builtinGlobals: false }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["projects/job-compass/tests/**/*.cjs"],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
  },
  {
    files: ["projects/pc-remote/web/**/*.js"],
    languageOptions: { sourceType: "script", globals: globals.browser },
  },
  {
    files: ["extensions/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser, ...globals.webextensions },
    },
  },
  {
    files: ["extensions/*/background.js"],
    languageOptions: { globals: { ...globals.serviceworker, ...globals.webextensions } },
  },
  prettier,
];
