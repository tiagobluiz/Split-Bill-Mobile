import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { LocalizationProvider } from "../../../../i18n/provider";
import { TagEditorModal } from "./TagEditorModal";

function createDeferred<T = boolean>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe("TagEditorModal", () => {
  it("handles rejected saves and blocks concurrent submissions", async () => {
    const save = createDeferred<boolean>();
    const onSave = jest.fn(() => save.promise);
    render(
      <TagEditorModal existingTags={[]} onSave={onSave} onCancel={jest.fn()} />,
    );

    fireEvent.changeText(screen.getByPlaceholderText("Tag name"), "Beach");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Create Tag"));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Create Tag"));
    });

    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      save.reject(new Error("offline"));
      await save.promise.catch(() => undefined);
    });

    expect(
      screen.getByText("Use a unique tag name up to 24 characters."),
    ).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Create Tag"));
    });

    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("validates duplicate built-in tag names in the active language", async () => {
    const onSave = jest.fn(async () => true);
    render(
      <LocalizationProvider language="pt" humour="plain">
        <TagEditorModal
          existingTags={[
            {
              id: "tag-restaurant",
              label: "Restaurant",
              icon: "utensils",
              color: "orange",
              builtIn: true,
            },
          ]}
          onSave={onSave}
          onCancel={jest.fn()}
        />
      </LocalizationProvider>,
    );

    fireEvent.changeText(screen.getByPlaceholderText("Nome da tag"), "Restaurante");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Criar tag"));
    });

    expect(screen.getByText("Já existe uma tag com esse nome.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
});
