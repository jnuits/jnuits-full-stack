import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NonceProvider, useNonce } from "./nonce-provider";

function TestConsumer() {
  const nonce = useNonce();
  return <div data-testid="nonce-value">{nonce ?? "no-nonce"}</div>;
}

describe("NonceProvider and useNonce", () => {
  it("provides nonce value from context to consumers", () => {
    render(
      <NonceProvider nonce="test-nonce-123">
        <TestConsumer />
      </NonceProvider>
    );

    expect(screen.getByTestId("nonce-value")).toHaveTextContent(
      "test-nonce-123"
    );
  });

  it("returns undefined when no nonce is provided", () => {
    render(
      <NonceProvider nonce={undefined}>
        <TestConsumer />
      </NonceProvider>
    );

    expect(screen.getByTestId("nonce-value")).toHaveTextContent("no-nonce");
  });
});
