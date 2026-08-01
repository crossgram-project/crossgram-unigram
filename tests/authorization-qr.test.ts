import { describe, expect, it } from "vitest";

import {
  patchAuthorizationQrRefresh,
  patchAuthorizationRequestTransition,
  patchSessionAuthorizationTransition,
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

            if (ClientService.AuthorizationState is AuthorizationStateWaitPhoneNumber)
            {
                ClientService.Send(new RequestQrCodeAuthentication(null));
            }

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

    expect(patched).toContain("var currentAuthState = ClientService.AuthorizationState;");
    expect(patched).toContain("!Session.SuppressAutomaticQrAuthentication");
    expect(patched).toContain("authState is AuthorizationStateWaitPhoneNumber");
    expect(patched).toContain("currentAuthState is AuthorizationStateWaitPhoneNumber");
    expect(patched).toContain("await Session.SetAuthenticationPhoneNumberAsync(function)");
    expect(patched).toContain("Session.RequestQrCodeAuthentication(null);");
    expect(patched).not.toContain("ClientService.SendAsync(function)");
    expect(patched).not.toContain("_switchingToPhoneNumber");
    expect(patched).not.toContain("if (authState is not AuthorizationStateWaitPhoneNumber)");
  });

  it("keeps the authorization transition patch idempotent", () => {
    const once = patchAuthorizationRequestTransition(authorizationRequests);
    expect(patchAuthorizationRequestTransition(once)).toBe(once);
  });

  it("upgrades the previous ViewModel-local guard to the session-owned guard", () => {
    const legacy = `                                var currentAuthState = ClientService.AuthorizationState;
                                if (currentAuthState is AuthorizationStateWaitPhoneNumber)
                                {
                                    if (!_switchingToPhoneNumber)
                                    {
                                        ClientService.Send(new RequestQrCodeAuthentication(userIds));
                                    }
                                }
                                else if (currentAuthState is not AuthorizationStateWaitOtherDeviceConfirmation)
                                {
                                    Session.RequestQrCodeAuthentication(userIds);
                                }

        // Prevent the asynchronous QR-mode probe from replacing a phone
        // authorization request while TDLib is being recreated after logout.
        private bool _switchingToPhoneNumber;

        private string _token;

            if (ClientService.AuthorizationState is AuthorizationStateWaitPhoneNumber)
            {
                ClientService.Send(new RequestQrCodeAuthentication(null));
            }

            _switchingToPhoneNumber = true;
            Object response;
            try
            {
                Task<Object> request;
                if (ClientService.AuthorizationState is AuthorizationStateWaitOtherDeviceConfirmation)
                {
                    request = Session.SetAuthenticationPhoneNumberAsync(function);
                }
                else
                {
                    request = ClientService.SendAsync(function);
                }

                response = await request;
            }
            finally
            {
                _switchingToPhoneNumber = false;
            }`;

    const patched = patchAuthorizationRequestTransition(legacy);
    expect(patched).toContain("Session.SuppressAutomaticQrAuthentication");
    expect(patched).toContain("await Session.SetAuthenticationPhoneNumberAsync(function)");
    expect(patched).toContain("Session.RequestQrCodeAuthentication(null);");
    expect(patched).toContain("Phone/QR transition state lives in Session");
    expect(patched).toContain("private string _token;");
    expect(patched).not.toContain("_switchingToPhoneNumber");
  });
});

describe("Unigram session-owned authorization transition", () => {
  const upstream = `        Task<Object> SetAuthenticationPhoneNumberAsync(SetAuthenticationPhoneNumber function);
        void RequestQrCodeAuthentication(IList<long> otherUserIds);

        public Task<Object> SetAuthenticationPhoneNumberAsync(SetAuthenticationPhoneNumber function)
        {
            _loggingOut = false;
            _continueOnLogOut = true;
            _continueOnLogOutAction = function;
            _continueResult = new TaskCompletionSource<Object>();

            ClientService.Send(new LogOut());

            return _continueResult.Task;
        }

        public void RequestQrCodeAuthentication(IList<long> otherUserIds)
        {
            _loggingOut = false;
            _continueOnLogOut = true;
            _continueOnLogOutAction = new RequestQrCodeAuthentication(otherUserIds);
            _continueResult = new TaskCompletionSource<Object>();

            ClientService.Send(new LogOut());
        }`;

  it("keeps phone intent across ViewModel recreation and sends directly outside QR mode", () => {
    const patched = patchSessionAuthorizationTransition(upstream);

    expect(patched).toContain("bool SuppressAutomaticQrAuthentication { get; }");
    expect(patched).toContain("SuppressAutomaticQrAuthentication = true;");
    expect(patched).toContain("ClientService.AuthorizationState is not AuthorizationStateWaitOtherDeviceConfirmation");
    expect(patched).toContain("return await ClientService.SendAsync(function);");
    expect(patched).toContain("TaskCreationOptions.RunContinuationsAsynchronously");
  });

  it("lets an explicit QR request clear suppression and avoids logout from WaitPhoneNumber", () => {
    const patched = patchSessionAuthorizationTransition(upstream);

    expect(patched).toContain("SuppressAutomaticQrAuthentication = false;");
    expect(patched).toContain("ClientService.AuthorizationState is AuthorizationStateWaitPhoneNumber");
    expect(patched).toContain("ClientService.Send(new RequestQrCodeAuthentication(otherUserIds));");
    expect(patched).toContain("return;");
  });

  it("is idempotent", () => {
    const once = patchSessionAuthorizationTransition(upstream);
    expect(patchSessionAuthorizationTransition(once)).toBe(once);
  });
});
