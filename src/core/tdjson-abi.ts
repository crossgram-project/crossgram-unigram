import { insertAfterOnce, insertBeforeOnce, replaceOnce } from "./text-edit.js";

const clientFile = "Telegram/Td/Client.cs";
const clientJsonFile = "Telegram/Td/ClientJson.cs";

export function patchTdJsonClient(source: string): string {
  source = replaceOnce(
    source,
    "        private static extern unsafe void td_send(int client_id, long request_id, byte* request);",
    "        private static extern unsafe void td_send(int client_id, byte* request);",
    "private static extern unsafe void td_send(int client_id, byte* request);",
    clientFile,
  );
  source = replaceOnce(
    source,
    "        private static extern unsafe byte* td_receive(double timeout, out int client_id, out long request_id);",
    "        private static extern unsafe byte* td_receive(double timeout);",
    "private static extern unsafe byte* td_receive(double timeout);",
    clientFile,
  );
  source = replaceOnce(
    source,
    `            var request = ClientJson.ToJson(_writer, function);
            fixed (byte* bytes = request)
            {
                td_send(_clientId, requestId, bytes);
            }`,
    `            var request = ClientJson.ToJson(_writer, function, requestId);
            fixed (byte* bytes = request)
            {
                td_send(_clientId, bytes);
            }`,
    "ClientJson.ToJson(_writer, function, requestId)",
    clientFile,
  );
  source = replaceOnce(
    source,
    "            var ptr = td_receive(timeout, out clientId, out requestId);",
    "            var ptr = td_receive(timeout);",
    "var ptr = td_receive(timeout);",
    clientFile,
  );
  return insertAfterOnce(
    source,
    "            var span = new ReadOnlySpan<byte>(_buffer, 0, length);",
    "\n\n            ClientJson.ReadRoutingMetadata(span, out clientId, out requestId);",
    "ClientJson.ReadRoutingMetadata(span, out clientId, out requestId);",
    clientFile,
  );
}

export function patchTdJsonSerialization(source: string): string {
  source = replaceOnce(
    source,
    "        public static ReadOnlySpan<byte> ToJson(ArrayPoolBufferWriter buffer, Function obj)",
    "        public static ReadOnlySpan<byte> ToJson(ArrayPoolBufferWriter buffer, Function obj, long requestId = 0)",
    "Function obj, long requestId = 0",
    clientJsonFile,
  );
  source = insertAfterOnce(
    source,
    "            obj.ToJson(_writer);",
    `
            if (requestId != 0)
            {
                _writer.WriteNumber("@extra", requestId);
            }`,
    '_writer.WriteNumber("@extra", requestId);',
    clientJsonFile,
  );
  return insertBeforeOnce(
    source,
    "        public static Object FromJson(ReadOnlySpan<byte> jsonData, ClientResultHandler? handler = null)",
    `        public static void ReadRoutingMetadata(
            ReadOnlySpan<byte> jsonData,
            out int clientId,
            out long requestId)
        {
            clientId = 0;
            requestId = 0;

            var reader = new Utf8JsonReader(jsonData);
            if (!reader.Read() || reader.TokenType != JsonTokenType.StartObject)
            {
                return;
            }

            while (reader.Read() && reader.TokenType != JsonTokenType.EndObject)
            {
                if (reader.TokenType != JsonTokenType.PropertyName)
                {
                    continue;
                }

                var isClientId = reader.ValueTextEquals("@client_id"u8);
                var isRequestId = reader.ValueTextEquals("@extra"u8);
                if (!reader.Read())
                {
                    return;
                }

                if (isClientId && reader.TokenType == JsonTokenType.Number &&
                    reader.TryGetInt32(out var parsedClientId))
                {
                    clientId = parsedClientId;
                }
                else if (isRequestId && reader.TokenType == JsonTokenType.Number &&
                    reader.TryGetInt64(out var parsedRequestId))
                {
                    requestId = parsedRequestId;
                }

                if (reader.TokenType == JsonTokenType.StartObject ||
                    reader.TokenType == JsonTokenType.StartArray)
                {
                    reader.Skip();
                }
            }
        }

`,
    "public static void ReadRoutingMetadata(",
    clientJsonFile,
  );
}
