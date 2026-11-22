import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Button } from "react-native";
import { LocalizationProvider } from "../../../../i18n/provider";
import { getUnseenAnnouncements, useWhatsNew, WhatsNewProvider } from "./WhatsNewGate";
import app from "../../../../../app.json";

const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
let mockSetupCompleted = true;
jest.mock("../../../../storage/database", () => ({
  withAppDatabaseRetry: (operation: (db: { getFirstAsync: typeof mockGetFirstAsync }) => Promise<unknown>) => operation({ getFirstAsync: mockGetFirstAsync }),
  withDatabaseTransaction: (operation: (db: { runAsync: typeof mockRunAsync }) => Promise<void>) => operation({ runAsync: mockRunAsync }),
}));
jest.mock("../../store", () => ({
  useSplitStore: (select: (state: { profileSetupCompleted: boolean }) => boolean) => select({ profileSetupCompleted: mockSetupCompleted }),
}));

function SettingsEntry() {
  const whatsNew = useWhatsNew();
  return whatsNew ? <Button title="Open from Settings" onPress={whatsNew.open} /> : null;
}

function renderAnnouncements() {
  return render(
    <LocalizationProvider language="en">
      <WhatsNewProvider><SettingsEntry /></WhatsNewProvider>
    </LocalizationProvider>,
  );
}

beforeEach(() => {
  mockRunAsync.mockReset();
  mockSetupCompleted = true;
  mockGetFirstAsync.mockReset().mockResolvedValue(null);
});

it("opens pending announcements after profile setup and respects See Later", async () => {
  mockSetupCompleted = false;
  const view = renderAnnouncements();
  await act(async () => {});
  expect(screen.queryByText("See Later")).toBeNull();
  expect(screen.queryByText("Open from Settings")).toBeNull();
  mockSetupCompleted = true;
  view.rerender(<LocalizationProvider language="en"><WhatsNewProvider><SettingsEntry /></WhatsNewProvider></LocalizationProvider>);
  fireEvent.press(await screen.findByText("See Later"));
  view.rerender(<LocalizationProvider language="en"><WhatsNewProvider><SettingsEntry /></WhatsNewProvider></LocalizationProvider>);
  expect(screen.queryByText("See Later")).toBeNull();
  expect(screen.getByText("Open from Settings")).toBeTruthy();
});

it("includes all eligible announcements in numeric order through the installed version", () => {
  const releases = ["2.10.0", "2.9.0", "2.8.0", "2.7.0", "2.12.0"].map((version) => ({
    version,
    slides: version === "2.8.0" ? [] : [version],
  }));
  expect(getUnseenAnnouncements(releases, "2.11.0", "2.7.0").flatMap(({ slides }) => slides))
    .toEqual(["2.9.0", "2.10.0"]);
  expect(getUnseenAnnouncements(releases, "2.11.0", null).map(({ version }) => version))
    .toEqual(["2.7.0", "2.9.0", "2.10.0"]);
  expect(getUnseenAnnouncements(releases, "2.11.0", "2.11.0")).toEqual([]);
  expect(getUnseenAnnouncements(releases, "2.12.0", "2.11.0").map(({ version }) => version))
    .toEqual(["2.12.0"]);
});

it("hides both entry points when the first-install marker covers the bundled announcements", async () => {
  mockGetFirstAsync.mockResolvedValue({ payload: JSON.stringify(app.expo.version) });
  renderAnnouncements();
  await act(async () => {});
  expect(screen.queryByText("1 of 3")).toBeNull();
  expect(screen.queryByText("Open from Settings")).toBeNull();
});

it("shares the deferred announcement with Settings and clears it after a successful retry", async () => {
  let savedPayload: string | undefined;
  mockGetFirstAsync.mockImplementation(async () => savedPayload ? { payload: savedPayload } : null);
  mockRunAsync.mockRejectedValueOnce(new Error("save failed")).mockImplementationOnce(async (_sql, [, payload]) => {
    savedPayload = payload;
  });
  const appView = renderAnnouncements();
  fireEvent.press(await screen.findByText("See Later"));
  expect(mockRunAsync).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("Open from Settings"));
  fireEvent.press(screen.getByRole("button", { name: "Close What’s New" }));
  expect(mockRunAsync).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("Open from Settings"));
  expect(screen.getByText("1 of 3")).toBeTruthy();

  fireEvent.press(screen.getByText("Next"));
  fireEvent.press(screen.getByText("Next"));
  fireEvent.press(screen.getByText("Done"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save. Please try again.");
  expect(screen.getByText("Done")).toBeTruthy();

  await act(async () => { fireEvent.press(screen.getByText("Done")); });
  await waitFor(() => expect(screen.queryByText("Open from Settings")).toBeNull());
  expect(screen.queryByText("Done")).toBeNull();
  expect(savedPayload).toBe(JSON.stringify("2.14.0"));
  appView.unmount();
  renderAnnouncements();
  await act(async () => {});
  expect(mockGetFirstAsync).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("See Later")).toBeNull();
});
