using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tap_to_Ride_v2.Server.Models;
using Tap_to_Ride_v2.Server.Security;

namespace Tap_to_Ride_v2.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BatchesController : ControllerBase
    {
        //private const int DailyCapCents = 5000;
        private readonly ServerDbContext _db;

        public BatchesController(ServerDbContext db) => _db = db;

        [HttpPost]
        public async Task<IActionResult> Post(BatchDto dto)
        {
            if (await _db.Batches.AnyAsync(b => b.BatchId == dto.BatchId))
                return Ok(new { alreadyProcessed = true });

            // Verified up front, before anything is written. A batch is all-or-nothing:
            // the client deletes a batch only on a 2xx, so a partial accept would strand
            // the trips it silently dropped.
            var (verified, rejected) = await VerifyAsync(dto);
            if (rejected is not null)
                return BadRequest(rejected);

            await using var transaction = await _db.Database.BeginTransactionAsync();

            _db.Batches.Add(new Batch { BatchId = dto.BatchId, ReceivedAt = DateTime.UtcNow });
            _db.Trips.AddRange(verified.Select(t => new Trip
            {
                TripId = t.TripId,
                BatchId = dto.BatchId,
                RiderId = t.RiderId,
                FareCents = t.FareCents,
                TakenAt = t.TakenAt,
                Signature = t.Signature
            }));
            await _db.SaveChangesAsync();

            var affected = verified
                .Select(t => new { t.RiderId, Date = DateOnly.FromDateTime(t.TakenAt) })
                .Distinct();

            foreach (var rider in affected)
                await SettleRider(rider.RiderId, rider.Date);

            await transaction.CommitAsync();
            return Ok(new { alreadyProcessed = false, tripCount = verified.Count });
        }

        private record VerifiedTrip(string TripId, string RiderId, int FareCents, DateTime TakenAt, string Signature);

        /// <summary>
        /// Checks every trip's HMAC against the key its signature names. Returns the
        /// parsed trips on success, or a rejection describing which ones failed — never
        /// both. The reasons are deliberately coarse: the client only needs to know the
        /// batch is unsendable, and finer detail would help an attacker probe the check.
        /// </summary>
        private async Task<(List<VerifiedTrip> Verified, object? Rejected)> VerifyAsync(BatchDto dto)
        {
            var keys = await _db.DeviceKeys
                .Where(k => k.DeviceId == dto.DeviceId && k.RevokedAt == null)
                .ToDictionaryAsync(k => k.KeyId);

            var verified = new List<VerifiedTrip>(dto.Trips.Count);
            var failures = new List<string>();

            foreach (var trip in dto.Trips)
            {
                if (!TripSignature.TryParse(trip.Signature, out var keyId, out var mac) ||
                    !keys.TryGetValue(keyId, out var key))
                {
                    failures.Add(trip.TripId);
                    continue;
                }

                string canonical;
                try
                {
                    canonical = TripSignature.Canonical(
                        dto.DeviceId, trip.TripId, trip.RiderId, trip.FareCents, trip.TakenAt);
                }
                catch (ArgumentException)
                {
                    // A field the canonical form can't represent (empty, or containing
                    // the separator) could never have produced a valid signature.
                    failures.Add(trip.TripId);
                    continue;
                }

                // Parsed only now, from text whose integrity is established.
                if (!TripSignature.Verify(key.Secret, canonical, mac) ||
                    !TripSignature.TryParseTakenAt(trip.TakenAt, out var takenAt))
                {
                    failures.Add(trip.TripId);
                    continue;
                }

                verified.Add(new VerifiedTrip(trip.TripId, trip.RiderId, trip.FareCents, takenAt, trip.Signature));
            }

            return failures.Count > 0
                ? ([], new { rejected = failures, reason = "signature verification failed" })
                : (verified, null);
        }

        private async Task SettleRider(string riderId, DateOnly date)
        {
            var dayUtc = date.ToDateTime(TimeOnly.MinValue);

            var total = await _db.Trips
        .Where(t => t.RiderId == riderId && t.TakenAt.Date == dayUtc)
        .SumAsync(t => t.FareCents);
            // var capped = Math.Min(total, DailyCapCents);

            var charge = await _db.SettledCharges.SingleOrDefaultAsync(c => c.RiderId == riderId && c.Date == date);
            if (charge is null)
                _db.SettledCharges.Add(new SettledCharge { RiderId = riderId, Date = date, TotalCents = total });
            else
                charge.TotalCents = total;

            await _db.SaveChangesAsync();
        }
    }
}
