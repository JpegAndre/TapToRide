using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tap_to_Ride_v2.Server.Models;

namespace Tap_to_Ride_v2.Server.Controllers
{
    [ApiController]
    [Route("api/riders")]
    public class RidersController : ControllerBase
    {
        private readonly ServerDbContext _db;
        public RidersController(ServerDbContext db) => _db = db;

        // Today's settled charges for every rider that has any. The rows themselves
        // are the roster — a rider with no fares today simply isn't in the result.
        [HttpGet("charges")]
        public async Task<IActionResult> GetCharges()
        {
            var date = DateOnly.FromDateTime(DateTime.UtcNow);
            return Ok(await _db.SettledCharges
                .Where(c => c.Date == date)
                .OrderBy(c => c.RiderId)
                .ToListAsync());
        }

        [HttpGet("{riderId}/charge")]
        public async Task<IActionResult> GetCharge(string riderId)
        {
            var date = DateOnly.FromDateTime(DateTime.UtcNow);
            var charge = await _db.SettledCharges.SingleOrDefaultAsync(c => c.RiderId == riderId && c.Date == date);
            return charge is null ? NotFound() : Ok(charge);
        }

        [HttpGet("{riderId}/trips")]
        public async Task<IActionResult> GetTrips(string riderId) =>
            Ok(await _db.Trips.Where(t => t.RiderId == riderId).ToListAsync());
    }
}
