const tseslint = require("typescript-eslint");

module.exports = [
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    ignores: [
      "android/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      ".expo/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      complexity: ["error", 40],
    },
  },
  {
    files: [
      "**/*.test.{ts,tsx}",
      "src/test/**/*.{ts,tsx}",
      "app/+native-intent.ts",
      "app/_layout.tsx",
      "src/features/split/screens/home/HomeScreen.tsx",
      "src/features/split/screens/flow/SplitItemScreen.tsx",
      "src/features/split/screens/shared/styles.ts",
      "src/i18n/catalog.ts",
    ],
    rules: {
      complexity: "off",
    },
  },
];
