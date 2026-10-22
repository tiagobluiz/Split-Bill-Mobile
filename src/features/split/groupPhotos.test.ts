const fileSystem = {
  documentDirectory: "file:///app/",
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
};

describe("group photo ownership", () => {
  let photos: typeof import("./groupPhotos");

  beforeEach(() => {
    jest.resetModules();
    jest.doMock("expo-file-system/legacy", () => fileSystem);
    photos = require("./groupPhotos");
    jest.clearAllMocks();
    fileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
    fileSystem.copyAsync.mockResolvedValue(undefined);
    fileSystem.deleteAsync.mockResolvedValue(undefined);
  });

  it("keeps empty and already-owned URIs unchanged", async () => {
    expect(await photos.persistGroupPhoto(null)).toBeNull();
    expect(await photos.persistGroupPhoto(undefined)).toBeNull();
    expect(await photos.persistGroupPhoto("file:///app/group-photos/saved.png")).toBe("file:///app/group-photos/saved.png");
    expect(fileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    expect(fileSystem.copyAsync).not.toHaveBeenCalled();
  });

  it.each([
    ["file:///contacts/group.webp", ".webp"],
    ["content://photo/library/group.PNG?width=128", ".PNG"],
    ["file:///camera/no-extension", ".jpg"],
  ])("copies borrowed source %s into owned storage", async (source, extension) => {
    const owned = await photos.persistGroupPhoto(source);
    expect(owned).toMatch(new RegExp(`^file:///app/group-photos/.+\\${extension}$`, "i"));
    expect(fileSystem.makeDirectoryAsync).toHaveBeenCalledWith("file:///app/group-photos/", { intermediates: true });
    expect(fileSystem.copyAsync).toHaveBeenCalledWith({ from: source, to: owned });
  });

  it("never removes borrowed sources and ignores removal failures for owned photos", async () => {
    await photos.removeGroupPhoto(null);
    await photos.removeGroupPhoto("file:///contacts/source.jpg");
    expect(fileSystem.deleteAsync).not.toHaveBeenCalled();
    fileSystem.deleteAsync.mockRejectedValueOnce(new Error("already removed"));
    await expect(photos.discardTemporaryGroupPhoto("file:///app/group-photos/old.jpg")).resolves.toBeUndefined();
    expect(fileSystem.deleteAsync).toHaveBeenCalledWith("file:///app/group-photos/old.jpg", { idempotent: true });
  });

  it("preserves sources without an app document directory", async () => {
    jest.resetModules();
    jest.doMock("expo-file-system/legacy", () => ({ ...fileSystem, documentDirectory: null }));
    const withoutStorage = require("./groupPhotos") as typeof import("./groupPhotos");
    expect(await withoutStorage.persistGroupPhoto("content://photo/source.jpg")).toBe("content://photo/source.jpg");
    expect(fileSystem.copyAsync).not.toHaveBeenCalled();
  });
});
