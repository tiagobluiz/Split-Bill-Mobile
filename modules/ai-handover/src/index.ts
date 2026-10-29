import { requireOptionalNativeModule } from "expo-modules-core";

export type AiHandoverProvider = "chatgpt" | "claude" | "gemini";
export type AiHandoverResult = {
  opened: boolean;
  promptPrefilled: boolean;
  imageAttached: boolean;
};

export interface AiHandoverParams {
  provider: AiHandoverProvider;
  prompt: string;
  invoicePhotoUri?: string | null;
}

const nativeModule = requireOptionalNativeModule<{
  open(params: AiHandoverParams): Promise<AiHandoverResult>;
}>("AiHandover");

export const AiHandover = {
  open: (params: AiHandoverParams) =>
    nativeModule?.open(params) ?? Promise.resolve({ opened: false, promptPrefilled: false, imageAttached: false }),
};
