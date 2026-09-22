namespace Tap_to_Ride_v2.Server.Models
{
    /// <summary>
    /// The shared secret a device signs its trips with. Handed out once at
    /// enrollment and never returned again — the server keeps the only other copy.
    /// </summary>
    public class DeviceKey
    {
        public string KeyId { get; set; } = default!;
        public string DeviceId { get; set; } = default!;
        public byte[] Secret { get; set; } = default!;
        public DateTime IssuedAt { get; set; }

        /// <summary>Set to stop accepting new trips signed with this key; existing rows stay verifiable.</summary>
        public DateTime? RevokedAt { get; set; }
    }
}
