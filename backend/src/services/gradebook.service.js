'use strict';

const studentsRepo = require('../repositories/students.repository');
const coursesRepo = require('../repositories/courses.repository');
const quizAttemptsRepo = require('../repositories/quizAttempts.repository');

async function getGradesByYear(year) {
  const [allStudents, allCourses] = await Promise.all([studentsRepo.list(), coursesRepo.list()]);

  const students = year ? allStudents.filter((s) => s.year === year) : allStudents;

  const lectureIndex = new Map();
  for (const course of allCourses) {
    for (const lecture of course.lectures) {
      lectureIndex.set(lecture.id, {
        lectureTitle: lecture.title,
        courseId: course.id,
        courseTitle: course.title,
      });
    }
  }

  const results = await Promise.all(
    students.map(async (student) => {
      const attempts = await quizAttemptsRepo.findByStudent(student.id);

      const courseMap = new Map();
      for (const attempt of attempts) {
        const info = lectureIndex.get(attempt.lectureId);
        const courseId = attempt.courseId;
        const courseTitle = info ? info.courseTitle : 'Deleted course';
        const lectureTitle = info ? info.lectureTitle : 'Deleted lecture';

        if (!courseMap.has(courseId)) {
          courseMap.set(courseId, { courseId, courseTitle, lectures: [] });
        }
        courseMap.get(courseId).lectures.push({
          lectureId: attempt.lectureId,
          lectureTitle,
          mcqScore: attempt.mcqScore,
          mcqTotal: attempt.mcqTotal,
          essayTotal: attempt.essayTotal,
          finalScore: attempt.finalScore,
          approved: attempt.approved,
          submittedAt: attempt.submittedAt,
        });
      }

      return {
        id: student.id,
        name: student.name,
        email: student.email,
        year: student.year,
        courses: Array.from(courseMap.values()),
      };
    })
  );

  return results;
}

module.exports = { getGradesByYear };

