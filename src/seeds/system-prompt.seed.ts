import mongoose from 'mongoose';
import { SystemPromptModel, SystemPromptType, SystemPromptLanguage, SystemPromptStatus } from '../models/system-prompt.model';
import User from '../models/user.model';

type SystemPromptSeedData = {
  promptKey: string;
  type: SystemPromptType;
  language: SystemPromptLanguage;
  version: number;
  content: string;
  status: SystemPromptStatus;
};

const systemPrompts: SystemPromptSeedData[] = [
  {
    promptKey: 'DEFAULT_GENERATION_PROMPT',
    type: 'GENERATION',
    language: 'EN',
    version: 1,
    content: `You are a Senior Tech Lead with 15 years of experience conducting technical interviews at top-tier companies. Your goal is to generate high-quality, practical, and tailored technical interview questions based on the candidate's profile and the provided job description. Ensure the difficulty strictly matches the candidate's level.`,
    status: 'PUBLISHED'
  },
  {
    promptKey: 'DEFAULT_GENERATION_PROMPT_VI',
    type: 'GENERATION',
    language: 'VI',
    version: 1,
    content: `Bạn là một Senior Tech Lead với 15 năm kinh nghiệm phỏng vấn kỹ thuật tại các công ty hàng đầu. Mục tiêu của bạn là tạo ra các câu hỏi phỏng vấn kỹ thuật thực tế, chất lượng cao và bám sát hồ sơ ứng viên cũng như mô tả công việc. Đảm bảo độ khó của câu hỏi hoàn toàn phù hợp với cấp độ của ứng viên.`,
    status: 'PUBLISHED'
  },
  {
    promptKey: 'DEFAULT_EVALUATION_PROMPT',
    type: 'EVALUATION',
    language: 'EN',
    version: 1,
    content: `You are a strict but fair Senior Tech Lead evaluating a candidate's technical interview answers. You need to assess technical depth, problem-solving skills, and communication. Be objective and highlight both strengths and weaknesses clearly. Follow the Evaluation Rubric strictly.`,
    status: 'PUBLISHED'
  },
  {
    promptKey: 'DEFAULT_EVALUATION_PROMPT_VI',
    type: 'EVALUATION',
    language: 'VI',
    version: 1,
    content: `Bạn là một Senior Tech Lead nghiêm khắc nhưng công bằng, đang đánh giá các câu trả lời phỏng vấn kỹ thuật của ứng viên. Bạn cần đánh giá chiều sâu kỹ thuật, kỹ năng giải quyết vấn đề và giao tiếp. Hãy khách quan, chỉ rõ điểm mạnh và điểm yếu. Tuân thủ nghiêm ngặt Hướng dẫn đánh giá.`,
    status: 'PUBLISHED'
  },
  {
    promptKey: 'DEFAULT_LEARNING_PATH_PROMPT',
    type: 'LEARNING_PATH',
    language: 'EN',
    version: 1,
    content: `You are a Technical Mentor. Based on the candidate's interview performance and identified weaknesses, your task is to create a structured, actionable learning path to help them improve and reach the next level in their career.`,
    status: 'PUBLISHED'
  },
  {
    promptKey: 'DEFAULT_LEARNING_PATH_PROMPT_VI',
    type: 'LEARNING_PATH',
    language: 'VI',
    version: 1,
    content: `Bạn là một Mentor Kỹ thuật. Dựa trên kết quả phỏng vấn và các điểm yếu đã được xác định của ứng viên, nhiệm vụ của bạn là tạo ra một lộ trình học tập thực tế, có cấu trúc để giúp họ cải thiện và tiến tới cột mốc tiếp theo trong sự nghiệp.`,
    status: 'PUBLISHED'
  }
];

export const seedSystemPrompts = async () => {
  try {
    const adminUser = await User.findOne({ role: 'ADMIN' });
    if (!adminUser) {
      console.log('No admin user found, skipping system prompt seeding.');
      return;
    }

    let seededCount = 0;

    for (const promptData of systemPrompts) {
      const existingPrompt = await SystemPromptModel.findOne({
        promptKey: promptData.promptKey,
        type: promptData.type,
        language: promptData.language,
        version: promptData.version
      });

      if (!existingPrompt) {
        await SystemPromptModel.create({
          ...promptData,
          createdBy: adminUser._id,
          publishedAt: new Date()
        });
        seededCount++;
      }
    }

    if (seededCount > 0) {
      console.log(`✅ Successfully seeded ${seededCount} system prompts`);
    } else {
      console.log('✅ System prompts already exist');
    }
  } catch (error) {
    console.error('❌ Error seeding system prompts:', error);
  }
};
