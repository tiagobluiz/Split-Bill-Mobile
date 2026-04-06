import * as domain from "./index";

describe("domain barrel", () => {
  it("re-exports the public surface", () => {
    expect(domain.computeSettlement).toBeDefined();
    expect(domain.parsePastedItems).toBeDefined();
    expect(domain.buildPdfExportData).toBeDefined();
    expect(domain.buildReceiptLlmPrompt).toBeDefined();
  });
});
