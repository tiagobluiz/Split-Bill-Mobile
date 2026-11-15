import { enCatalog, type TranslationKey } from "./catalog/en";
import { ptCatalog } from "./catalog/pt";

export {
  SUPPORTED_LANGUAGES,
  type AppLanguage,
} from "./catalog/types";

export const translationCatalog = {
  en: enCatalog,
  pt: ptCatalog,
} as const;

export type { TranslationKey };
