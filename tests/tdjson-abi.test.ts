import { describe, expect, it } from "vitest";

import { patchTdJsonClient, patchTdJsonSerialization } from "../src/core/tdjson-abi.js";

const clientFixture = `
        private static extern unsafe void td_send(int client_id, long request_id, byte* request);
        private static extern unsafe byte* td_receive(double timeout, out int client_id, out long request_id);

            var request = ClientJson.ToJson(_writer, function);
            fixed (byte* bytes = request)
            {
                td_send(_clientId, requestId, bytes);
            }

            var ptr = td_receive(timeout, out clientId, out requestId);
            var span = new ReadOnlySpan<byte>(_buffer, 0, length);
`;

const serializationFixture = `
        public static ReadOnlySpan<byte> ToJson(ArrayPoolBufferWriter buffer, Function obj)
        {
            obj.ToJson(_writer);
        }

        public static Object FromJson(ReadOnlySpan<byte> jsonData, ClientResultHandler? handler = null)
`;

describe("standard TDLib JSON ABI patch", () => {
  it("uses the two-argument send and one-argument receive exports", () => {
    const patched = patchTdJsonClient(clientFixture);

    expect(patched).toContain("td_send(int client_id, byte* request)");
    expect(patched).toContain("td_receive(double timeout)");
    expect(patched).toContain("ClientJson.ToJson(_writer, function, requestId)");
    expect(patched).toContain("td_send(_clientId, bytes)");
    expect(patched).toContain("ClientJson.ReadRoutingMetadata(span, out clientId, out requestId)");
    expect(patched).not.toContain("td_send(int client_id, long request_id");
    expect(patched).not.toContain("td_receive(timeout, out clientId, out requestId)");
    expect(patchTdJsonClient(patched)).toBe(patched);
  });

  it("serializes numeric @extra request IDs and reads TDLib routing metadata", () => {
    const patched = patchTdJsonSerialization(serializationFixture);

    expect(patched).toContain("Function obj, long requestId = 0");
    expect(patched).toContain('_writer.WriteNumber("@extra", requestId);');
    expect(patched).toContain('reader.ValueTextEquals("@client_id"u8)');
    expect(patched).toContain('reader.ValueTextEquals("@extra"u8)');
    expect(patched).toContain("reader.TryGetInt32(out var parsedClientId)");
    expect(patched).toContain("reader.TryGetInt64(out var parsedRequestId)");
    expect(patchTdJsonSerialization(patched)).toBe(patched);
  });
});
