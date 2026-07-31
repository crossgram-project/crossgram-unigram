import { describe, expect, it } from "vitest";

import { patchAuthorizationQrRefresh } from "../src/core/authorization.js";

describe("Unigram QR authorization refresh", () => {
  const upstream = `            else if (authState is AuthorizationStateWaitOtherDeviceConfirmation waitOtherDeviceConfirmation)
            {
                Token = waitOtherDeviceConfirmation.Link;
                Delegate?.UpdateQrCode(waitOtherDeviceConfirmation.Link, firstTime);

                if (mode != NavigationMode.Refresh)
                {
                    Delegate?.UpdateQrCodeMode(QrCodeMode.Primary);
                }
            }`;

  it("makes the TDLib QR state reveal the QR panel even during navigation refresh", () => {
    const patched = patchAuthorizationQrRefresh(upstream);

    expect(patched).toContain("The TDLib authorization state is authoritative.");
    expect(patched).toContain("Delegate?.UpdateQrCodeMode(QrCodeMode.Primary);");
    expect(patched).not.toContain("mode != NavigationMode.Refresh");
  });

  it("is idempotent", () => {
    const once = patchAuthorizationQrRefresh(upstream);
    expect(patchAuthorizationQrRefresh(once)).toBe(once);
  });
});
