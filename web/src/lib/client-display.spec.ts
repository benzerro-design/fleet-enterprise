import {
  clientLabelNeedsPrefix,
  formatClientDisplay,
  formatClientHeaderParts,
} from "./client-display";

describe("formatClientDisplay", () => {
  it("dedupes when code equals legal name", () => {
    expect(formatClientDisplay("Client Alpha", "Client Alpha")).toBe("Client Alpha");
  });

  it("keeps both when different", () => {
    expect(formatClientDisplay("ALPHA", "Client Alpha SRL")).toBe("ALPHA — Client Alpha SRL");
  });

  it("is case-insensitive for equality", () => {
    expect(formatClientDisplay("Client Alpha", "client alpha")).toBe("Client Alpha");
  });
});

describe("formatClientHeaderParts", () => {
  it("omits secondary when names match", () => {
    expect(formatClientHeaderParts("Client Alpha", "Client Alpha")).toEqual({
      primary: "Client Alpha",
      secondary: null,
    });
  });

  it("keeps paren when different", () => {
    expect(formatClientHeaderParts("ALPHA", "Client Alpha")).toEqual({
      primary: "ALPHA",
      secondary: "Client Alpha",
    });
  });
});

describe("clientLabelNeedsPrefix", () => {
  it("skips prefix when name already starts with Client", () => {
    expect(clientLabelNeedsPrefix("Client Alpha")).toBe(false);
    expect(clientLabelNeedsPrefix("client alpha srl")).toBe(false);
  });

  it("keeps prefix for short codes", () => {
    expect(clientLabelNeedsPrefix("ALPHA")).toBe(true);
    expect(clientLabelNeedsPrefix("ACME")).toBe(true);
  });
});
