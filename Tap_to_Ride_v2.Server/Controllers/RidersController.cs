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
