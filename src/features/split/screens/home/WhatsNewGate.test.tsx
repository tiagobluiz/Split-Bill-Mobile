import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { LocalizationProvider } from "../../../../i18n/provider";
import { WhatsNewModal } from "./WhatsNewGate";

const mockRunAsync = jest.fn();
jest.mock("../../../../storage/database", () => ({
  withDatabaseTransaction: (operation: (db: { runAsync: typeof mockRunAsync }) => Promise<void>) => operation({ runAsync: mockRunAsync }),
}));
jest.mock("../../store", () => ({ useSplitStore: jest.fn() }));

it("keeps the Settings announcement open after a save failure and saves on retry", async () => {
  mockRunAsync.mockRejectedValueOnce(new Error("save failed")).mockResolvedValueOnce(undefined);
  const onClose = jest.fn();
  render(<LocalizationProvider language="en"><WhatsNewModal onClose={onClose} /></LocalizationProvider>);

  fireEvent.press(screen.getByText("Next"));
  fireEvent.press(screen.getByText("Next"));
  fireEvent.press(screen.getByText("Done"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save. Please try again.");
  expect(onClose).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText("Done"));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO release_announcements"), ["whats-new-seen", expect.any(String)]);
});
