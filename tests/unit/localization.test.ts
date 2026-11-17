import { expect, it } from "vitest";
import { translateMessage } from "../../src/i18n/locale";
it("translates authored labels and dynamic actions without translating a personal name inside them", () => {
  expect(translateMessage("Export movie", "es")).toBe("Exportar la película");
  expect(translateMessage("Open Birthday", "es")).toBe("Abrir Birthday");
  expect(translateMessage("  Cancel  ", "es")).toBe("  Cancelar  ");
  expect(translateMessage("An unknown personal caption", "es")).toBe(
    "An unknown personal caption",
  );
  expect(translateMessage("Export movie", "en")).toBe("Export movie");
});
