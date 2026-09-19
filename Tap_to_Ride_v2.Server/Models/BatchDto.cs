namespace Tap_to_Ride_v2.Server.Models
{
    
        public record TripDto(string TripId, string RiderId, int FareCents, DateTime TakenAt, string Signature);
        public record BatchDto(string BatchId, List<TripDto> Trips);
    
}
