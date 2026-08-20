'use strict';

const { z } = require('zod');

const YEARS = ['First Year', 'Second Year', 'Third Year', 'Fourth Year'];

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or username is required.'),
  password: z.string().min(1, 'Password is required.'),
});

const courseCreateSchema = z.object({
  title: z.string().trim().min(1, 'Course title is required.').max(200),
  description: z.string().trim().max(2000).optional().default(''),
  year: z.enum(YEARS, { errorMap: () => ({ message: `Year must be one of: ${YEARS.join(', ')}` }) }),
  cover: z.string().trim().url().nullable().optional(),
});

const courseUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  cover: z.string().trim().url().nullable().optional(),
});

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/|live\/)[A-Za-z0-9_-]{10,12}|youtu\.be\/[A-Za-z0-9_-]{10,12})([?&].*)?$/i;

const lectureCreateSchema = z.object({
  title: z.string().trim().min(1, 'Lecture title is required.').max(200),
  videoData: z.string().trim().regex(YOUTUBE_URL_REGEX, 'Must be a valid YouTube video URL.').nullable().optional(),
  pdfData: z.object({ url: z.string().url(), name: z.string() }).nullable().optional(),
});

const lectureUpdateSchema = lectureCreateSchema.partial();

const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const questionSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string().min(1),
    type: z.literal('mcq'),
    imageUrl: z.string().url(),
    options: z.array(optionSchema).min(2, 'A multiple choice question needs at least 2 options.'),
    correctOptionId: z.string().min(1, 'Select the correct answer for every multiple choice question.'),
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal('essay'),
    imageUrl: z.string().url(),
  }),
]);

const quizUpsertSchema = z.object({
  id: z.string().min(1).optional(),
  questions: z.array(questionSchema).min(1, 'Add at least one question before saving.'),
}).superRefine((quiz, ctx) => {
  for (const q of quiz.questions) {
    if (q.type === 'mcq' && !q.options.some((o) => o.id === q.correctOptionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'correctOptionId must reference one of the provided options.',
        path: ['questions'],
      });
    }
  }
});

const studentCreateSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required.').max(120),
  email: z.string().trim().min(1, 'Email or username is required.').max(180),
  password: z.string().min(4, 'Password must be at least 4 characters.').max(200),
  year: z.enum(YEARS).default('First Year'),
});

const enrollmentUpdateSchema = z.object({
  courseIds: z.array(z.string().min(1)),
});

const mcqAnswerSchema = z.object({
  questionId: z.string().min(1),
  type: z.literal('mcq'),
  selectedOptionId: z.string().min(1, 'Please answer every question before submitting.'),
});

const essayAnswerSchema = z.object({
  questionId: z.string().min(1),
  type: z.literal('essay'),
  method: z.enum(['text', 'image']),
  text: z.string().max(20000).optional().default(''),
  imageUrl: z.string().url().nullable().optional(),
}).superRefine((answer, ctx) => {
  if (answer.method === 'text' && !answer.text.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please answer every question before submitting.', path: ['text'] });
  }
  if (answer.method === 'image' && !answer.imageUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please answer every question before submitting.', path: ['imageUrl'] });
  }
});

const quizSubmitSchema = z.object({
  answers: z.array(z.union([mcqAnswerSchema, essayAnswerSchema])).min(1, 'Please answer every question before submitting.'),
});

const publishScoreSchema = z.object({
  finalScore: z.number({ invalid_type_error: 'Final score must be a number.' }).min(0),
});

module.exports = {
  YEARS,
  loginSchema,
  courseCreateSchema,
  courseUpdateSchema,
  lectureCreateSchema,
  lectureUpdateSchema,
  quizUpsertSchema,
  studentCreateSchema,
  enrollmentUpdateSchema,
  quizSubmitSchema,
  publishScoreSchema,
};