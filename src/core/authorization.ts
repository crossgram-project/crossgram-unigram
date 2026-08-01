import { replaceOnce } from "./text-edit.js";

const viewModelFile = "Telegram/ViewModels/Authorization/AuthorizationViewModel.cs";
const sessionFile = "Telegram/Services/Session.cs";

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
    viewModelFile,
  );
}

const automaticQrRequest = `                                // If auth state is not WaitPhoneNumber we force a log out to avoid AUTH_TOKEN_ALREADY_ACCEPTED
                                if (authState is not AuthorizationStateWaitPhoneNumber)
                                {
                                    Session.RequestQrCodeAuthentication(userIds);
                                }
                                else
                                {
                                    ClientService.Send(new RequestQrCodeAuthentication(userIds));
                                }`;
const guardedQrRequest = `                                // GetApplicationConfig may finish after the user has submitted a
                                // phone number or after TDLib has advanced to the code page. Only
                                // enter QR mode for the unchanged, idle phone-number state.
                                var currentAuthState = ClientService.AuthorizationState;
                                if (!Session.SuppressAutomaticQrAuthentication
                                    && authState is AuthorizationStateWaitPhoneNumber
                                    && currentAuthState is AuthorizationStateWaitPhoneNumber)
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
const sessionPhoneRequest = `            // Session owns the transition because Unigram recreates this
            // ViewModel while TDLib logs out of QR mode and initializes again.
            var response = await Session.SetAuthenticationPhoneNumberAsync(function);`;

const legacyTransitionField = `        // Prevent the asynchronous QR-mode probe from replacing a phone
        // authorization request while TDLib is being recreated after logout.
        private bool _switchingToPhoneNumber;

        private string _token;`;
const migratedTokenField = `        // Phone/QR transition state lives in Session so it survives ViewModel recreation.
        private string _token;`;
const legacyGuardedQrRequest = `                                var currentAuthState = ClientService.AuthorizationState;
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
const legacyGuardedPhoneRequest = `            _switchingToPhoneNumber = true;
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
const directQrSwitch = `            if (ClientService.AuthorizationState is AuthorizationStateWaitPhoneNumber)
            {
                ClientService.Send(new RequestQrCodeAuthentication(null));
            }`;
const sessionQrSwitch = `            if (ClientService.AuthorizationState is AuthorizationStateWaitPhoneNumber)
            {
                Session.RequestQrCodeAuthentication(null);
            }`;

export function patchAuthorizationRequestTransition(source: string): string {
  if (source.includes("_switchingToPhoneNumber")) {
    source = replaceOnce(
      source,
      legacyTransitionField,
      migratedTokenField,
      "Phone/QR transition state lives in Session",
      viewModelFile,
    );
    source = replaceOnce(
      source,
      legacyGuardedQrRequest,
      guardedQrRequest,
      "Session.SuppressAutomaticQrAuthentication",
      viewModelFile,
    );
    source = replaceOnce(
      source,
      legacyGuardedPhoneRequest,
      sessionPhoneRequest,
      "Session owns the transition",
      viewModelFile,
    );
  } else {
    source = replaceOnce(
      source,
      automaticQrRequest,
      guardedQrRequest,
      "Session.SuppressAutomaticQrAuthentication",
      viewModelFile,
    );
    source = replaceOnce(
      source,
      phoneRequest,
      sessionPhoneRequest,
      "Session owns the transition",
      viewModelFile,
    );
  }

  return replaceOnce(
    source,
    directQrSwitch,
    sessionQrSwitch,
    "Session.RequestQrCodeAuthentication(null);",
    viewModelFile,
  );
}

const sessionInterface = `        Task<Object> SetAuthenticationPhoneNumberAsync(SetAuthenticationPhoneNumber function);
        void RequestQrCodeAuthentication(IList<long> otherUserIds);`;
const guardedSessionInterface = `        bool SuppressAutomaticQrAuthentication { get; }

        Task<Object> SetAuthenticationPhoneNumberAsync(SetAuthenticationPhoneNumber function);
        void RequestQrCodeAuthentication(IList<long> otherUserIds);`;

const sessionPhoneTransition = `        public Task<Object> SetAuthenticationPhoneNumberAsync(SetAuthenticationPhoneNumber function)
        {
            _loggingOut = false;
            _continueOnLogOut = true;
            _continueOnLogOutAction = function;
            _continueResult = new TaskCompletionSource<Object>();

            ClientService.Send(new LogOut());

            return _continueResult.Task;
        }`;
const guardedSessionPhoneTransition = `        public bool SuppressAutomaticQrAuthentication { get; private set; }

        public async Task<Object> SetAuthenticationPhoneNumberAsync(SetAuthenticationPhoneNumber function)
        {
            // This flag belongs to the session, not AuthorizationViewModel: the
            // ViewModel is recreated while QR mode logs out and TDLib starts again.
            SuppressAutomaticQrAuthentication = true;

            if (ClientService.AuthorizationState is not AuthorizationStateWaitOtherDeviceConfirmation)
            {
                return await ClientService.SendAsync(function);
            }

            _loggingOut = false;
            _continueOnLogOut = true;
            _continueOnLogOutAction = function;
            _continueResult = new TaskCompletionSource<Object>(TaskCreationOptions.RunContinuationsAsynchronously);

            ClientService.Send(new LogOut());

            return await _continueResult.Task;
        }`;

const sessionQrTransition = `        public void RequestQrCodeAuthentication(IList<long> otherUserIds)
        {
            _loggingOut = false;
            _continueOnLogOut = true;
            _continueOnLogOutAction = new RequestQrCodeAuthentication(otherUserIds);
            _continueResult = new TaskCompletionSource<Object>();

            ClientService.Send(new LogOut());
        }`;
const guardedSessionQrTransition = `        public void RequestQrCodeAuthentication(IList<long> otherUserIds)
        {
            SuppressAutomaticQrAuthentication = false;

            if (ClientService.AuthorizationState is AuthorizationStateWaitPhoneNumber)
            {
                ClientService.Send(new RequestQrCodeAuthentication(otherUserIds));
                return;
            }

            _loggingOut = false;
            _continueOnLogOut = true;
            _continueOnLogOutAction = new RequestQrCodeAuthentication(otherUserIds);
            _continueResult = new TaskCompletionSource<Object>(TaskCreationOptions.RunContinuationsAsynchronously);

            ClientService.Send(new LogOut());
        }`;

export function patchSessionAuthorizationTransition(source: string): string {
  source = replaceOnce(
    source,
    sessionInterface,
    guardedSessionInterface,
    "bool SuppressAutomaticQrAuthentication { get; }",
    sessionFile,
  );
  source = replaceOnce(
    source,
    sessionPhoneTransition,
    guardedSessionPhoneTransition,
    "SuppressAutomaticQrAuthentication = true;",
    sessionFile,
  );
  return replaceOnce(
    source,
    sessionQrTransition,
    guardedSessionQrTransition,
    "SuppressAutomaticQrAuthentication = false;",
    sessionFile,
  );
}
