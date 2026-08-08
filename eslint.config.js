// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // servidor/ es un proyecto de Node independiente, con su propio tsconfig y sus propias
    // reglas: se verifica con `npm run verificar` dentro de esa carpeta.
    ignores: ["dist/*", "servidor/*"],
  },
  {
    // Los guiones de scripts/ corren en Node, no en React Native: sin declarar sus globales,
    // eslint marcaba Buffer y __dirname como no definidos y dejaba `eslint .` en rojo
    // permanentemente, con lo que dejaba de servir para detectar errores nuevos.
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        __dirname: "readonly",
        require: "readonly",
        module: "writable",
        process: "readonly",
      },
    },
  },
]);
