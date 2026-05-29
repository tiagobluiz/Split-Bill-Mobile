import { StyleSheet } from "react-native";

import { commonStyles } from "./styles/common";
import { flowStyles } from "./styles/flow";
import { homeStyles } from "./styles/home";

const styleDefinitions = {
  ...commonStyles,
  ...flowStyles,
  ...homeStyles,
} as const;

export const screenStyles = StyleSheet.create(styleDefinitions);
