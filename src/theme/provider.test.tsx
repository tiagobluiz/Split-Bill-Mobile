import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

jest.mock("../../tamagui.config", () => ({}));

import { AppThemeProvider } from "./provider";

describe("AppThemeProvider", () => {
  it("renders children inside the tamagui theme wrapper", () => {
    render(
      <AppThemeProvider>
        <Text>inside theme</Text>
      </AppThemeProvider>
    );

    expect(screen.getByText("inside theme")).toBeTruthy();
  });
});
