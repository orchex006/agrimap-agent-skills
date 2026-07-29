import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateSqlArtifacts } from "../../skills/agrimap-agent-skills/scripts/validate-sql-artifacts.mjs";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "agrimap-sql-artifacts-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function put(root, relative, content) {
  const target = path.join(root, ...relative.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

const auditColumns = `
  [DATE_CREATED] DATETIME2(7) NOT NULL,
  [DATE_MODIFIED] DATETIME2(7) NULL,
  [USER_CREATED] NUMERIC(38, 0) NOT NULL,
  [USER_MODIFIED] NUMERIC(38, 0) NULL,
  [DEL_FLAG] BIT NOT NULL`;

test("accepts canonical table, procedure, and guarded messages artifacts", async (t) => {
  const root = await fixture(t);
  await put(root, "sql/UM/table/UM_USER.sql", `
CREATE TABLE [agrimap_app].[UM_USER]
(
  [ID] NUMERIC(38, 0) NOT NULL,
  [USERNAME] NVARCHAR(100) NOT NULL,
  ${auditColumns},
  CONSTRAINT [PK_UM_USER] PRIMARY KEY ([ID])
);
`);
  await put(root, "sql/UM/procedure/UM_USER_I.sql", `
CREATE OR ALTER PROCEDURE [agrimap_app].[UM_USER_I]
AS
BEGIN
  -- =============================================
  -- Step 1: Return readiness probe
  -- =============================================
  SELECT 1;
END;
`);
  await put(root, "sql/UM/messages.sql", `
IF NOT EXISTS
(
  SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
  WHERE [ID] = 'user_not_found'
)
BEGIN
  INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] ([ID], [DESCR])
  VALUES ('user_not_found', N'ไม่พบผู้ใช้');
END;
GO
`);

  const result = await validateSqlArtifacts({
    cwd: root,
    files: ["sql/UM/table/UM_USER.sql", "sql/UM/procedure/UM_USER_I.sql", "sql/UM/messages.sql"],
  });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.deepEqual(result.files.map((file) => file.kind), ["table", "procedure", "messages"]);
});

test("accepts the canonical lookup key and display columns", async (t) => {
  const root = await fixture(t);
  await put(root, "sql/UM/table/LUT_USER_STATUS.sql", `
CREATE TABLE [agrimap_app].[LUT_USER_STATUS]
(
  [ID] INT NOT NULL,
  [NAME] NVARCHAR(255) NOT NULL,
  ${auditColumns},
  CONSTRAINT [PK_LUT_USER_STATUS] PRIMARY KEY ([ID])
);
`);
  const result = await validateSqlArtifacts({ cwd: root, files: ["sql/UM/table/LUT_USER_STATUS.sql"] });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("accepts a named primary-key column when the table has no ID column", async (t) => {
  const root = await fixture(t);
  await put(root, "sql/CONTENT/table/CONTENT_ITEM.sql", `
CREATE TABLE [agrimap_app].[CONTENT_ITEM]
(
  [CONTENT_ITEM_ID] NUMERIC(38, 0) NOT NULL,
  [TITLE] NVARCHAR(255) NOT NULL,
  ${auditColumns},
  CONSTRAINT [PK_CONTENT_ITEM] PRIMARY KEY ([CONTENT_ITEM_ID])
);
`);
  const result = await validateSqlArtifacts({ cwd: root, files: ["sql/CONTENT/table/CONTENT_ITEM.sql"] });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("accepts canonical procedure comments for gates, steps, transactions, and PO_DATA", async (t) => {
  const root = await fixture(t);
  await put(root, "sql/DD/procedure/DD_DASHBOARD_WIDGET_I.sql", `
CREATE OR ALTER PROCEDURE [agrimap_app].[DD_DASHBOARD_WIDGET_I]
  @PI_SESSION_USER_ID NUMERIC(38, 0) = NULL,
  @PI_USER_ID NUMERIC(38, 0) = NULL,
  @PI_WIDGET_TYPE_ID INT = NULL,
  @PO_DATA NUMERIC(38, 0) = NULL OUTPUT
AS
BEGIN
  -- =============================================
  -- Begin Transaction
  -- =============================================
  BEGIN TRANSACTION;

  BEGIN TRY
    -- =============================================
    -- Validate required parameters
    -- =============================================
    IF (@PI_WIDGET_TYPE_ID IS NULL)
    BEGIN
      THROW 50001, 'widget_type_required', 1;
    END

    -- =============================================
    -- Validate WIDGET_TYPE_ID
    -- =============================================
    IF NOT EXISTS (SELECT 1 FROM [agrimap_app].[LUT_DD_WIDGET_TYPE] WHERE [ID] = @PI_WIDGET_TYPE_ID)
    BEGIN
      THROW 50001, 'invalid_widget_type', 1;
    END

    -- =============================================
    -- Step 1: Insert dashboard widget
    -- =============================================
    INSERT INTO [agrimap_app].[DD_DASHBOARD_WIDGET] ([WIDGET_TYPE_ID]) VALUES (@PI_WIDGET_TYPE_ID);

    -- =============================================
    -- Return PO_DATA
    -- =============================================
    SET @PO_DATA = SCOPE_IDENTITY();

    -- =============================================
    -- Commit Transaction
    -- =============================================
    COMMIT TRANSACTION;
  END TRY
  BEGIN CATCH
    -- =============================================
    -- Rollback Transaction
    -- =============================================
    IF @@TRANCOUNT > 0
      ROLLBACK TRANSACTION;
    THROW;
  END CATCH;
END;
`);

  const result = await validateSqlArtifacts({ cwd: root, files: ["sql/DD/procedure/DD_DASHBOARD_WIDGET_I.sql"] });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("procedure validation ignores cosmetic section-comment indentation", async (t) => {
  const root = await fixture(t);
  await put(root, "sql/UM/procedure/UM_USER_Q.sql", `
CREATE OR ALTER PROCEDURE [agrimap_app].[UM_USER_Q]
AS
BEGIN
-- =============================================
      -- Step 1: Query active users
  -- =============================================
SELECT 1;
END;
`);
  const result = await validateSqlArtifacts({ cwd: root, files: ["sql/UM/procedure/UM_USER_Q.sql"] });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("rejects every noncanonical PROCEDURE or PROC declaration despite adversarial literals", async (t) => {
  const root = await fixture(t);
  const cases = [
    ["UM_USER_Q", "CREATE PROCEDURE"],
    ["UM_USER_D", "ALTER PROCEDURE"],
    ["UM_USER_I", "CREATE PROC"],
    ["UM_USER_U", "ALTER PROC"],
    ["UM_USER_CHECK_Q", "CREATE OR ALTER PROC"],
  ];

  for (const [objectName, declaration] of cases) {
    await put(root, `sql/UM/procedure/${objectName}.sql`, `
${declaration} [agrimap_app].[${objectName}]
AS
BEGIN
  -- =============================================
  -- Step 1: Exercise declaration parser
  -- =============================================
  SELECT N'-- declaration guidance'
    + N'CREATE OR ALTER PROCEDURE [agrimap_app].[${objectName}]';
END;
`);
  }

  const result = await validateSqlArtifacts({
    cwd: root,
    files: cases.map(([objectName]) => `sql/UM/procedure/${objectName}.sql`),
  });
  assert.equal(result.ok, false);
  assert.equal(result.issues.filter((issue) => issue.code === "PROCEDURE_DECLARATION_INVALID").length, cases.length);
});

test("ignores procedure-like text inside adversarial SQL strings and comments", async (t) => {
  const root = await fixture(t);
  await put(root, "sql/UM/procedure/UM_USER_Q.sql", `
CREATE OR ALTER PROCEDURE [agrimap_app].[UM_USER_Q]
AS
BEGIN
  -- =============================================
  -- Step 1: Return declaration guidance
  -- =============================================
  SELECT N'-- declaration guidance'
    + N'CREATE OR ALTER PROCEDURE [agrimap_app].[FAKE_Q]';
  SELECT N'escaped quote: ''CREATE PROC [agrimap_app].[FAKE_I]''';
  SELECT "ALTER PROCEDURE [agrimap_app].[FAKE_U]";
  SELECT [guidance -- ]] CREATE OR ALTER PROCEDURE [agrimap_app].[FAKE_Q];
  /* outer comment
     /* nested CREATE PROCEDURE [agrimap_app].[FAKE_D] */
     CREATE OR ALTER PROCEDURE [agrimap_app].[FAKE_CHECK_Q]
  */
END;
`);

  const result = await validateSqlArtifacts({ cwd: root, files: ["sql/UM/procedure/UM_USER_Q.sql"] });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("rejects declarations synthesized from bracketed identifier contents", async (t) => {
  const root = await fixture(t);
  await put(root, "sql/UM/procedure/UM_USER_Q.sql", `
-- =============================================
-- Step 1: Return parser guidance
-- =============================================
SELECT [guidance -- ]] CREATE OR ALTER PROCEDURE [agrimap_app].[UM_USER_Q];
`);
  await put(root, "sql/UM/procedure/UM_USER_U.sql", `
-- =============================================
-- Step 1: Return parser guidance
-- =============================================
SELECT [unterminated CREATE OR ALTER PROCEDURE [agrimap_app].[UM_USER_U]
`);

  const result = await validateSqlArtifacts({
    cwd: root,
    files: ["sql/UM/procedure/UM_USER_Q.sql", "sql/UM/procedure/UM_USER_U.sql"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.issues.filter((issue) => issue.code === "PROCEDURE_DECLARATION_INVALID").length, 2);
  assert.equal(result.issues.filter((issue) => issue.code === "PROCEDURE_OBJECT_COUNT_INVALID").length, 2);
});

test("does not synthesize declarations across quoted non-code regions", async (t) => {
  const root = await fixture(t);
  const cases = [
    ["UM_USER_Q", "CREATE 'ignored' OR ALTER PROCEDURE"],
    ["UM_USER_U", "CREATE OR 'ignored' ALTER PROCEDURE"],
    ["UM_USER_D", 'CREATE OR ALTER "ignored" PROCEDURE'],
  ];

  for (const [objectName, declaration] of cases) {
    await put(root, `sql/UM/procedure/${objectName}.sql`, `
-- =============================================
-- Step 1: Return parser guidance
-- =============================================
${declaration} [agrimap_app].[${objectName}]
`);
  }

  const result = await validateSqlArtifacts({
    cwd: root,
    files: cases.map(([objectName]) => `sql/UM/procedure/${objectName}.sql`),
  });
  assert.equal(result.ok, false);
  assert.equal(result.issues.filter((issue) => issue.code === "PROCEDURE_DECLARATION_INVALID").length, cases.length);
});

test("keeps shared table and message object discovery stable with adversarial literals", async (t) => {
  const root = await fixture(t);
  await put(root, "sql/UM/table/UM_USER.sql", `
CREATE TABLE [agrimap_app].[UM_USER]
(
  [ID] NUMERIC(38, 0) NOT NULL,
  ${auditColumns},
  CONSTRAINT [PK_UM_USER] PRIMARY KEY ([ID])
);
SELECT N'-- object guidance'
  + N'CREATE TABLE [agrimap_app].[FAKE_TABLE]';
SELECT [guidance -- ]] CREATE TABLE [agrimap_app].[FAKE_TABLE];
`);
  await put(root, "sql/UM/messages.sql", `
IF NOT EXISTS
(
  SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
  WHERE [ID] = 'parser_guidance'
)
BEGIN
  INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] ([ID], [DESCR])
  VALUES ('parser_guidance', N'-- object guidance' + N'CREATE PROC [agrimap_app].[FAKE_I]');
END;
GO
`);

  const result = await validateSqlArtifacts({
    cwd: root,
    files: ["sql/UM/table/UM_USER.sql", "sql/UM/messages.sql"],
  });
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("rejects actor and target user parameters with non-canonical types", async (t) => {
  const root = await fixture(t);
  await put(root, "sql/UM/procedure/UM_USER_Q.sql", `
CREATE OR ALTER PROCEDURE [agrimap_app].[UM_USER_Q]
  @PI_SESSION_USER_ID INT = NULL,
  @PI_USER_ID BIGINT = NULL
AS
BEGIN
  -- =============================================
  -- Step 1: Query target user
  -- =============================================
  SELECT 1;
END;
`);
  const result = await validateSqlArtifacts({ cwd: root, files: ["sql/UM/procedure/UM_USER_Q.sql"] });
  const codes = new Set(result.issues.map((issue) => issue.code));
  assert.ok(codes.has("SESSION_USER_ID_TYPE_INVALID"));
  assert.ok(codes.has("USER_ID_TYPE_INVALID"));
});

test("rejects procedures whose control-flow gates have missing or vague comments", async (t) => {
  const root = await fixture(t);
  await put(root, "sql/DD/procedure/DD_DASHBOARD_WIDGET_I.sql", `
CREATE OR ALTER PROCEDURE [agrimap_app].[DD_DASHBOARD_WIDGET_I]
  @PI_WIDGET_TYPE_ID INT = NULL,
  @PO_DATA NUMERIC(38, 0) = NULL OUTPUT
AS
BEGIN
  BEGIN TRANSACTION;
  BEGIN TRY
    -- =============================================
    -- Check WIDGET_TYPE_ID
    -- =============================================
    IF (@PI_WIDGET_TYPE_ID IS NULL)
    BEGIN
      THROW 50001, 'widget_type_required', 1;
    END

    INSERT INTO [agrimap_app].[DD_DASHBOARD_WIDGET] ([WIDGET_TYPE_ID]) VALUES (@PI_WIDGET_TYPE_ID);
    SET @PO_DATA = SCOPE_IDENTITY();
    COMMIT TRANSACTION;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0
      ROLLBACK TRANSACTION;
    THROW;
  END CATCH;
END;
`);

  const result = await validateSqlArtifacts({ cwd: root, files: ["sql/DD/procedure/DD_DASHBOARD_WIDGET_I.sql"] });
  assert.equal(result.ok, false);
  const codes = new Set(result.issues.map((issue) => issue.code));
  for (const code of [
    "PROCEDURE_STEP_COMMENT_REQUIRED",
    "VALIDATION_COMMENT_GATE_MISSING",
    "BEGIN_TRANSACTION_COMMENT_GATE_MISSING",
    "COMMIT_TRANSACTION_COMMENT_GATE_MISSING",
    "ROLLBACK_TRANSACTION_COMMENT_GATE_MISSING",
    "RETURN_OUTPUT_COMMENT_GATE_MISSING",
  ]) assert.ok(codes.has(code), `${code} missing from ${JSON.stringify(result.issues)}`);
});

test("rejects bundled objects, wrong procedure suffix, and unguarded messages", async (t) => {
  const root = await fixture(t);
  await put(root, "sql/AUTH_FLOW/table/AUTH_FLOW.sql", `
CREATE TABLE [agrimap_app].[AUTH_FLOW] ([ID] NUMERIC(38, 0));
CREATE TABLE [agrimap_app].[AUTH_FLOW_TRANSACTION] ([ID] NUMERIC(38, 0));
`);
  await put(root, "sql/AUTH_FLOW/procedure/AUTH_FLOW_SAVE.sql", `
CREATE OR ALTER PROCEDURE [agrimap_app].[AUTH_FLOW_SAVE] AS SELECT 1;
`);
  await put(root, "sql/AUTH_FLOW/messages.sql", `
INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] ([ID], [DESCR])
VALUES ('flow_not_found', N'ไม่พ1บ flow');
`);

  const result = await validateSqlArtifacts({
    cwd: root,
    files: ["sql/AUTH_FLOW/table/AUTH_FLOW.sql", "sql/AUTH_FLOW/procedure/AUTH_FLOW_SAVE.sql", "sql/AUTH_FLOW/messages.sql"],
  });
  assert.equal(result.ok, false);
  const codes = new Set(result.issues.map((issue) => issue.code));
  assert.ok(codes.has("TABLE_OBJECT_COUNT_INVALID"));
  assert.ok(codes.has("PROCEDURE_SUFFIX_INVALID"));
  assert.ok(codes.has("MESSAGE_GUARD_MISSING"));
});

test("rejects invalid paths, filename mismatches, and audit/key type drift", async (t) => {
  const root = await fixture(t);
  await put(root, "sql/UM/tables/USER.sql", "CREATE TABLE [agrimap_app].[UM_USER] ([ID] INT);\n");
  await put(root, "sql/UM/table/USER.sql", `
CREATE TABLE [agrimap_app].[UM_USER]
(
  [ID] INT NOT NULL,
  [DATE_CREATED] DATETIME NOT NULL,
  [DATE_MODIFIED] DATETIME NULL,
  [USER_CREATED] DATETIME2(7) NOT NULL,
  [USER_MODIFIED] DATETIME2(7) NULL,
  [DEL_FLAG] BIT NULL,
  CONSTRAINT [PK_UM_USER] PRIMARY KEY ([ID])
);
`);

  const result = await validateSqlArtifacts({
    cwd: root,
    files: ["sql/UM/tables/USER.sql", "sql/UM/table/USER.sql"],
  });
  const codes = new Set(result.issues.map((issue) => issue.code));
  assert.ok(codes.has("PATH_CONTRACT_INVALID"));
  assert.ok(codes.has("TABLE_FILENAME_MISMATCH"));
  assert.ok(codes.has("GENERAL_KEY_TYPE_INVALID"));
  assert.ok(codes.has("DATE_CREATED_INVALID"));
  assert.ok(codes.has("USER_CREATED_INVALID"));
  assert.ok(codes.has("DEL_FLAG_INVALID"));
});

test("rejects dbo and unqualified schemas for created SQL objects", async (t) => {
  const root = await fixture(t);
  await put(root, "sql/UM/procedure/UM_USER_Q.sql", `
CREATE OR ALTER PROCEDURE [dbo].[UM_USER_Q]
AS
BEGIN
  -- =============================================
  -- Step 1: Query target user
  -- =============================================
  SELECT 1;
END;
`);
  await put(root, "sql/UM/procedure/UM_USER_CHECK_Q.sql", `
CREATE OR ALTER PROCEDURE [UM_USER_CHECK_Q]
AS
BEGIN
  -- =============================================
  -- Step 1: Check target user
  -- =============================================
  SELECT 1;
END;
`);

  const result = await validateSqlArtifacts({
    cwd: root,
    files: ["sql/UM/procedure/UM_USER_Q.sql", "sql/UM/procedure/UM_USER_CHECK_Q.sql"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.issues.filter((issue) => issue.code === "OBJECT_SCHEMA_INVALID").length, 2);
});

test("rejects a messages inventory that has no executable insert statement", async (t) => {
  const root = await fixture(t);
  await put(root, "sql/UM/messages.sql", `
-- username_required is intended for this domain, but no deployment statement exists.
IF NOT EXISTS
(
  SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
  WHERE [ID] = 'username_required'
)
BEGIN
  SELECT 1;
END;
GO
`);

  const result = await validateSqlArtifacts({ cwd: root, files: ["sql/UM/messages.sql"] });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "MESSAGE_INSERT_REQUIRED"));
});
