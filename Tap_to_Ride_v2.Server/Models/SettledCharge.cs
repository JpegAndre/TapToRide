namespace Tap_to_Ride_v2.Server.Models
{
    public class SettledCharge
    {
        public int Id { get; set; }
        public string RiderId { get; set; } = default!;
        public int TotalCents { get; set; }
        public DateOnly Date { get; set; }
    }
}
