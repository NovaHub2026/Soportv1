import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import Page from "./page";

test("renders the home page", () => {
  render(<Page />);
  expect(screen.getByRole("main")).toBeDefined();
});
