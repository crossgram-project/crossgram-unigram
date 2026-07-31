import { describe, expect, it } from "vitest";

import {
  patchAuthorizationQrRefresh,
  patchAuthorizationRequestTransition,
} from "../src/core/authorization.js";

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

  const authorizationRequests = `                                // If auth state is not WaitPhoneNumber we force a log out to avoid AUTH_TOKEN_ALREADY_ACCEPTED
                                if (authState is not AuthorizationStateWaitPhoneNumber)
                                {
                                    Session.RequestQrCodeAuthentication(userIds);
                                }
                                else
                                {
                                    ClientService.Send(new RequestQrCodeAuthentication(userIds));
                                }

        private string _token;

            Task<Object> request;
            if (ClientService.AuthorizationState is AuthorizationStateWaitOtherDeviceConfirmation)
            {
                request = Session.SetAuthenticationPhoneNumberAsync(function);
            }
            else
            {
                request = ClientService.SendAsync(function);
            }

            var response = await request;`;

  it("keeps an in-flight phone login from being replaced by the asynchronous QR probe", () => {
    const patched = patchAuthorizationRequestTransition(authorizationRequests);

    expect(patched).toContain("private bool _switchingToPhoneNumber;");
    expect(patched).toContain("var currentAuthState = ClientService.AuthorizationState;");
    expect(patched).toContain("if (!_switchingToPhoneNumber)");
    expect(patched).toContain("_switchingToPhoneNumber = true;");
    expect(patched).toContain("finally");
    expect(patched).not.toContain("if (authState is not AuthorizationStateWaitPhoneNumber)");
  });

  it("keeps the authorization transition patch idempotent", () => {
    const once = patchAuthorizationRequestTransition(authorizationRequests);
    expect(patchAuthorizationRequestTransition(once)).toBe(once);
  });
});
