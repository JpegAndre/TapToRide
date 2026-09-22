using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Tap_to_Ride_v2.Server.Security
{
    /// <summary>
    /// The wire contract for trip signatures. Every rule in here is mirrored by
    /// crypto.service.ts on the client — if one side changes, both must, and the
    /// known-answer vector in the tests is what catches it when they drift.
    /// </summary>
    public static class TripSignature
    {
        public const string Version = "v1";

        private const char FieldSeparator = '|';

        /// <summary>
        /// The exact bytes that get HMAC'd. `takenAt` is the string as it arrived on
        /// the wire and is never re-formatted from a parsed DateTime: round-tripping
        /// through DateTime changes the text and every signature would fail.
        /// </summary>
        public static string Canonical(string deviceId, string tripId, string riderId, int fareCents, string takenAt)
        {
            // The separator has no escape, so a field containing it could be shifted
            // into the next one and change the meaning of a signed message.
            foreach (var (name, value) in new[] {
                ("deviceId", deviceId), ("tripId", tripId), ("riderId", riderId), ("takenAt", takenAt) })
            {
                if (string.IsNullOrEmpty(value))
                    throw new ArgumentException($"{name} must not be empty", nameof(value));
                if (value.Contains(FieldSeparator))
                    throw new ArgumentException($"{name} must not contain '{FieldSeparator}'", nameof(value));
            }

            // Invariant culture: fareCents must render as plain digits regardless of
            // the server's locale.
            return string.Join(FieldSeparator,
                Version, deviceId, tripId, riderId, fareCents.ToString(CultureInfo.InvariantCulture), takenAt);
        }

        /// <summary>Produces the full field value: "v1.&lt;keyId&gt;.&lt;base64url mac&gt;".</summary>
        public static string Compute(byte[] secret, string keyId, string canonical)
        {
            var mac = HMACSHA256.HashData(secret, Encoding.UTF8.GetBytes(canonical));
            return $"{Version}.{keyId}.{ToBase64Url(mac)}";
        }

        /// <summary>
        /// Splits a signature field. Base64url has no '.', so the three parts are
        /// unambiguous. Returns false rather than throwing — the input is untrusted.
        /// </summary>
        public static bool TryParse(string? signature, out string keyId, out byte[] mac)
        {
            keyId = string.Empty;
            mac = [];

            if (string.IsNullOrEmpty(signature)) { return false; }

            var parts = signature.Split('.');
            if (parts.Length != 3 || parts[0] != Version || parts[1].Length == 0) { return false; }

            try
            {
                mac = FromBase64Url(parts[2]);
            }
            catch (FormatException)
            {
                return false;
            }

            keyId = parts[1];
            return mac.Length == HMACSHA256.HashSizeInBytes;
        }

        /// <summary>
        /// Reads the signed `takenAt` text into a UTC DateTime. Call this only after the
        /// MAC verifies: the string is what was signed, so this is a convenience for
        /// storage, not a validation step. Lenient on format for the same reason —
        /// the signature already pins the exact characters.
        /// </summary>
        public static bool TryParseTakenAt(string takenAt, out DateTime utc) =>
            DateTime.TryParse(takenAt, CultureInfo.InvariantCulture,
                DateTimeStyles.AdjustToUniversal, out utc);

        /// <summary>Constant-time comparison — a byte-by-byte one leaks the MAC.</summary>
        public static bool Verify(byte[] secret, string canonical, byte[] mac)
        {
            var expected = HMACSHA256.HashData(secret, Encoding.UTF8.GetBytes(canonical));
            return CryptographicOperations.FixedTimeEquals(expected, mac);
        }

        public static string ToBase64Url(byte[] bytes) =>
            Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        public static byte[] FromBase64Url(string value)
        {
            var standard = value.Replace('-', '+').Replace('_', '/');
            var padding = (4 - standard.Length % 4) % 4;
            return Convert.FromBase64String(standard.PadRight(standard.Length + padding, '='));
        }
    }
}
