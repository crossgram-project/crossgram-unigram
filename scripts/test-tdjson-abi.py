from __future__ import annotations

import argparse
import ctypes
import json
import os
from pathlib import Path
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

            print(json.dumps(response, separators=(",", ":"), sort_keys=True))
            return 0

        raise RuntimeError("TDLib did not echo numeric @extra routing metadata within 10 seconds")
    finally:
        for handle in reversed(dll_directory_handles):
            handle.close()


if __name__ == "__main__":
    raise SystemExit(main())
