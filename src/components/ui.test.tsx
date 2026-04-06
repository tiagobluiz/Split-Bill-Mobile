import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import {
  AppScreen,
  AvatarBadge,
  EmptyState,
  FieldLabel,
  FloatingFooter,
  HeroCard,
  PrimaryButton,
  QuietButton,
  ScreenHeader,
  SecondaryButton,
  SectionCard,
  SectionEyebrow,
  SoftInput,
  StatPill,
  styles,
} from "./ui";

describe("ui primitives", () => {
  it("renders app screen with scrolling content and footer", () => {
    render(
      <AppScreen footer={<Text>footer</Text>}>
        <Text>content</Text>
      </AppScreen>
    );

    expect(screen.getByText("content")).toBeTruthy();
    expect(screen.getByText("footer")).toBeTruthy();
  });

  it("renders app screen without scroll when requested", () => {
    render(
      <AppScreen scroll={false}>
        <Text>static content</Text>
      </AppScreen>
    );

    expect(screen.getByText("static content")).toBeTruthy();
  });

  it("renders the screen header with and without optional content", () => {
    const { rerender } = render(
      <ScreenHeader title="Header" subtitle="Sub" trailing={<Text>trail</Text>} />
    );

    expect(screen.getByText("Header")).toBeTruthy();
    expect(screen.getByText("Sub")).toBeTruthy();
    expect(screen.getByText("trail")).toBeTruthy();

    rerender(<ScreenHeader title="Header only" />);
    expect(screen.getByText("Header only")).toBeTruthy();
  });

  it("renders the hero card optional sections", () => {
    const { rerender } = render(
      <HeroCard eyebrow="Eyebrow" title="Title" subtitle="Subtitle">
        <Text>child</Text>
      </HeroCard>
    );

    expect(screen.getByText("Eyebrow")).toBeTruthy();
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("Subtitle")).toBeTruthy();
    expect(screen.getByText("child")).toBeTruthy();

    rerender(<HeroCard title="Title only" />);
    expect(screen.getByText("Title only")).toBeTruthy();
  });

  it("renders section wrappers and labels", () => {
    render(
      <>
        <SectionCard>
          <Text>regular card</Text>
        </SectionCard>
        <SectionCard soft>
          <Text>soft card</Text>
        </SectionCard>
        <SectionEyebrow>Eyebrow label</SectionEyebrow>
        <FieldLabel>Field label</FieldLabel>
        <FloatingFooter>
          <Text>footer slot</Text>
        </FloatingFooter>
      </>
    );

    expect(screen.getByText("regular card")).toBeTruthy();
    expect(screen.getByText("soft card")).toBeTruthy();
    expect(screen.getByText("Eyebrow label")).toBeTruthy();
    expect(screen.getByText("Field label")).toBeTruthy();
    expect(screen.getByText("footer slot")).toBeTruthy();
  });

  it("fires primary, secondary, and quiet button callbacks and respects disabled state", () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    const onQuiet = jest.fn();

    const { rerender } = render(
      <>
        <PrimaryButton label="Primary" onPress={onPrimary} icon={<Text>icon</Text>} />
        <SecondaryButton label="Secondary" onPress={onSecondary} icon={<Text>icon</Text>} />
        <QuietButton label="Quiet" onPress={onQuiet} />
      </>
    );

    fireEvent.press(screen.getByText("Primary"));
    fireEvent.press(screen.getByText("Secondary"));
    fireEvent.press(screen.getByText("Quiet"));

    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
    expect(onQuiet).toHaveBeenCalledTimes(1);

    rerender(<PrimaryButton label="Disabled" onPress={onPrimary} disabled />);
    fireEvent.press(screen.getByText("Disabled"));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it("covers pressed-state style callbacks for pressable buttons", () => {
    const primaryStyle = (PrimaryButton({ label: "Primary" }) as any).props.style({ pressed: true });
    const secondaryStyle = (SecondaryButton({ label: "Secondary" }) as any).props.style({ pressed: true });
    const quietStyle = (QuietButton({ label: "Quiet" }) as any).props.style({ pressed: true });

    expect(primaryStyle).toEqual(expect.arrayContaining([styles.buttonPressed]));
    expect(secondaryStyle).toEqual(expect.arrayContaining([styles.buttonPressed]));
    expect(quietStyle).toEqual(expect.arrayContaining([{ opacity: 0.7 }]));
  });

  it("supports single-line and multiline input changes", () => {
    const onChangeText = jest.fn();

    const { rerender } = render(
      <SoftInput value="milk" onChangeText={onChangeText} placeholder="Item" />
    );

    fireEvent.changeText(screen.getByPlaceholderText("Item"), "bread");
    expect(onChangeText).toHaveBeenCalledWith("bread");

    rerender(
      <SoftInput
        value="line 1"
        onChangeText={onChangeText}
        placeholder="Notes"
        keyboardType="numeric"
        multiline
      />
    );

    fireEvent.changeText(screen.getByPlaceholderText("Notes"), "line 2");
    expect(onChangeText).toHaveBeenCalledWith("line 2");
  });

  it("renders avatar badges, stat pills, and empty states", () => {
    const { rerender } = render(
      <>
        <AvatarBadge label="AB" />
        <StatPill label="Drafts" value="2" />
        <EmptyState title="Nothing here" description="Start by adding a split." />
      </>
    );

    expect(screen.getByText("AB")).toBeTruthy();
    expect(screen.getByText("Drafts")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Nothing here")).toBeTruthy();
    expect(screen.getByText("Start by adding a split.")).toBeTruthy();

    rerender(
      <>
        <AvatarBadge label="CD" accent />
        <StatPill label="Settled" value="5" positive />
      </>
    );

    expect(screen.getByText("CD")).toBeTruthy();
    expect(screen.getByText("Settled")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(styles.footer.borderTopLeftRadius).toBe(28);
  });
});
