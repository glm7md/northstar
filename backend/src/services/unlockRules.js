'use strict';

function lectureUnlockState(course, index, student, attemptedLectureIds) {
  if (index === 0) return { unlocked: true };
  if (!student) return { unlocked: false, reason: 'login' };
  if (!isEnrolled(course, student)) return { unlocked: false, reason: 'not-enrolled' };

  const lectures = course.lectures || [];
  for (let i = 0; i < index; i += 1) {
    const lec = lectures[i];
    if (lec.quiz && !attemptedLectureIds.has(lec.id)) {
      return { unlocked: false, reason: 'quiz' };
    }
  }
  return { unlocked: true };
}

function isEnrolled(course, student) {
  if (!student) return false;
  return Array.isArray(student.enrolledCourseIds) && student.enrolledCourseIds.includes(course.id);
}

module.exports = { lectureUnlockState, isEnrolled };
