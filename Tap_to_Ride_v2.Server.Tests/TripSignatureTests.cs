using Tap_to_Ride_v2.Server.Security;

namespace Tap_to_Ride_v2.Server.Tests
{
    /// <summary>
    /// The shared known-answer vector. crypto.service.spec.ts asserts these exact
    /// strings against the TypeScript implementation — if the two canonical forms or
    /// base64url encodings ever drift apart, one of the two suites goes red instead
    /// of production going quiet.
    /// </summary>
    public class TripSignatureTests
    {
        private const string Secret = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
        private const string KeyId = "test-key";
        private const string DeviceId = "11111111-1111-4111-8111-111111111111";
        private const string TripId = "22222222-2222-4222-8222-222222222222";
        private const string RiderId = "rider-001";
        private const int FareCents = 250;
        private const string TakenAt = "2026-01-02T03:04:05.678Z";

        private const string ExpectedCanonical =
            "v1|11111111-1111-4111-8111-111111111111|22222222-2222-4222-8222-222222222222|rider-001|250|2026-01-02T03:04:05.678Z";
        private const string ExpectedSignature =
            "v1.test-key.R49Q20C6ZMdR9vdUHZO1MUHwQghRvjqDFM3fvpuuaTQ";

        private static byte[] SecretBytes => TripSignature.FromBase64Url(Secret);

        private static string Canonical(string riderId = RiderId, int fareCents = FareCents) =>
            TripSignature.Canonical(DeviceId, TripId, riderId, fareCents, TakenAt);

        [Fact]
        public void Canonical_MatchesSharedVector() =>
            Assert.Equal(ExpectedCanonical, Canonical());

        [Fact]
        public void Compute_MatchesSharedVector() =>
            Assert.Equal(ExpectedSignature, TripSignature.Compute(SecretBytes, KeyId, ExpectedCanonical));

        [Fact]
        public void Verify_AcceptsTheVector()
        {
            Assert.True(TripSignature.TryParse(ExpectedSignature, out var keyId, out var mac));
            Assert.Equal(KeyId, keyId);
            Assert.True(TripSignature.Verify(SecretBytes, ExpectedCanonical, mac));
        }

        [Fact]
        public void Verify_RejectsATamperedFare()
        {
            TripSignature.TryParse(ExpectedSignature, out _, out var mac);

            // The signature still parses and names a known key; only the fare moved.
            Assert.False(TripSignature.Verify(SecretBytes, Canonical(fareCents: 1), mac));
        }

        [Fact]
        public void Verify_RejectsADifferentKey()
        {
            TripSignature.TryParse(ExpectedSignature, out _, out var mac);
            var otherSecret = Enumerable.Range(100, 32).Select(i => (byte)i).ToArray();

            Assert.False(TripSignature.Verify(otherSecret, ExpectedCanonical, mac));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("not-a-signature")]
        [InlineData("v2.test-key.R49Q20C6ZMdR9vdUHZO1MUHwQghRvjqDFM3fvpuuaTQ")] // wrong version
        [InlineData("v1..R49Q20C6ZMdR9vdUHZO1MUHwQghRvjqDFM3fvpuuaTQ")]         // no key id
        [InlineData("v1.test-key.!!!")]                                          // not base64url
        [InlineData("v1.test-key.R49Q20C6ZMdR9vdUHZO1")]                         // truncated mac
        public void TryParse_RejectsMalformedInput(string? signature) =>
            Assert.False(TripSignature.TryParse(signature, out _, out _));

        [Theory]
        [InlineData("rider|001")] // would shift into the next field
        [InlineData("")]
        public void Canonical_RejectsUnrepresentableFields(string riderId) =>
            Assert.Throws<ArgumentException>(() => Canonical(riderId));

        [Fact]
        public void TryParseTakenAt_ReadsTheVectorAsUtc()
        {
            Assert.True(TripSignature.TryParseTakenAt(TakenAt, out var utc));

            Assert.Equal(DateTimeKind.Utc, utc.Kind);
            Assert.Equal(new DateTime(2026, 1, 2, 3, 4, 5, 678, DateTimeKind.Utc), utc);
        }

        [Theory]
        [InlineData("2026-01-02T03:04:05.678Z")]   // what Date.toISOString() emits
        [InlineData("2026-01-02T03:04:05Z")]       // no fractional part
        [InlineData("2026-01-02T05:04:05+02:00")]  // offset rather than Z
        public void TryParseTakenAt_AcceptsTheShapesADeviceCanSend(string takenAt)
        {
            Assert.True(TripSignature.TryParseTakenAt(takenAt, out var utc));
            Assert.Equal(DateTimeKind.Utc, utc.Kind);
            Assert.Equal(new DateTime(2026, 1, 2, 3, 4, 5, DateTimeKind.Utc), utc.AddTicks(-(utc.Ticks % TimeSpan.TicksPerSecond)));
        }

        [Fact]
        public void Base64Url_RoundTrips()
        {
            var bytes = SecretBytes;

            Assert.Equal(Secret, TripSignature.ToBase64Url(bytes));
            Assert.DoesNotContain('=', Secret);
        }
    }
}
