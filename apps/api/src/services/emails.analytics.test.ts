import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { uniqueRecipientCount } from "./emails.js";

describe("uniqueRecipientCount", () => {
  it("counts distinct emails, not send rows", () => {
    assert.equal(
      uniqueRecipientCount([
        { email: "ada@hotel.test" },
        { email: "ada@hotel.test" },
        { email: "ada@hotel.test" },
        { email: "lin@hotel.test" },
        { email: "lin@hotel.test" },
        { email: "lin@hotel.test" },
      ]),
      2,
    );
  });

  it("treats the same address as one contact regardless of case", () => {
    assert.equal(
      uniqueRecipientCount([{ email: "Ada@Hotel.TEST" }, { email: " ada@hotel.test " }]),
      1,
    );
  });

  it("ignores empty addresses", () => {
    assert.equal(uniqueRecipientCount([{ email: "" }, { email: "ada@hotel.test" }]), 1);
  });
});
