from __future__ import annotations

import argparse
import ctypes
import json
import os
from pathlib import Path
import tempfile
import time


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify the standard two-argument TDLib JSON ABI and routing metadata."
    )
    parser.add_argument("--tdjson", required=True, type=Path)
    parser.add_argument(
        "--dll-directory",
        action="append",
        default=[],
        type=Path,
        help="Additional Windows DLL search directory (repeatable).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    tdjson_path = args.tdjson.resolve(strict=True)
    search_directories = [tdjson_path.parent, *(path.resolve(strict=True) for path in args.dll_directory)]
    dll_directory_handles = [os.add_dll_directory(str(path)) for path in search_directories]

    try:
        tdjson = ctypes.CDLL(str(tdjson_path))
        tdjson.td_create_client_id.argtypes = []
        tdjson.td_create_client_id.restype = ctypes.c_int
        tdjson.td_send.argtypes = [ctypes.c_int, ctypes.c_char_p]
        tdjson.td_send.restype = None
        tdjson.td_receive.argtypes = [ctypes.c_double]
        tdjson.td_receive.restype = ctypes.c_char_p

        client_id = tdjson.td_create_client_id()
        request_id = 4_246_842_468
        request = json.dumps(
            {"@type": "getOption", "name": "version", "@extra": request_id},
            separators=(",", ":"),
        ).encode("utf-8")
        tdjson.td_send(client_id, request)

        deadline = time.monotonic() + 10.0
        version_response = None
        while time.monotonic() < deadline:
            response_pointer = tdjson.td_receive(0.5)
            if not response_pointer:
                continue

            response = json.loads(response_pointer.decode("utf-8"))
            if response.get("@extra") != request_id:
                continue
            if response.get("@client_id") != client_id:
                raise RuntimeError(
                    f"TDLib returned @client_id={response.get('@client_id')!r}, expected {client_id}"
                )
            if response.get("@type") != "optionValueString":
                raise RuntimeError(
                    f"TDLib returned @type={response.get('@type')!r}, expected optionValueString"
                )

            version_response = response
            break

        if version_response is None:
            raise RuntimeError("TDLib did not echo numeric @extra routing metadata within 10 seconds")

        option_request_id = request_id + 1
        parameters_request_id = request_id + 2
        with tempfile.TemporaryDirectory(prefix="crossgram-unigram-tdlib-") as state_root:
            option_request = {
                "@type": "setOption",
                "name": "x_crossgram_server_configuration",
                "value": {"@type": "optionValueEmpty"},
                "@extra": option_request_id,
            }
            parameters_request = {
                "@type": "setTdlibParameters",
                "use_test_dc": False,
                "database_directory": str(Path(state_root, "db")),
                "files_directory": str(Path(state_root, "files")),
                "database_encryption_key": "",
                "use_file_database": False,
                "use_chat_info_database": False,
                "use_message_database": False,
                "use_secret_chats": False,
                "api_id": 1,
                "api_hash": "crossgram-runtime-smoke-test",
                "system_language_code": "en",
                "device_model": "Crossgram CI",
                "system_version": "Windows",
                "application_version": "runtime-smoke-test",
                "@extra": parameters_request_id,
            }

            # TDLib acknowledges the pre-init option only after parameters are queued.
            # Sending both without awaiting the first response is the startup contract
            # exercised by Unigram's ClientService patch.
            tdjson.td_send(
                client_id,
                json.dumps(option_request, separators=(",", ":")).encode("utf-8"),
            )
            tdjson.td_send(
                client_id,
                json.dumps(parameters_request, separators=(",", ":")).encode("utf-8"),
            )

            pending = {option_request_id, parameters_request_id}
            deadline = time.monotonic() + 15.0
            while pending and time.monotonic() < deadline:
                response_pointer = tdjson.td_receive(0.5)
                if not response_pointer:
                    continue
                response = json.loads(response_pointer.decode("utf-8"))
                response_id = response.get("@extra")
                if response_id not in pending:
                    continue
                if response.get("@client_id") != client_id:
                    raise RuntimeError(
                        f"TDLib returned @client_id={response.get('@client_id')!r}, expected {client_id}"
                    )
                if response.get("@type") != "ok":
                    raise RuntimeError(
                        f"TDLib returned {response!r} for startup request {response_id}"
                    )
                pending.remove(response_id)

            if pending:
                raise RuntimeError(
                    f"TDLib did not acknowledge queued startup requests within 15 seconds: {sorted(pending)}"
                )

        print(
            json.dumps(
                {
                    "client_id": client_id,
                    "routing_metadata": "ok",
                    "queued_startup_requests": "ok",
                },
                separators=(",", ":"),
                sort_keys=True,
            )
        )
        return 0
    finally:
        for handle in reversed(dll_directory_handles):
            handle.close()


if __name__ == "__main__":
    raise SystemExit(main())
