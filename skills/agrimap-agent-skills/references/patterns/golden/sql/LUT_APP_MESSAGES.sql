USE [AgriMapDB]
GO

/****** Object:  Table [agrimap_app].[LUT_APP_MESSAGES]    Script Date: 13/3/2569 9:19:33 ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [agrimap_app].[LUT_APP_MESSAGES](
    [ID] [varchar](100) NOT NULL,
    [DESCR] [varchar](1000) NOT NULL,
    CONSTRAINT [PK_LUT_APP_MESSAGES] PRIMARY KEY CLUSTERED 
    (
        [ID] ASC
    )WITH (
        PAD_INDEX = OFF,
        STATISTICS_NORECOMPUTE = OFF,
        IGNORE_DUP_KEY = OFF,
        ALLOW_ROW_LOCKS = ON,
        ALLOW_PAGE_LOCKS = ON,
        OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF
    ) ON [PRIMARY]
) ON [PRIMARY]
GO

-- ============================================================
-- AgriMap Platform - Consolidated Error Code Dictionary
-- Generated: 2026-03-13
-- Table: [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR)
-- Source: Completed/**/messages.txt (9 files, 7 modules)
-- Total unique error codes: 44
-- ============================================================
-- NOTE: ใช้ IF NOT EXISTS กันการ insert ซ้ำทุกรายการ
-- ============================================================

-- ==========================================================
-- [COMMON] Shared Error Codes (ใช้ร่วมหลายโมดูล)
-- ==========================================================

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'invalid_parameter'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'invalid_parameter', N'พารามิเตอร์ไม่ถูกต้อง'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'data_not_found'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'data_not_found', N'ไม่พบข้อมูลที่ต้องการ'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'session_user_required'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'session_user_required', N'กรุณาระบุรหัสผู้ใช้งานที่ทำรายการ'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'unauthorized'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'unauthorized', N'คุณไม่มีสิทธิ์ดำเนินการนี้'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'sql_error'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'sql_error', N'เกิดข้อผิดพลาดจากระบบ'
    );

-- ==========================================================
-- [APP_TOKEN] Module
-- ==========================================================

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'user_id_required'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'user_id_required', N'กรุณาระบุรหัสผู้ใช้งาน'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'nonce_required'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'nonce_required', N'กรุณาระบุค่า Nonce'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'fcm_token_required'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'fcm_token_required', N'กรุณาระบุค่า FCM Token ที่ต้องการอัปเดต'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'duplicate_token'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'duplicate_token', N'พบ Token ชุดนี้ในระบบแล้ว ไม่สามารถเพิ่มซ้ำได้'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'token_expired'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'token_expired', N'Token หมดอายุแล้ว'
    );

-- ==========================================================
-- [CONTENT] Module
-- ==========================================================

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'content_name_required'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'content_name_required', N'กรุณาระบุชื่อเนื้อหา'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'content_type_required'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'content_type_required', N'กรุณาระบุประเภทเนื้อหา'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'invalid_content_type'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'invalid_content_type', N'ประเภทเนื้อหาไม่ถูกต้อง ไม่พบในระบบ'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'parent_not_found'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'parent_not_found', N'ไม่พบเนื้อหาแม่ที่ระบุ'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'content_not_found'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'content_not_found', N'ไม่พบข้อมูลเนื้อหาที่ต้องการ'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'invalid_parent'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'invalid_parent', N'ไม่สามารถย้ายไปยังตำแหน่งตัวเองได้'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'circular_reference'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'circular_reference',
        N'ไม่สามารถย้ายไปยัง Folder ลูกของตัวเองได้ (Circular Reference)'
    );

-- ==========================================================
-- [FILE_STORAGE] Module
-- ==========================================================

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'invalid_file_size'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'invalid_file_size', N'ขนาดไฟล์ไม่ถูกต้อง กรุณาระบุเป็นตัวเลข'
    );

-- ==========================================================
-- [LOGIN] Module
-- ==========================================================

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'invalid_credentials'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'invalid_credentials', N'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
    );

-- ==========================================================
-- [ORGANIZATION] Module
-- ==========================================================

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'org_not_found'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'org_not_found', N'ไม่พบข้อมูลหน่วยงานที่ต้องการ'
    );

-- ==========================================================
-- [UM_USER] Module
-- ==========================================================

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'username_required'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'username_required', N'กรุณาระบุชื่อผู้ใช้งาน'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'password_required'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'password_required', N'กรุณาระบุรหัสผ่าน'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'name_required'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'name_required', N'กรุณาระบุชื่อ'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'surname_required'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'surname_required', N'กรุณาระบุนามสกุล'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'email_required'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'email_required', N'กรุณาระบุอีเมล'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'username_duplicate'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'username_duplicate',
        N'ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว ไม่สามารถใช้ซ้ำได้'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'email_duplicate'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'email_duplicate', N'อีเมลนี้มีอยู่ในระบบแล้ว ไม่สามารถใช้ซ้ำได้'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'tel_duplicate'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'tel_duplicate', N'เบอร์โทรนี้มีอยู่ในระบบแล้ว ไม่สามารถใช้ซ้ำได้'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'id_card_duplicate'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'id_card_duplicate',
        N'เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว ไม่สามารถใช้ซ้ำได้'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'user_not_found'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'user_not_found', N'ไม่พบข้อมูลผู้ใช้งานที่ต้องการ'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'cannot_delete_self'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'cannot_delete_self', N'ไม่สามารถลบบัญชีผู้ใช้งานของตัวเองได้'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'cannot_delete_protected_role'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'cannot_delete_protected_role',
        N'ไม่สามารถลบผู้ใช้งานที่มีบทบาท Root หรือ SuperAdmin ได้'
    );

-- ==========================================================
-- [UM_ROLE] Module
-- ==========================================================

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'role_name_required'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'role_name_required', N'กรุณาระบุชื่อบทบาท'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'role_name_duplicate'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'role_name_duplicate',
        N'ชื่อบทบาทนี้มีอยู่ในระบบแล้ว ไม่สามารถใช้ซ้ำได้'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'role_not_found'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'role_not_found', N'ไม่พบข้อมูลบทบาทที่ต้องการ'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'role_has_members'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'role_has_members',
        N'ไม่สามารถลบบทบาทได้ เนื่องจากยังมีผู้ใช้งานอยู่ในบทบาท'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'role_system_protected'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'role_system_protected',
        N'ไม่สามารถแก้ไขหรือลบบทบาท Root/SuperAdmin ได้ เนื่องจากเป็นบทบาทของระบบ'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'role_user_duplicate'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'role_user_duplicate',
        N'ผู้ใช้งานนี้อยู่ในบทบาทนี้แล้ว ไม่สามารถเพิ่มซ้ำได้'
    );

-- ==========================================================
-- [UM_PERMISSION] Module
-- ==========================================================

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'role_id_required'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'role_id_required', N'กรุณาระบุรหัสบทบาท'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'permission_denied'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'permission_denied',
        N'ไม่สามารถแก้ไขสิทธิ์ของผู้ใช้งานที่มีบทบาทสูงกว่าหรือเท่ากับตัวเองได้'
    );

-- ==========================================================
-- [UM_GROUP] Module
-- ==========================================================

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'group_name_required'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'group_name_required', N'กรุณาระบุชื่อกลุ่ม'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'group_name_duplicate'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'group_name_duplicate',
        N'ชื่อกลุ่มนี้มีอยู่ในระบบแล้ว ไม่สามารถใช้ซ้ำได้'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'group_not_found'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'group_not_found', N'ไม่พบข้อมูลกลุ่มที่ต้องการ'
    );

IF
    NOT EXISTS (
        SELECT 1 FROM [agrimap_app].[LUT_APP_MESSAGES]
        WHERE [ID] = 'group_has_members'
    )
    INSERT INTO [agrimap_app].[LUT_APP_MESSAGES] (ID, DESCR) VALUES (
        'group_has_members',
        N'ไม่สามารถลบกลุ่มได้ เนื่องจากยังมีสมาชิกอยู่ในกลุ่ม'
    );

-- ============================================================
-- END OF CONSOLIDATED ERROR CODES
-- Total: 44 unique error codes
-- ============================================================
