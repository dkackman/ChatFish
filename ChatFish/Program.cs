using ChatFish.Components;
using ChatFish.Services;
using Ganss.Xss;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

namespace ChatFish;

public class Program
{
    public static async Task Main(string[] args)
    {
        Console.WriteLine("Hello, World!");
        var builder = WebAssemblyHostBuilder.CreateDefault(args);
        builder.RootComponents.Add<App>("#app");
        builder.RootComponents.Add<HeadOutlet>("head::after");

        builder.Services
            .AddScoped<FishTankClient>()
            .AddScoped<MessageDispatcher>()
            .AddSingleton<HtmlSanitizer>()
            .AddSingleton<Animator>();

        builder.Logging
            .AddConfiguration(builder.Configuration.GetSection("Logging"))
            .SetMinimumLevel(LogLevel.Trace);

        builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
        var host = builder.Build();

        var logger = host.Services
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger<Program>();

        var baseAddress = builder.HostEnvironment.IsDevelopment() ? "https://localhost:7233/" : builder.HostEnvironment.BaseAddress;
        var fishTankClient = host.Services.GetRequiredService<FishTankClient>();

        await fishTankClient.InitializeAsync($"{baseAddress}fishhub");

        await host.RunAsync();

        logger.LogInformation("Client app started.");
    }
}
