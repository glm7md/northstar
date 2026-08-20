'use strict';

function toPublicCourseSummary(course) {
  return {
    id: course.id,
    title: course.title,
    description: course.description || '',
    year: course.year,
    cover: course.cover || null,
    lectureCount: (course.lectures || []).length,
  };
}

function toLectureListItem(lecture, index, unlockState) {
  return {
    id: lecture.id,
    title: lecture.title,
    order: index,
    hasQuiz: Boolean(lecture.quiz),
    unlocked: unlockState.unlocked,
    reason: unlockState.unlocked ? null : unlockState.reason,
  };
}

function toLectureContent(lecture) {
  return {
    id: lecture.id,
    title: lecture.title,
    videoId: lecture.videoData || null,
    pdfData: lecture.pdfData || null,
    hasQuiz: Boolean(lecture.quiz),
  };
}

function toQuizForAttempt(quiz) {
  return {
    id: quiz.id,
    questions: quiz.questions.map((q) => {
      if (q.type === 'mcq') {
        return {
          id: q.id,
          type: 'mcq',
          imageUrl: q.imageUrl,
          options: q.options.map((o) => ({ id: o.id, label: o.label })),
        };
      }
      return { id: q.id, type: 'essay', imageUrl: q.imageUrl };
    }),
  };
}

module.exports = { toPublicCourseSummary, toLectureListItem, toLectureContent, toQuizForAttempt };