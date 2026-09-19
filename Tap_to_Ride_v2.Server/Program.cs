
using Microsoft.EntityFrameworkCore;
using Tap_to_Ride_v2.Server.Models;

namespace Tap_to_Ride_v2.Server
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container
            builder.Services.AddDbContext<ServerDbContext>(o => o.UseSqlite("Data Source=settlement.db"));

            builder.Services.AddControllers();
            // Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
            builder.Services.AddOpenApi();

            builder.Services.AddCors(o => o.AddPolicy("client", p =>
                p.WithOrigins("https://localhost:43536", "https://127.0.0.1:43536")
                 .AllowAnyHeader().AllowAnyMethod()));

            var app = builder.Build();

            using (var scope = app.Services.CreateScope())
                scope.ServiceProvider.GetRequiredService<ServerDbContext>().Database.EnsureCreated();

            app.UseDefaultFiles();
            app.MapStaticAssets();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
            }

            app.UseHttpsRedirection();

            app.UseCors("client");

            app.UseAuthorization();

            app.MapControllers();

            app.MapFallbackToFile("/index.html");           

            app.Run();
        }
    }
}
