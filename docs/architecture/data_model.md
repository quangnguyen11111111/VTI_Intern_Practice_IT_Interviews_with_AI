# VTI AI Interview - Data Model (MongoDB Schema Diagram)

Dưới đây là sơ đồ Mermaid mô tả các Entity (Collection) chính trong hệ thống và mối quan hệ giữa chúng, khớp với Implementation cuối ở Phase 0.

```mermaid
erDiagram
    USERS ||--o{ INTERVIEWS : "creates"
    SYSTEM_PROMPTS ||--o{ INTERVIEWS : "applies_to"

    USERS {
        ObjectId _id PK
        String email "Unique, Indexed"
        String passwordHash
        String fullName
        String role "Enum: ADMIN, INTERVIEWER, CANDIDATE"
        String status "Enum: ACTIVE, INACTIVE, BANNED"
        String avatarUrl "Optional"
        String currentLevel "Optional"
        String githubUrl "Optional"
        String linkedinUrl "Optional"
        String bio "Optional"
        Date lastLoginAt "Optional"
        Date createdAt
        Date updatedAt
    }

    SYSTEM_PROMPTS {
        ObjectId _id PK
        String name
        String description "Optional"
        String promptText
        String type "Enum: SYSTEM, INTERVIEWER, EVALUATOR"
        Boolean isActive
        String version
        ObjectId createdBy FK "Ref: Users"
        Date createdAt
        Date updatedAt
    }

    INTERVIEWS {
        ObjectId _id PK
        String title
        String description "Optional"
        ObjectId candidateId FK "Ref: Users"
        ObjectId promptId FK "Ref: SystemPrompts"
        String status "Enum: PENDING, GENERATING, IN_PROGRESS, EVALUATING, COMPLETED, FAILED"
        Array requiredSkills "List of skills (String)"
        String targetLevel "Enum: FRESHER, JUNIOR, MIDDLE, SENIOR"
        Date startedAt "Optional"
        Date completedAt "Optional"
        Number score "Optional, 0-100"
        String failureReason "Optional"
        Date createdAt
        Date updatedAt
        
        %% Nhúng Sub-documents
        Array questions "Sub-document: InterviewQuestion"
    }

    %% Sub-document trong Interviews
    INTERVIEWS_QUESTIONS {
        String id "UUID"
        String content "English question"
        String contentVi "Vietnamese translation"
        String expectedAnswer "English expectation"
        String expectedAnswerVi "Vietnamese expectation"
        String candidateAnswer "Optional"
        Number score "Optional"
        String feedback "Optional"
        String feedbackVi "Optional"
    }
    
    INTERVIEWS ||--o{ INTERVIEWS_QUESTIONS : "contains"
```

## Các Lưu Ý Về Thiết Kế Dữ Liệu:

1. **Denormalization (Phi Chuẩn Hóa)**:
   - Thay vì tạo một Collection `Questions` riêng biệt, hệ thống nhúng (embed) mảng các `questions` trực tiếp vào tài liệu `Interview`. Do số lượng câu hỏi trong mỗi phiên phỏng vấn là cố định và nhỏ (thường là 5 câu), thiết kế nhúng giúp giảm số lượng truy vấn và giảm chi phí Transaction.

2. **Indexes (Chỉ Mục)**:
   - `Users`: Đánh chỉ mục Unique trên trường `email`.
   - `Interviews`: Đánh chỉ mục trên trường `candidateId` để tăng tốc độ truy xuất lịch sử phỏng vấn của một người dùng. Đánh chỉ mục trên `status` cho mục đích thống kê và dọn dẹp các phiên bị treo.

3. **Cơ chế Soft Delete**:
   - Hiện tại hệ thống ưu tiên cập nhật trạng thái `status: 'INACTIVE'` cho Users thay vì xoá cứng (hard delete).
   - Với `SystemPrompts`, trường `isActive` dùng để vô hiệu hoá một prompt khi nó không còn phù hợp với version mới của LLM.
