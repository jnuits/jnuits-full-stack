import { describe, expect, it } from "vitest";

import { toAnswers } from "@/components/forms/public-form-screen";
import { phoneDialControlName } from "@/lib/forms/control-names";
import { parseFormDefinition, validateFormAnswers } from "@/lib/forms/definition";

const definition = parseFormDefinition({
  fields: [{ id: "phone", label: "Phone number", required: false, type: "telephone" }],
  payment: { enabled: false },
});

function submittedPhone(national: string, dial = "+880") {
  const data = new FormData();

  data.set("phone", national);
  data.set(phoneDialControlName("phone"), dial);

  return data;
}

describe("public telephone answer composition", () => {
  it("stores the picked dial code and national number as one canonical answer", () => {
    const answers = toAnswers(submittedPhone("01712-345678"), definition);

    expect(answers).toEqual({ phone: "+8801712345678" });
    expect(validateFormAnswers(definition, answers)).toEqual({ phone: "+8801712345678" });
  });

  it("omits an untouched optional telephone question", () => {
    expect(toAnswers(submittedPhone(""), definition)).toEqual({});
  });

  it("does not silently delete mixed letters before authoritative validation", () => {
    const answers = toAnswers(submittedPhone("1712abc345678"), definition);

    expect(answers).toEqual({ phone: "+8801712abc345678" });
    expect(() => validateFormAnswers(definition, answers)).toThrow(
      /Phone number: Enter the number with its country code/
    );
  });
});
