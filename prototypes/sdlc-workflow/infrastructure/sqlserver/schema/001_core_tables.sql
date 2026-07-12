-- =============================================================================
-- SDLC Automation Suite — Core Schema
-- Script: 001_core_tables.sql
-- =============================================================================

SET NOCOUNT ON;
GO

-- ---------------------------------------------------------------------------
-- PROJECTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[Projects] (
    [Id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [Name]            NVARCHAR(255)    NOT NULL,
    [Description]     NVARCHAR(MAX)    NULL,
    [ClientId]        UNIQUEIDENTIFIER NOT NULL,
    [OperatingMode]   NVARCHAR(20)     NOT NULL CHECK ([OperatingMode] IN ('HITL','FullAutomation')),
    [LLMProvider]     NVARCHAR(50)     NOT NULL,
    [LLMModelTier]    NVARCHAR(20)     NOT NULL CHECK ([LLMModelTier] IN ('Economy','Standard','Premium')),
    [SensitivityLevel] NVARCHAR(20)   NOT NULL CHECK ([SensitivityLevel] IN ('Standard','Enhanced','Maximum')),
    [ComplianceMode]  NVARCHAR(20)     NOT NULL CHECK ([ComplianceMode] IN ('GDPR','HIPAA','Custom','None')),
    [CurrentComponent] TINYINT         NOT NULL DEFAULT 0,
    [Status]          NVARCHAR(30)     NOT NULL DEFAULT 'Active'
                        CHECK ([Status] IN ('Active','Paused','Completed','Archived')),
    [CreatedAt]       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Projects] PRIMARY KEY ([Id])
);
GO

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[Users] (
    [Id]            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [KeycloakId]    NVARCHAR(255)    NOT NULL UNIQUE,
    [Email]         NVARCHAR(320)    NOT NULL UNIQUE,
    [DisplayName]   NVARCHAR(255)    NOT NULL,
    [CreatedAt]     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Users] PRIMARY KEY ([Id])
);
GO

-- ---------------------------------------------------------------------------
-- ROLES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[Roles] (
    [Id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [Name]        NVARCHAR(100)    NOT NULL UNIQUE,
    [Description] NVARCHAR(500)    NULL,
    CONSTRAINT [PK_Roles] PRIMARY KEY ([Id])
);
GO

INSERT INTO [dbo].[Roles] ([Name],[Description]) VALUES
('Client',           'End client, approves gates and provides data'),
('ProjectLead',      'Manages the project, final review authority'),
('TechLead',         'Technical lead, reviews architecture and API decisions'),
('SolutionArchitect','Reviews system architecture decisions'),
('BusinessAnalyst',  'Reviews requirements and business logic'),
('SeniorDeveloper',  'Reviews component and code specifications'),
('UIUXLead',         'Reviews UI/UX design decisions'),
('SeniorDesigner',   'Reviews component library and screens'),
('MLEngineer',       'Reviews AI/ML specifications'),
('DataEngineer',     'Reviews data pipeline specifications'),
('IntegrationSpecialist', 'Reviews integration specifications'),
('SecurityReviewer', 'Reviews security-sensitive specifications');
GO

-- ---------------------------------------------------------------------------
-- PROJECT MEMBERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[ProjectMembers] (
    [Id]        UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ProjectId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Projects]([Id]),
    [UserId]    UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Users]([Id]),
    [RoleId]    UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Roles]([Id]),
    [AssignedAt] DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ProjectMembers] PRIMARY KEY ([Id]),
    CONSTRAINT [UQ_ProjectMember] UNIQUE ([ProjectId],[UserId],[RoleId])
);
GO

-- ---------------------------------------------------------------------------
-- SESSIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[Sessions] (
    [Id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ProjectId]       UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Projects]([Id]),
    [InitiatedByUserId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Users]([Id]),
    [Component]       TINYINT          NOT NULL CHECK ([Component] BETWEEN 1 AND 5),
    [Status]          NVARCHAR(20)     NOT NULL DEFAULT 'Active'
                        CHECK ([Status] IN ('Active','Paused','Completed','SafeMode','Terminated')),
    [OperatingMode]   NVARCHAR(20)     NOT NULL,
    [StartedAt]       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    [EndedAt]         DATETIME2        NULL,
    [RedisSessionKey] NVARCHAR(255)    NOT NULL,
    CONSTRAINT [PK_Sessions] PRIMARY KEY ([Id])
);
GO

-- ---------------------------------------------------------------------------
-- APPROVAL GATES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[ApprovalGates] (
    [Id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [SessionId]   UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Sessions]([Id]),
    [ProjectId]   UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Projects]([Id]),
    [Component]   TINYINT          NOT NULL,
    [GateNumber]  TINYINT          NOT NULL,
    [GateName]    NVARCHAR(100)    NOT NULL,
    [Status]      NVARCHAR(20)     NOT NULL DEFAULT 'Pending'
                    CHECK ([Status] IN ('Pending','Approved','Rejected','Skipped')),
    [OpenedAt]    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    [ClosedAt]    DATETIME2        NULL,
    [ApprovedByUserId] UNIQUEIDENTIFIER NULL REFERENCES [dbo].[Users]([Id]),
    [RejectionReason]  NVARCHAR(MAX)   NULL,
    [IterationNumber]  INT            NOT NULL DEFAULT 1,
    CONSTRAINT [PK_ApprovalGates] PRIMARY KEY ([Id])
);
GO

-- ---------------------------------------------------------------------------
-- STANDING APPROVALS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[StandingApprovals] (
    [Id]           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [SessionId]    UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Sessions]([Id]),
    [DecisionClass] NVARCHAR(255)   NOT NULL,
    [GrantedByUserId] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Users]([Id]),
    [GrantedAt]    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    [ExpiresAt]    DATETIME2        NULL,
    CONSTRAINT [PK_StandingApprovals] PRIMARY KEY ([Id])
);
GO

-- ---------------------------------------------------------------------------
-- CONFLICTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[Conflicts] (
    [Id]           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [SessionId]    UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Sessions]([Id]),
    [Component]    TINYINT          NOT NULL,
    [Description]  NVARCHAR(MAX)    NOT NULL,
    [ConflictType] NVARCHAR(50)     NOT NULL,
    [Status]       NVARCHAR(20)     NOT NULL DEFAULT 'Open'
                    CHECK ([Status] IN ('Open','AutoResolved','ClientResolved','Escalated')),
    [Resolution]   NVARCHAR(MAX)    NULL,
    [ResolvedByUserId] UNIQUEIDENTIFIER NULL REFERENCES [dbo].[Users]([Id]),
    [ResolvedAt]   DATETIME2        NULL,
    [CreatedAt]    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Conflicts] PRIMARY KEY ([Id])
);
GO

-- ---------------------------------------------------------------------------
-- PLAN VERSIONS (Document history)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[PlanVersions] (
    [Id]           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [SessionId]    UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Sessions]([Id]),
    [AgentName]    NVARCHAR(100)    NOT NULL,
    [VersionNumber] INT             NOT NULL,
    [DocxMinioKey] NVARCHAR(1000)   NULL,
    [JsonMinioKey] NVARCHAR(1000)   NULL,
    [IsModifiedByClient] BIT        NOT NULL DEFAULT 0,
    [DiffSummary]  NVARCHAR(MAX)    NULL,
    [CreatedAt]    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_PlanVersions] PRIMARY KEY ([Id])
);
GO

-- ---------------------------------------------------------------------------
-- REVIEW QUEUE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[ReviewQueueItems] (
    [Id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [SessionId]       UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Sessions]([Id]),
    [Component]       TINYINT          NOT NULL,
    [ReviewType]      NVARCHAR(100)    NOT NULL,
    [AgentName]       NVARCHAR(100)    NOT NULL,
    [Priority]        NVARCHAR(20)     NOT NULL DEFAULT 'Normal'
                        CHECK ([Priority] IN ('Critical','High','Normal','Low')),
    [Status]          NVARCHAR(20)     NOT NULL DEFAULT 'Pending'
                        CHECK ([Status] IN ('Pending','Claimed','InReview','Approved','ChangesRequested','Escalated')),
    [ContextSummary]  NVARCHAR(MAX)    NULL,
    [OutputMinioKey]  NVARCHAR(1000)   NULL,
    [ClaimedByUserId] UNIQUEIDENTIFIER NULL REFERENCES [dbo].[Users]([Id]),
    [ClaimedAt]       DATETIME2        NULL,
    [ReviewDecision]  NVARCHAR(MAX)    NULL,
    [ReviewedAt]      DATETIME2        NULL,
    [EscalatedToUserId] UNIQUEIDENTIFIER NULL REFERENCES [dbo].[Users]([Id]),
    [CreatedAt]       DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    [TimeoutAt]       DATETIME2        NOT NULL,
    CONSTRAINT [PK_ReviewQueueItems] PRIMARY KEY ([Id])
);
GO

-- ---------------------------------------------------------------------------
-- LLM USAGE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS [dbo].[LLMUsage] (
    [Id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [SessionId]       UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Sessions]([Id]),
    [ProjectId]       UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[Projects]([Id]),
    [AgentName]       NVARCHAR(100)    NOT NULL,
    [Provider]        NVARCHAR(50)     NOT NULL,
    [Model]           NVARCHAR(100)    NOT NULL,
    [PromptTokens]    INT              NOT NULL DEFAULT 0,
    [CompletionTokens] INT             NOT NULL DEFAULT 0,
    [TotalTokens]     INT              NOT NULL DEFAULT 0,
    [EstimatedCostUSD] DECIMAL(10,6)   NOT NULL DEFAULT 0,
    [LatencyMs]       INT              NULL,
    [Success]         BIT              NOT NULL DEFAULT 1,
    [ErrorMessage]    NVARCHAR(MAX)    NULL,
    [CalledAt]        DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_LLMUsage] PRIMARY KEY ([Id])
);
GO

-- Indexes
CREATE INDEX [IX_LLMUsage_Session]  ON [dbo].[LLMUsage]  ([SessionId]);
CREATE INDEX [IX_LLMUsage_Project]  ON [dbo].[LLMUsage]  ([ProjectId]);
CREATE INDEX [IX_Sessions_Project]  ON [dbo].[Sessions]   ([ProjectId]);
CREATE INDEX [IX_ReviewQueue_Status] ON [dbo].[ReviewQueueItems] ([Status],[Component]);
CREATE INDEX [IX_ApprovalGates_Session] ON [dbo].[ApprovalGates] ([SessionId],[Component]);
GO
