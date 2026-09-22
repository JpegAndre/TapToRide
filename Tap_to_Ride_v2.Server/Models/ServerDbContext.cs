using Microsoft.EntityFrameworkCore;
using Tap_to_Ride_v2.Server.Models;

namespace Tap_to_Ride_v2.Server.Models
{
    public class ServerDbContext(DbContextOptions<ServerDbContext> options) : DbContext(options)
    {
        public DbSet<Trip> Trips => Set<Trip>();
        public DbSet<Batch> Batches => Set<Batch>();
        public DbSet<SettledCharge> SettledCharges => Set<SettledCharge>();
        public DbSet<DeviceKey> DeviceKeys => Set<DeviceKey>();

        protected override void OnModelCreating(ModelBuilder b)
        {
            b.Entity<Trip>().HasKey(t => t.TripId);
            b.Entity<Batch>().HasKey(x => x.BatchId);
            b.Entity<DeviceKey>().HasKey(k => k.KeyId);
            b.Entity<DeviceKey>().HasIndex(k => k.DeviceId);
        }
    }

}
