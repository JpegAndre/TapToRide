namespace Tap_to_Ride_v2.Server.Models
{
    public class Trip
    {
        public string TripId { get; set; } = default!;
        public string BatchId { get; set; } = default!;
        public string RiderId { get; set; } = default!;
        public int FareCents { get; set; }
        public DateTime TakenAt { get; set; }
        public string Signature { get; set; } = default!;
    }
}
