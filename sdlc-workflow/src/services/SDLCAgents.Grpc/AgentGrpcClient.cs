using Grpc.Net.Client;
using SDLCAgents.Proto;

namespace SDLCAgents.Grpc;

/// <summary>
/// Typed gRPC client wrappers for each Python agent component.
/// SessionService injects these to forward synchronous calls.
/// </summary>
public interface IAgentGrpcClient
{
    Task<StartSessionResponse>      StartSessionAsync(int component, StartSessionRequest request);
    Task<SessionStatusResponse>     GetStatusAsync(int component, string sessionId);
    Task<GateDecisionResponse>      SubmitGateDecisionAsync(int component, GateDecisionRequest request);
    Task<PlanDocumentResponse>      GetPlanDocumentAsync(int component, PlanDocumentRequest request);
    Task<UploadPlanResponse>        UploadPlanDocumentAsync(int component, UploadPlanRequest request);
    Task<IterationReportResponse>   GetIterationReportAsync(IterationReportRequest request);
    Task<IterationDecisionResponse> SubmitIterationDecisionAsync(IterationDecisionRequest request);
}

public class AgentGrpcClient : IAgentGrpcClient
{
    private readonly Component1Service.Component1ServiceClient _c1;
    private readonly Component2Service.Component2ServiceClient _c2;
    private readonly Component3Service.Component3ServiceClient _c3;
    private readonly Component4Service.Component4ServiceClient _c4;

    public AgentGrpcClient(IConfiguration config)
    {
        _c1 = new Component1Service.Component1ServiceClient(
            GrpcChannel.ForAddress(config["Grpc:Component1Url"] ?? "http://agent-component1:50051"));
        _c2 = new Component2Service.Component2ServiceClient(
            GrpcChannel.ForAddress(config["Grpc:Component2Url"] ?? "http://agent-component2:50051"));
        _c3 = new Component3Service.Component3ServiceClient(
            GrpcChannel.ForAddress(config["Grpc:Component3Url"] ?? "http://agent-component3:50051"));
        _c4 = new Component4Service.Component4ServiceClient(
            GrpcChannel.ForAddress(config["Grpc:Component4Url"] ?? "http://agent-component4:50051"));
    }

    public Task<StartSessionResponse> StartSessionAsync(int component, StartSessionRequest request) =>
        component switch
        {
            1 => _c1.StartSessionAsync(request).ResponseAsync,
            2 => _c2.StartSessionAsync(request).ResponseAsync,
            3 => _c3.StartSessionAsync(request).ResponseAsync,
            4 => _c4.StartSessionAsync(request).ResponseAsync,
            _ => throw new ArgumentOutOfRangeException(nameof(component))
        };

    public Task<SessionStatusResponse> GetStatusAsync(int component, string sessionId)
    {
        var req = new SessionStatusRequest { SessionId = sessionId };
        return component switch
        {
            1 => _c1.GetSessionStatusAsync(req).ResponseAsync,
            2 => _c2.GetSessionStatusAsync(req).ResponseAsync,
            3 => _c3.GetSessionStatusAsync(req).ResponseAsync,
            4 => _c4.GetSessionStatusAsync(req).ResponseAsync,
            _ => throw new ArgumentOutOfRangeException(nameof(component))
        };
    }

    public Task<GateDecisionResponse> SubmitGateDecisionAsync(int component, GateDecisionRequest request) =>
        component switch
        {
            1 => _c1.SubmitGateDecisionAsync(request).ResponseAsync,
            2 => _c2.SubmitGateDecisionAsync(request).ResponseAsync,
            3 => _c3.SubmitGateDecisionAsync(request).ResponseAsync,
            4 => _c4.SubmitGateDecisionAsync(request).ResponseAsync,
            _ => throw new ArgumentOutOfRangeException(nameof(component))
        };

    public Task<PlanDocumentResponse> GetPlanDocumentAsync(int component, PlanDocumentRequest request) =>
        component switch
        {
            1 => _c1.GetPlanDocumentAsync(request).ResponseAsync,
            2 => _c2.GetPlanDocumentAsync(request).ResponseAsync,
            _ => throw new NotSupportedException($"Component {component} does not support GetPlanDocument")
        };

    public Task<UploadPlanResponse> UploadPlanDocumentAsync(int component, UploadPlanRequest request) =>
        component switch
        {
            1 => _c1.UploadPlanDocumentAsync(request).ResponseAsync,
            _ => throw new NotSupportedException($"Component {component} does not support UploadPlanDocument")
        };

    public Task<IterationReportResponse> GetIterationReportAsync(IterationReportRequest request) =>
        _c4.GetIterationReportAsync(request).ResponseAsync;

    public Task<IterationDecisionResponse> SubmitIterationDecisionAsync(IterationDecisionRequest request) =>
        _c4.SubmitIterationDecisionAsync(request).ResponseAsync;
}
