import { createI18n } from "vue-i18n";
import zh from "./zh.js";
import en from "./en.js";

export const i18n = createI18n({
  legacy: false, // Composition API 模式
  locale: localStorage.getItem("mapleak-lang") ?? "zh",
  fallbackLocale: "zh",
  messages: { zh, en },
});
