namespace Tap_to_Ride_v2.Server.Models
{
    // TakenAt stays a string all the way through verification: it is part of the
    // signed message and must be the exact text the device sent. Binding it to
    // DateTime here would re-serialise it in a different format and break every
    // signature. BatchesController parses it only after the MAC checks out.
    public record TripDto(string TripId, string RiderId, int FareCents, string TakenAt, string Signature);
    public record BatchDto(string BatchId, string DeviceId, List<TripDto> Trips);
}
