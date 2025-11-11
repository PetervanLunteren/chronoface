import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import BucketSelector from "../components/BucketSelector";

test("Bucket selector toggles value", async () => {
  const user = userEvent.setup();
  let value: "day" | "week" | "month" | "year" = "month";
  render(<BucketSelector value={value} onChange={(next) => (value = next)} />);
  await user.click(screen.getByText(/Week/i));
  expect(value).toBe("week");
});
