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
