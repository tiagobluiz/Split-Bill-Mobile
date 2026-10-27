import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import type { AppSettings } from "../../../../storage/settings";
import { removePersonPhoto } from "../../personPhotos";
import { OwnerProfileEditor } from "./OwnerProfileEditor";

const mockDetails: any = {
  name: "Ana",
  photoUri: null,
  color: "orange",
  groupIds: [],
};

jest.mock("./PersonEditor", () => ({
  PersonEditor: (props: any) => require("react").createElement(
    require("react-native").Pressable,
    { testID: "save-owner", onPress: () => void props.onSave(mockDetails) },
    require("react").createElement(require("react-native").Text, null, "Save owner"),
  ),
}));
jest.mock("../../personPhotos", () => ({
  removePersonPhoto: jest.fn(async () => undefined),
}));

function profileSettings(photoUri: string): AppSettings {
  const owner = {
    id: "owner-id",
    name: "Ana",
    photoUri: photoUri || null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  return {
    ownerName: "Ana",
    ownerPersonId: owner.id,
    ownerProfileImageUri: photoUri,
    people: [owner],
    participantGroups: [],
    balanceFeatureEnabled: true,
    trackPaymentsFeatureEnabled: true,
    defaultCurrency: "EUR",
    language: "en",
    humour: "plain",
    splitListAmountDisplay: "remaining",
    customCurrencies: [],
  };
}

describe("OwnerProfileEditor photo cleanup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetails.name = "Ana";
    mockDetails.photoUri = null;
    mockDetails.color = "orange";
    mockDetails.groupIds = [];
  });

  it("removes the previous photo after a successful removal save", async () => {
    const onSave = jest.fn(async () => undefined);
    const screen = render(<OwnerProfileEditor settings={profileSettings("file:///old.png")} records={[]} onSave={onSave} onClose={jest.fn()} />);
    await act(async () => { fireEvent.press(screen.getByTestId("save-owner")); });

    expect(onSave).toHaveBeenCalled();
    expect(removePersonPhoto).toHaveBeenCalledWith("file:///old.png");
  });

  it("keeps the current photo file when the saved photo is unchanged", async () => {
    mockDetails.photoUri = "file:///same.png";
    const onSave = jest.fn(async () => undefined);
    const screen = render(<OwnerProfileEditor settings={profileSettings("file:///same.png")} records={[]} onSave={onSave} onClose={jest.fn()} />);
    await act(async () => { fireEvent.press(screen.getByTestId("save-owner")); });

    expect(onSave).toHaveBeenCalled();
    expect(removePersonPhoto).not.toHaveBeenCalled();
  });

  it("retains the previous photo when saving fails", async () => {
    const onSave = jest.fn(async () => { throw new Error("disk full"); });
    const screen = render(<OwnerProfileEditor settings={profileSettings("file:///old.png")} records={[]} onSave={onSave} onClose={jest.fn()} />);
    await act(async () => { fireEvent.press(screen.getByTestId("save-owner")); });

    expect(removePersonPhoto).not.toHaveBeenCalled();
  });
});
