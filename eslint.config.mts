// @ts-check
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";
//  @typescript-eslint/ban-ts-comment
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  {
    ignores: [
      "dist/",
      ".storybook/",
      ".config/",
      "config/",
      "scripts/",
      "node_modules/",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    plugins: {
      "@stylistic": stylistic,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
      },
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
      "@stylistic/no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0 }],
      "@stylistic/padded-blocks": ["error", "never"],
      "@stylistic/eol-last": ["error", "always"],
    },
  },

  eslintPluginPrettierRecommended,
);
