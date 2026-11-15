import { createContext, useContext, type PropsWithChildren } from "react";

import {
  setI18nRuntime,
  t,
  translateWithSettings,
  type AppLanguage,
  type TranslateOptions,
  type TranslateParams,
  type TranslationKey,
} from "./index";

type LocalizationContextValue = {
  language: AppLanguage;
  t: (
    key: TranslationKey,
    params?: TranslateParams,
    options?: TranslateOptions,
  ) => string;
};

const LocalizationContext = createContext<LocalizationContextValue>({
  language: "en",
  t,
});

export function LocalizationProvider({
  language,
  children,
}: PropsWithChildren<{ language: AppLanguage }>) {
  setI18nRuntime({ language });

  return (
    <LocalizationContext.Provider
      value={{
        language,
        t: (key, params, options) =>
          translateWithSettings({ language }, key, params, options),
      }}
    >
      {children}
    </LocalizationContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LocalizationContext);
}
