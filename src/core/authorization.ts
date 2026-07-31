import { replaceOnce } from "./text-edit.js";

const file = "Telegram/ViewModels/Authorization/AuthorizationViewModel.cs";
const refreshGuard = `                if (mode != NavigationMode.Refresh)
                {
                    Delegate?.UpdateQrCodeMode(QrCodeMode.Primary);
                }`;
const authoritativeQrMode = `                // The TDLib authorization state is authoritative. A token can
                // arrive while the page is being refreshed from the phone or
                // loading panel, so always reveal the QR panel with the token.
                Delegate?.UpdateQrCodeMode(QrCodeMode.Primary);`;

export function patchAuthorizationQrRefresh(source: string): string {
  return replaceOnce(
    source,
    refreshGuard,
    authoritativeQrMode,
    "The TDLib authorization state is authoritative.",
    file,
  );
}

const tokenField = `        private string _token;`;
const transitionField = `        // Prevent the asynchronous QR-mode probe from replacing a phone
        // authorization request while TDLib is being recreated after logout.
        private bool _switchingToPhoneNumber;

        private string _token;`;

const automaticQrRequest = `                                // If auth state is not WaitPhoneNumber we force a log out to avoid AUTH_TOKEN_ALREADY_ACCEPTED
                                if (authState is not AuthorizationStateWaitPhoneNumber)
                                {
                                    Session.RequestQrCodeAuthentication(userIds);
                                }
                                else
                                {
                                    ClientService.Send(new RequestQrCodeAuthentication(userIds));
                                }`;
const guardedQrRequest = `                                var currentAuthState = ClientService.AuthorizationState;
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
                                }`;

const phoneRequest = `            Task<Object> request;
            if (ClientService.AuthorizationState is AuthorizationStateWaitOtherDeviceConfirmation)
            {
                request = Session.SetAuthenticationPhoneNumberAsync(function);
            }
            else
            {
                request = ClientService.SendAsync(function);
            }

            var response = await request;`;
const guardedPhoneRequest = `            _switchingToPhoneNumber = true;
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

export function patchAuthorizationRequestTransition(source: string): string {
  source = replaceOnce(
    source,
    tokenField,
    transitionField,
    "Prevent the asynchronous QR-mode probe",
    file,
  );
  source = replaceOnce(
    source,
    automaticQrRequest,
    guardedQrRequest,
    "var currentAuthState = ClientService.AuthorizationState;",
    file,
  );
  return replaceOnce(
    source,
    phoneRequest,
    guardedPhoneRequest,
    "_switchingToPhoneNumber = true;",
    file,
  );
}
