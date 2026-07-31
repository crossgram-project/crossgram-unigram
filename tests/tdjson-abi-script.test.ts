import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("TDLib JSON ABI runtime smoke test", () => {
  it("calls the standard exports and verifies numeric routing metadata", async () => {
    const script = await readFile(path.resolve("scripts/test-tdjson-abi.py"), "utf8");

    expect(script).toContain("tdjson.td_send.argtypes = [ctypes.c_int, ctypes.c_char_p]");
    expect(script).toContain("tdjson.td_receive.argtypes = [ctypes.c_double]");
    expect(script).toContain('"@extra": request_id');
    expect(script).toContain('response.get("@client_id") != client_id');
    expect(script).toContain('response.get("@type") != "optionValueString"');
    expect(script).toContain("TDLib did not echo numeric @extra routing metadata");
    expect(script).toContain('"name": "x_crossgram_server_configuration"');
    expect(script).toContain('"@type": "setTdlibParameters"');
    expect(script).toContain("Sending both without awaiting the first response");
    expect(script).toContain("TDLib did not acknowledge queued startup requests");
  });
});
