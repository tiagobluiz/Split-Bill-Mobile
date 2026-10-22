const mockFileSystem = { documentDirectory: "file:///app/", makeDirectoryAsync: jest.fn(), copyAsync: jest.fn(), deleteAsync: jest.fn() };

describe("person photo ownership", () => {
  let photos: typeof import("./personPhotos");
  beforeEach(() => {
    jest.resetModules();
    jest.doMock("expo-file-system/legacy", () => mockFileSystem);
    photos = require("./personPhotos");
    jest.clearAllMocks();
    mockFileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
    mockFileSystem.copyAsync.mockResolvedValue(undefined);
    mockFileSystem.deleteAsync.mockResolvedValue(undefined);
  });

  it("never deletes a borrowed contact or picker source when a draft is discarded", async () => {
    await photos.removePersonPhoto(null);
    await photos.discardTemporaryPersonPhoto("file:///contacts/source.jpg");
    await photos.discardTemporaryPersonPhoto("content://media/library/photo");
    expect(mockFileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it("copies borrowed sources into the app-owned directory and removes only owned copies", async () => {
    mockFileSystem.copyAsync.mockResolvedValue(undefined);
    const owned = await photos.persistPersonPhoto("file:///contacts/source.jpg");
    expect(owned).toMatch(/^file:\/\/\/app\/person-photos\/.+\.jpg$/);
    expect(mockFileSystem.copyAsync).toHaveBeenCalledWith({ from: "file:///contacts/source.jpg", to: owned });
    await photos.discardTemporaryPersonPhoto("file:///contacts/source.jpg");
    expect(mockFileSystem.deleteAsync).not.toHaveBeenCalled();
    await photos.removePersonPhoto(owned);
    expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(owned, { idempotent: true });
  });

  it("treats already-missing owned photos as successfully removed", async () => {
    mockFileSystem.deleteAsync.mockRejectedValueOnce(new Error("missing"));
    await expect(photos.removePersonPhoto("file:///app/person-photos/missing.jpg")).resolves.toBeUndefined();
  });

  it("keeps missing and already-owned photo URIs unchanged and uses a safe fallback extension", async () => {
    expect(await photos.persistPersonPhoto(null)).toBeNull();
    expect(await photos.persistPersonPhoto(undefined)).toBeNull();
    expect(await photos.persistPersonPhoto("file:///app/person-photos/saved.png")).toBe("file:///app/person-photos/saved.png");
    const fallback = await photos.persistPersonPhoto("content://photo/without-extension");
    expect(fallback).toMatch(/^file:\/\/\/app\/person-photos\/.+\.jpg$/);
    expect(mockFileSystem.copyAsync).toHaveBeenCalledWith({ from: "content://photo/without-extension", to: fallback });
  });

  it("preserves borrowed sources when persistent storage is unavailable", async () => {
    jest.resetModules();
    jest.doMock("expo-file-system/legacy", () => ({ ...mockFileSystem, documentDirectory: null }));
    const withoutStorage = require("./personPhotos") as typeof import("./personPhotos");
    expect(await withoutStorage.persistPersonPhoto("content://photo/source.png")).toBe("content://photo/source.png");
    expect(mockFileSystem.copyAsync).not.toHaveBeenCalled();
  });
});
