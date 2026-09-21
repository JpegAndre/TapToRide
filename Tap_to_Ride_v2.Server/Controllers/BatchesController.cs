using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tap_to_Ride_v2.Server.Models;

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

            await using var transaction = await _db.Database.BeginTransactionAsync();

            _db.Batches.Add(new Batch { BatchId = dto.BatchId, ReceivedAt = DateTime.UtcNow });
            _db.Trips.AddRange(dto.Trips.Select(t => new Trip
            {
                TripId = t.TripId,
                BatchId = dto.BatchId,
                RiderId = t.RiderId,
                FareCents = t.FareCents,
                TakenAt = t.TakenAt,
                Signature = t.Signature
            }));
            await _db.SaveChangesAsync();

            var affected = dto.Trips
                .Select(t => new { t.RiderId, Date = DateOnly.FromDateTime(t.TakenAt) })
                .Distinct();

            foreach (var rider in affected)
                await SettleRider(rider.RiderId, rider.Date);

            await transaction.CommitAsync();
            return Ok(new { alreadyProcessed = false, tripCount = dto.Trips.Count });
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
