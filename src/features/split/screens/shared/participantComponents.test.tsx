import { render, screen } from "@testing-library/react-native";
import { ParticipantRow } from "./participantComponents";

it("allows long participant names to wrap onto a second line", () => {
  const name = "Alexandra Catherine Smith";

  render(
    <ParticipantRow
      participant={{ name }}
      ownerName="Taylor"
      onRemove={jest.fn()}
    />,
  );

  expect(screen.getByText(name).props.numberOfLines).toBe(2);
});

