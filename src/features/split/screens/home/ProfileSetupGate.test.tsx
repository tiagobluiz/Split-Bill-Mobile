import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { LocalizationProvider } from "../../../../i18n/provider";

const mockLaunchImageLibraryAsync = jest.fn();
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: (...args: any[]) => mockLaunchImageLibraryAsync(...args),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));
jest.mock("../../personPhotos", () => ({
  persistPersonPhoto: jest.fn(async (uri: string) => `file:///owned/${uri.split("/").pop()}`),
  discardTemporaryPersonPhoto: jest.fn(async () => undefined),
  removePersonPhoto: jest.fn(async () => undefined),
}));

const mockStoreState: any = {
  settings: { ownerName: "You", ownerProfileImageUri: "", profileSetupCompleted: false, people: [] },
  updateSettings: jest.fn(),
};

jest.mock("../../store", () => ({ useSplitStore: (selector: (state: any) => any) => selector(mockStoreState) }));

import { ProfileSetupGate } from "./ProfileSetupGate";

function renderGate() {
  return render(<LocalizationProvider language="en" humour="plain"><ProfileSetupGate /></LocalizationProvider>);
}

describe("ProfileSetupGate", () => {
  beforeEach(() => {
    mockStoreState.settings = { ownerName: "You", ownerProfileImageUri: "", profileSetupCompleted: false, people: [] };
    mockStoreState.updateSettings.mockReset();
    mockStoreState.updateSettings.mockImplementation(async (partial: any) => {
      mockStoreState.settings = { ...mockStoreState.settings, ...partial };
    });
  });

  it("requires a name, saves the optional photo choice with completion, and stays dismissed after remount", async () => {
    const first = renderGate();
    expect(screen.getByText("Welcome!")).toBeTruthy();
    fireEvent.press(screen.getByText("Let’s go"));
    expect(screen.getByRole("button", { name: "Next" }).props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Tiago"), "  Ana   Silva ");
    fireEvent.press(screen.getByText("Next"));
    expect(screen.getByText("Add a profile photo?")).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText("Skip for now")); });
    expect(mockStoreState.updateSettings).toHaveBeenCalledWith({ ownerName: "Ana Silva", ownerProfileImageUri: "", profileSetupCompleted: true });
    expect(screen.queryByText("Welcome!")).toBeNull();

    first.unmount();
    renderGate();
    expect(screen.queryByText("Welcome!")).toBeNull();
  });

  it("saves a full 25-character profile name without truncating it", async () => {
    renderGate();
    fireEvent.press(screen.getByText("Let’s go"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Tiago"), "Alexandra Catherine Smith");
    fireEvent.press(screen.getByText("Next"));
    await act(async () => { fireEvent.press(screen.getByText("Skip for now")); });
    expect(mockStoreState.updateSettings).toHaveBeenCalledWith({
      ownerName: "Alexandra Catherine Smith",
      ownerProfileImageUri: "",
      profileSetupCompleted: true,
    });
    expect(screen.queryByText("Welcome!")).toBeNull();
  });

  it("persists a selected photo with the required name and completion flag", async () => {
    mockLaunchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///picker/profile.png" }],
    });
    renderGate();
    fireEvent.press(screen.getByText("Let’s go"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Tiago"), "Ana");
    fireEvent.press(screen.getByText("Next"));
    await act(async () => { fireEvent.press(screen.getByText("Choose a photo")); });
    expect(screen.getByText("Finish setup")).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText("Finish setup")); });
    expect(mockStoreState.updateSettings).toHaveBeenCalledWith({
      ownerName: "Ana",
      ownerProfileImageUri: "file:///owned/profile.png",
      profileSetupCompleted: true,
    });
    expect(screen.queryByText("Welcome!")).toBeNull();
  });

  it("rejects an over-limit name even if input bypasses the native character cap", () => {
    renderGate();
    fireEvent.press(screen.getByText("Let’s go"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Tiago"), "A".repeat(26));
    expect(screen.getByRole("button", { name: "Next" }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("Keep participant names under 25 characters.")).toBeTruthy();
    expect(mockStoreState.updateSettings).not.toHaveBeenCalled();
  });

  it("keeps setup open and retains the name when saving fails", async () => {
    mockStoreState.updateSettings.mockRejectedValueOnce(new Error("disk full"));
    renderGate();
    fireEvent.press(screen.getByText("Let’s go"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Tiago"), "Ana");
    fireEvent.press(screen.getByText("Next"));
    await act(async () => { fireEvent.press(screen.getByText("Skip for now")); });
    expect(screen.getByText("Could not save settings")).toBeTruthy();
    expect(screen.getByText("Add a profile photo?")).toBeTruthy();
  });

  it("rejects the reserved placeholder and names already used by saved people", () => {
    mockStoreState.settings.people = [{ id: "person-ana", name: "Ana", createdAt: "2026-01-01", updatedAt: "2026-01-01" }];
    renderGate();
    fireEvent.press(screen.getByText("Let’s go"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Tiago"), "you");
    expect(screen.getByRole("button", { name: "Next" }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("Choose a name other than You.")).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Tiago"), " Ana ");
    expect(screen.getByRole("button", { name: "Next" }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("A person named Ana already exists.")).toBeTruthy();
  });

  it("migrates a custom saved name as already completed and does not show onboarding", () => {
    mockStoreState.settings = { ownerName: "Tiago", ownerProfileImageUri: "", profileSetupCompleted: true, people: [] };
    renderGate();
    expect(screen.queryByText("Welcome!")).toBeNull();
  });
});
