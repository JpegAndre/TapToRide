using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;
using Tap_to_Ride_v2.Server.Models;
using Tap_to_Ride_v2.Server.Security;

namespace Tap_to_Ride_v2.Server.Controllers
{
    [ApiController]
    [Route("api/devices")]
    public class DevicesController : ControllerBase
    {
        private const int SecretBytes = 32; // HMAC-SHA-256 block-sized key

        private readonly ServerDbContext _db;

        public DevicesController(ServerDbContext db) => _db = db;

        /// <summary>
        /// Issues a device its signing key. This is the one and only time the secret
        /// crosses the wire — that exposure is inherent to a symmetric scheme, and is
        /// why the client imports it as non-extractable and never stores the raw bytes.
        /// </summary>
        [HttpPost("enroll")]
        public async Task<IActionResult> Enroll()
        {
            var secret = RandomNumberGenerator.GetBytes(SecretBytes);

            var key = new DeviceKey
            {
                KeyId = Guid.NewGuid().ToString(),
                DeviceId = Guid.NewGuid().ToString(),
                Secret = secret,
                IssuedAt = DateTime.UtcNow
            };

            _db.DeviceKeys.Add(key);
            await _db.SaveChangesAsync();

            return Ok(new
            {
                deviceId = key.DeviceId,
                keyId = key.KeyId,
                secret = TripSignature.ToBase64Url(secret)
            });
        }
    }
}
