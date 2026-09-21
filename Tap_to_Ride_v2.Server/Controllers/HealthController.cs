using Microsoft.AspNetCore.Mvc;

namespace Tap_to_Ride_v2.Server.Controllers
{
    [ApiController]
    [Route("api/health")]
    public class HealthController : ControllerBase
    {
        // Health probe to test connection to the server without touching the database
        [HttpGet]
        public IActionResult Get() => Ok(new { status = "ok" });
    }
}
