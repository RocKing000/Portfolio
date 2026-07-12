using System.Text;
using System.Text.Json;
using AuditService.Infrastructure;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace AuditService.Consumers;

/// <summary>
/// Background service that consumes from the audit.events RabbitMQ queue
/// and writes each event to the immutable AuditEvents SQL table.
/// </summary>
public class AuditEventConsumer(
    IRabbitMQConsumerFactory connectionFactory,
    IAuditRepository repository,
    ILogger<AuditEventConsumer> logger
) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Yield();   // prevent blocking startup

        using var connection = connectionFactory.Create();
        using var channel    = connection.CreateModel();

        channel.BasicQos(0, 10, false);

        var consumer = new EventingBasicConsumer(channel);
        consumer.Received += async (_, ea) =>
        {
            try
            {
                var body    = Encoding.UTF8.GetString(ea.Body.ToArray());
                var payload = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(body);

                if (payload is null)
                {
                    channel.BasicNack(ea.DeliveryTag, false, false);
                    return;
                }

                var record = MapToRecord(payload);
                await repository.WriteEventAsync(record);

                channel.BasicAck(ea.DeliveryTag, false);
                logger.LogDebug("Audit event written: {EventType}", record.EventType);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to process audit event. Nacking.");
                channel.BasicNack(ea.DeliveryTag, false, requeue: true);
            }
        };

        channel.BasicConsume("audit.events", autoAck: false, consumer: consumer);
        logger.LogInformation("AuditEventConsumer listening on audit.events");

        await Task.Delay(Timeout.Infinite, stoppingToken);
    }

    private static AuditEventRecord MapToRecord(Dictionary<string, JsonElement> p)
    {
        static Guid? OptGuid(Dictionary<string, JsonElement> d, string k)
            => d.TryGetValue(k, out var v) && v.ValueKind != JsonValueKind.Null
                ? Guid.Parse(v.GetString()!) : null;

        static string? OptStr(Dictionary<string, JsonElement> d, string k)
            => d.TryGetValue(k, out var v) && v.ValueKind != JsonValueKind.Null
                ? v.GetString() : null;

        static int? OptInt(Dictionary<string, JsonElement> d, string k)
            => d.TryGetValue(k, out var v) && v.ValueKind == JsonValueKind.Number
                ? v.GetInt32() : null;

        return new AuditEventRecord(
            SessionId    : OptGuid(p, "session_id"),
            ProjectId    : OptGuid(p, "project_id"),
            EventType    : p.TryGetValue("event_type", out var et) ? et.GetString()! : "Unknown",
            Component    : OptInt(p, "component"),
            ActorType    : p.TryGetValue("actor_type", out var at) ? at.GetString()! : "System",
            ActorId      : OptStr(p, "actor_id"),
            AgentName    : OptStr(p, "agent_name"),
            Action       : p.TryGetValue("action", out var ac) ? ac.GetString()! : "",
            Details      : p.TryGetValue("details", out var det) ? det.ToString() : null,
            InputSummary : OptStr(p, "input_summary"),
            OutputSummary: OptStr(p, "output_summary"),
            IsAnonymized : true,
            OccurredAt   : DateTime.UtcNow
        );
    }
}
