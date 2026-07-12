-- =============================================================================
-- SDLC Automation Suite — Audit & Event Tables
-- Script: 002_audit_tables.sql
-- =============================================================================

SET NOCOUNT ON;
GO

-- ---------------------------------------------------------------------------
-- AUDIT EVENTS (immutable append-only log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[AuditEvents] (
    [Id]           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [SessionId]    UNIQUEIDENTIFIER NULL,
    [ProjectId]    UNIQUEIDENTIFIER NULL,
    [EventType]    NVARCHAR(50)     NOT NULL,
    -- EventType values: AgentAction, PlanVersion, ClientApproval, LLMCall,
    --                   ConflictDecision, SystemEvent, ReviewDecision, ModeChange
    [Component]    TINYINT          NULL,
    [ActorType]    NVARCHAR(20)     NOT NULL CHECK ([ActorType] IN ('Agent','User','System')),
    [ActorId]      NVARCHAR(255)    NULL,
    [AgentName]    NVARCHAR(100)    NULL,
    [Action]       NVARCHAR(500)    NOT NULL,
    [Details]      NVARCHAR(MAX)    NULL,
    [InputSummary] NVARCHAR(MAX)    NULL,
    [OutputSummary] NVARCHAR(MAX)   NULL,
    [IsAnonymized] BIT              NOT NULL DEFAULT 1,
    [OccurredAt]   DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_AuditEvents] PRIMARY KEY ([Id])
);
GO

-- Audit is append-only — no UPDATE/DELETE triggers
CREATE TRIGGER [trg_AuditEvents_NoUpdate]
ON [dbo].[AuditEvents]
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    RAISERROR('Audit events are immutable and cannot be modified or deleted.', 16, 1);
    ROLLBACK;
END;
GO

-- ---------------------------------------------------------------------------
-- AGENT ACTIONS (detailed per-step agent log)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[AgentActions] (
    [Id]           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [SessionId]    UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Sessions]([Id]),
    [Component]    TINYINT          NOT NULL,
    [AgentName]    NVARCHAR(100)    NOT NULL,
    [ActionType]   NVARCHAR(50)     NOT NULL,
    [Status]       NVARCHAR(20)     NOT NULL DEFAULT 'Running'
                    CHECK ([Status] IN ('Running','Completed','Failed','Skipped')),
    [IterationNumber] INT           NOT NULL DEFAULT 1,
    [InputMinioKey]   NVARCHAR(1000) NULL,
    [OutputMinioKey]  NVARCHAR(1000) NULL,
    [ErrorDetails]    NVARCHAR(MAX)  NULL,
    [StartedAt]    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    [CompletedAt]  DATETIME2        NULL,
    [DurationMs]   INT              NULL,
    CONSTRAINT [PK_AgentActions] PRIMARY KEY ([Id])
);
GO

-- ---------------------------------------------------------------------------
-- COMPONENT 1 — REQUIREMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[Requirements] (
    [Id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [SessionId]       UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Sessions]([Id]),
    [ProjectId]       UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Projects]([Id]),
    [RequirementType] NVARCHAR(30)     NOT NULL
                        CHECK ([RequirementType] IN ('Functional','NonFunctional','Constraint','Assumption')),
    [USGESlot]        NVARCHAR(5)      NULL CHECK ([USGESlot] IN ('K','I','S',NULL)),
    [Title]           NVARCHAR(500)    NOT NULL,
    [Description]     NVARCHAR(MAX)    NOT NULL,
    [Priority]        NVARCHAR(20)     NOT NULL CHECK ([Priority] IN ('MustHave','ShouldHave','CouldHave','WontHave')),
    [SourceData]      NVARCHAR(MAX)    NULL,
    [GoalServed]      NVARCHAR(MAX)    NULL,
    [DerivationBasis] NVARCHAR(MAX)    NULL,
    [Status]          NVARCHAR(20)     NOT NULL DEFAULT 'Draft'
                        CHECK ([Status] IN ('Draft','Approved','Rejected','Superseded')),
    [ApprovedByUserId] UNIQUEIDENTIFIER NULL REFERENCES [dbo].[Users]([Id]),
    [ApprovedAt]      DATETIME2        NULL,
    [CreatedAt]       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Requirements] PRIMARY KEY ([Id])
);
GO

CREATE TABLE IF NOT EXISTS [dbo].[Assumptions] (
    [Id]            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [SessionId]     UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Sessions]([Id]),
    [Component]     TINYINT          NOT NULL,
    [AgentName]     NVARCHAR(100)    NOT NULL,
    [Description]   NVARCHAR(MAX)    NOT NULL,
    [Basis]         NVARCHAR(MAX)    NULL,
    [ConfidenceScore] DECIMAL(5,2)   NULL,
    [ClientConfirmed] BIT            NOT NULL DEFAULT 0,
    [ConfirmedByUserId] UNIQUEIDENTIFIER NULL REFERENCES [dbo].[Users]([Id]),
    [ConfirmedAt]   DATETIME2        NULL,
    [CreatedAt]     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Assumptions] PRIMARY KEY ([Id])
);
GO

-- ---------------------------------------------------------------------------
-- COMPONENT 2 — DESIGN ARTIFACTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[DesignArtifacts] (
    [Id]            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [SessionId]     UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Sessions]([Id]),
    [ProjectId]     UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Projects]([Id]),
    [Track]         NVARCHAR(30)     NOT NULL
                      CHECK ([Track] IN ('Research','TechnicalDesign','UIUXDesign')),
    [ArtifactType]  NVARCHAR(100)    NOT NULL,
    [Title]         NVARCHAR(500)    NOT NULL,
    [MinioKey]      NVARCHAR(1000)   NULL,
    [FigmaUrl]      NVARCHAR(2000)   NULL,
    [Status]        NVARCHAR(20)     NOT NULL DEFAULT 'Draft'
                      CHECK ([Status] IN ('Draft','InternalReview','Approved','Rejected')),
    [VersionNumber] INT              NOT NULL DEFAULT 1,
    [CreatedAt]     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_DesignArtifacts] PRIMARY KEY ([Id])
);
GO

-- ---------------------------------------------------------------------------
-- COMPONENT 3 — MODULE SPECIFICATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[ModuleSpecifications] (
    [Id]            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [SessionId]     UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Sessions]([Id]),
    [ProjectId]     UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Projects]([Id]),
    [Layer]         NVARCHAR(30)     NOT NULL
                      CHECK ([Layer] IN ('Database','Backend','Frontend','AIML','Integration')),
    [ModuleName]    NVARCHAR(255)    NOT NULL,
    [ModulePurpose] NVARCHAR(MAX)    NULL,
    [SpecMinioKey]  NVARCHAR(1000)   NULL,
    [CodeMinioKey]  NVARCHAR(1000)   NULL,
    [AssignedTo]    NVARCHAR(255)    NULL,
    [AssignedType]  NVARCHAR(20)     NULL CHECK ([AssignedType] IN ('Developer','CodeAgent',NULL)),
    [SpecReviewRequired] BIT         NOT NULL DEFAULT 0,
    [CodeReviewRequired] BIT         NOT NULL DEFAULT 0,
    [CodeGenerationApproved] BIT     NULL,
    [Status]        NVARCHAR(30)     NOT NULL DEFAULT 'SpecPending'
                      CHECK ([Status] IN ('SpecPending','SpecInReview','SpecApproved',
                                         'CodePending','CodeGenerating','CodeInReview',
                                         'Complete')),
    [CreatedAt]     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ModuleSpecifications] PRIMARY KEY ([Id])
);
GO

-- ---------------------------------------------------------------------------
-- COMPONENT 4 — TEST ITERATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[TestIterations] (
    [Id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [SessionId]       UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Sessions]([Id]),
    [TestTrack]       NVARCHAR(20)     NOT NULL
                        CHECK ([TestTrack] IN ('Unit','Integration','System','Performance','Security')),
    [IterationNumber] INT              NOT NULL,
    [ScenariosGenerated] INT           NOT NULL DEFAULT 0,
    [ScenariosPassed]    INT           NOT NULL DEFAULT 0,
    [ScenariosFailed]   INT            NOT NULL DEFAULT 0,
    [FixesApplied]      INT            NOT NULL DEFAULT 0,
    [FixesRejected]     INT            NOT NULL DEFAULT 0,
    [RegressionsFound]  INT            NOT NULL DEFAULT 0,
    [UnfixedIssues]     INT            NOT NULL DEFAULT 0,
    [ReportMinioKey]  NVARCHAR(1000)   NULL,
    [Status]          NVARCHAR(20)     NOT NULL DEFAULT 'Running'
                        CHECK ([Status] IN ('Running','Complete','AbandonedByClient')),
    [StartedAt]       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    [CompletedAt]     DATETIME2        NULL,
    CONSTRAINT [PK_TestIterations] PRIMARY KEY ([Id])
);
GO

CREATE TABLE IF NOT EXISTS [dbo].[UnfixedIssues] (
    [Id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [TestIterationId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[TestIterations]([Id]),
    [SessionId]       UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Sessions]([Id]),
    [ScenarioId]      NVARCHAR(100)    NOT NULL,
    [TargetFile]      NVARCHAR(1000)   NOT NULL,
    [RootCauseType]   NVARCHAR(100)    NOT NULL,
    [Description]     NVARCHAR(MAX)    NOT NULL,
    [AttemptsDetail]  NVARCHAR(MAX)    NULL,
    [ResolvedManually] BIT             NOT NULL DEFAULT 0,
    [CreatedAt]       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_UnfixedIssues] PRIMARY KEY ([Id])
);
GO

-- Indexes
CREATE INDEX [IX_AuditEvents_Session]    ON [dbo].[AuditEvents]    ([SessionId],[OccurredAt]);
CREATE INDEX [IX_AuditEvents_Project]    ON [dbo].[AuditEvents]    ([ProjectId],[EventType]);
CREATE INDEX [IX_AgentActions_Session]   ON [dbo].[AgentActions]   ([SessionId],[Component]);
CREATE INDEX [IX_Requirements_Session]   ON [dbo].[Requirements]   ([SessionId],[Status]);
CREATE INDEX [IX_ModuleSpec_Layer]       ON [dbo].[ModuleSpecifications] ([SessionId],[Layer],[Status]);
CREATE INDEX [IX_TestIterations_Track]   ON [dbo].[TestIterations]  ([SessionId],[TestTrack]);
GO
