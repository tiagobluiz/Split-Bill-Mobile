import { createContext, useContext, useEffect, type PropsWithChildren } from "react";

import {
  setI18nRuntime,
  t,
  translateWithSettings,
  type AppHumour,
  type AppLanguage,
  type TranslateOptions,
  type TranslateParams,
  type TranslationKey,
} from "./index";

type LocalizationContextValue = {
  language: AppLanguage;
  humour: AppHumour;
  t: (
    key: TranslationKey,
    params?: TranslateParams,
    options?: TranslateOptions,
  ) => string;
};

const LocalizationContext = createContext<LocalizationContextValue>({
  language: "en",
  humour: "plain",
  t,
});

export function LocalizationProvider({
  language,
  humour,
  children,
}: PropsWithChildren<{ language: AppLanguage; humour: AppHumour }>) {
  useEffect(() => {
    setI18nRuntime({ language, humour });
  }, [humour, language]);

  return (
    <LocalizationContext.Provider
      value={{
        language,
        humour,
        t: (key, params, options) =>
          translateWithSettings({ language, humour }, key, params, options),
      }}
    >
      {children}
    </LocalizationContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LocalizationContext);
}
