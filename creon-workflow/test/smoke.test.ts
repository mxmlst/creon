import { describe, expect, it } from "vitest";

import { main } from "../main";

describe("workflow package", () => {
  it("exports main()", () => {
    expect(typeof main).toBe("function");
  });
});
